import { browser } from '$app/env';
import { readJSON, writeJSON, changePassword as changeVaultPassword } from '#lib/vault.js';

const TOKEN_STORAGE = 'joia2.token';

// The GitHub token may be remembered on this device. The encryption key only ever lives in memory,
// and the password itself is never kept: only the key made from it.
export const session = $state({ token: '', key: null, remember: false });

// Storage can be blocked (private mode); the token then just isn't remembered
function saveToken(token) {
	try {
		if (token) localStorage.setItem(TOKEN_STORAGE, token);
		else localStorage.removeItem(TOKEN_STORAGE);
	} catch {}
}

if (browser) {
	try {
		session.token = localStorage.getItem(TOKEN_STORAGE) ?? '';
	} catch {}
	session.remember = session.token !== '';
}

export function isUnlocked() {
	return session.token !== '' && session.key !== null;
}

export function unlock(token, key, remember) {
	Object.assign(session, { token, key, remember });
	saveToken(remember && token);
}

// Drops the key but keeps a remembered token, so unlocking again only needs the password
export function lock() {
	session.key = null;
	if (!session.remember) session.token = '';
}

// Drops everything, including a remembered token
export function forget() {
	session.remember = false;
	lock();
	saveToken(null);
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
	session.key = await changeVaultPassword(session.token, current, next);
}
