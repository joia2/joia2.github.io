import { browser } from '$app/env';
import { readJSON, writeJSON, changePassword as changeVaultPassword } from '#lib/vault.js';
import { saveKey, loadKey, deleteKey, deleteAllKeys } from '#lib/keystore.js';

// While unlocked, a reload of the tab stays unlocked; closing the tab or locking ends it. The token
// lives in this tab's sessionStorage, which the browser clears when the tab closes. The key is in
// IndexedDB, unreadable, under an id kept beside the token; a tab that starts without a login deletes
// every saved key, so none outlives its tab for long. The password itself is never kept, only the key
// made from it.
// demo: example data kept only in memory, opened from the login screen without a token
// restoring: true while a reload looks for this tab's saved login
const ID = 'joia2.session';
const TOKEN = 'joia2.token';
const tab = (() => {
	try {
		return sessionStorage;
	} catch {
		return null; // storage blocked: every reload asks for the password again
	}
})();

export const session = $state({ token: '', key: null, demo: false, restoring: Boolean(browser && tab?.getItem(ID)) });

if (browser) {
	// Earlier versions could remember the token on the device; remove any copy left behind
	try {
		localStorage.removeItem('joia2.token');
	} catch {}
	restore();
}

async function restore() {
	const id = tab?.getItem(ID);
	const token = tab?.getItem(TOKEN);
	try {
		if (!id || !token) await deleteAllKeys(); // left behind by closed tabs
		else {
			const key = await loadKey(id);
			if (key) Object.assign(session, { token, key });
		}
	} catch {
		// No IndexedDB here: the password is asked for again
	}
	session.restoring = false;
}

export function isUnlocked() {
	return session.demo || (session.token !== '' && session.key !== null);
}

export function startDemo() {
	session.demo = true;
}

export function unlock(token, key) {
	Object.assign(session, { token, key });
	if (!tab) return;
	const id = tab.getItem(ID) ?? crypto.randomUUID();
	tab.setItem(ID, id);
	tab.setItem(TOKEN, token);
	saveKey(id, key).catch(() => {});
}

export function lock() {
	session.token = '';
	session.key = null;
	session.demo = false;
	const id = tab?.getItem(ID);
	tab?.removeItem(ID);
	tab?.removeItem(TOKEN);
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
	unlock(session.token, await changeVaultPassword(session.token, current, next));
}
