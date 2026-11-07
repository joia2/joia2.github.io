import { browser } from '$app/env';
import { readJSON, writeJSON, changePassword as changeVaultPassword } from '#lib/vault.js';
import { saveKey, loadKey, deleteKey, deleteAllKeys } from '#lib/keystore.js';
import { keyFromRaw } from '#lib/crypto.js';

// While unlocked, a reload of the tab stays unlocked; closing the tab or locking ends it. The token
// lives in this tab's sessionStorage, which the browser clears when the tab closes. The key is in
// IndexedDB, unreadable, under an id kept beside the token; a tab that starts without a login deletes
// every saved key, so none outlives its tab for long. The password itself is never kept, only the key
// made from it.
// Installed as an app (home screen), the login is kept on the device instead (localStorage) and
// stays until locked: no idle lock, and closing the app doesn't end it.
// Handoff: a login in the browser also leaves the token and key in a cookie for an hour. iOS copies
// cookies into an app added to the Home Screen, so the app starts logged in. The cookie is for
// /__handoff/, a page the service worker answers itself, so the cookie is never sent to the server:
// the app reads it there in a hidden frame, and deletes it.
// demo: example data kept only in memory, opened from the login screen without a token
// restoring: true while a reload looks for this tab's saved login
const installed = browser && (matchMedia('(display-mode: standalone)').matches || navigator.standalone === true);
const APP_ID = 'joia2.app.session'; // the installed app's key id, kept by browser tabs' cleanup
const ID = installed ? APP_ID : 'joia2.session';
const TOKEN = installed ? 'joia2.app.token' : 'joia2.token';
const LAST = 'joia2.last'; // when the app was last used, in ms
const IDLE = 5 * 60_000; // unused for longer than this, it locks
const tab = (() => {
	try {
		return installed ? localStorage : sessionStorage;
	} catch {
		return null; // storage blocked: every reload asks for the password again
	}
})();

// When the app was last used; without storage it never counts as idle (nothing survives a reload)
const used = () => tab?.setItem(LAST, String(Date.now()));
const idle = () => !installed && Boolean(tab) && Date.now() - Number(tab.getItem(LAST) ?? 0) > IDLE;

const HANDOFF = 'joia2.handoff';
const HANDOFF_PATH = '/__handoff/';

const setHandoff = (value, age) =>
	(document.cookie = `${HANDOFF}=${value}; Path=${HANDOFF_PATH}; Max-Age=${age}; Secure; SameSite=Strict`);
const dropHandoff = () => setHandoff('', 0);

// Resolves with what a promise gives, or null after some ms
const within = (ms, promise) => Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms, null))]);

// The browser's login, for an installed app without one of its own: { token, raw } or null.
// Only a service worker that answers /__handoff/ itself is trusted with it: an older one would pass
// the request, cookie included, on to the server.
async function takeHandoff() {
	const worker = (await within(5000, navigator.serviceWorker?.ready))?.active;
	if (!worker) return null;
	const { port1, port2 } = new MessageChannel();
	worker.postMessage('handoff?', [port2]);
	if (!(await within(2000, new Promise((resolve) => (port1.onmessage = () => resolve(true)))))) return null;

	const frame = Object.assign(document.createElement('iframe'), { hidden: true, src: HANDOFF_PATH });
	const cookies = within(
		5000,
		new Promise((resolve) =>
			addEventListener('message', function heard(e) {
				if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
				removeEventListener('message', heard);
				resolve(String(e.data));
			})
		)
	);
	document.body.append(frame);
	const cookie = (await cookies)?.split('; ').find((c) => c.startsWith(`${HANDOFF}=`));
	frame.remove();
	if (!cookie) return null;
	dropHandoff();
	try {
		const { token, key } = JSON.parse(decodeURIComponent(cookie.slice(HANDOFF.length + 1)));
		return { token, raw: Uint8Array.fromBase64(key) };
	} catch {
		return null;
	}
}

export const session = $state({ token: '', key: null, demo: false, restoring: Boolean(browser && (tab?.getItem(ID) || installed)) });

if (browser) {
	// Earlier versions could remember the token on the device; remove any copy left behind
	try {
		localStorage.removeItem('joia2.token');
	} catch {}
	restore();
	// Using the app keeps it unlocked; coming back to it after 5 minutes without use locks it. Checked
	// when the tab shows again and on the next touch or key, so no timer runs in the background.
	const check = () => {
		if (!session.token) return;
		if (idle()) lock();
		else used();
	};
	addEventListener('pointerdown', check, true);
	addEventListener('keydown', check, true);
	document.addEventListener('visibilitychange', () => (document.hidden ? session.token && used() : check()));
}

async function restore() {
	const id = tab?.getItem(ID);
	const token = tab?.getItem(TOKEN);
	try {
		if (!id || !token) {
			await deleteAllKeys(appId()); // left behind by closed tabs
			const handoff = installed && (await takeHandoff());
			if (handoff) unlock(handoff.token, await keyFromRaw(handoff.raw));
		}
		else if (idle()) lock();
		else {
			const key = await loadKey(id);
			if (key) Object.assign(session, { token, key });
		}
	} catch {
		// No IndexedDB here: the password is asked for again
	}
	session.restoring = false;
}

// The installed app's key id, if it is logged in: its key is never cleared by a tab
function appId() {
	try {
		return localStorage.getItem(APP_ID);
	} catch {
		return null;
	}
}

export function isUnlocked() {
	return session.demo || (session.token !== '' && session.key !== null);
}

export function startDemo() {
	session.demo = true;
}

// raw: the key's bytes, after typing the password; a browser leaves them for the installed app
export function unlock(token, key, raw) {
	Object.assign(session, { token, key });
	if (raw && !installed) setHandoff(encodeURIComponent(JSON.stringify({ token, key: raw.toBase64() })), 3600);
	if (!tab) return;
	const id = tab.getItem(ID) ?? crypto.randomUUID();
	tab.setItem(ID, id);
	tab.setItem(TOKEN, token);
	used();
	saveKey(id, key).catch(() => {});
}

export function lock() {
	session.token = '';
	session.key = null;
	session.demo = false;
	if (browser) dropHandoff();
	const id = tab?.getItem(ID);
	tab?.removeItem(ID);
	tab?.removeItem(TOKEN);
	tab?.removeItem(LAST);
	if (id) deleteKey(id).catch(() => {});
}

// Encrypted files in joia2data, using this session's token and key
export function read(path) {
	return readJSON(session.token, session.key, path);
}

export function write(path, value, sha) {
	return writeJSON(session.token, session.key, path, value, sha);
}

// Re-encrypts all data with a new password; this session then continues with the new key
export async function changePassword(current, next) {
	const { key, raw } = await changeVaultPassword(session.token, current, next);
	unlock(session.token, key, raw);
}
