import { browser } from '$app/env';
import { readJSON, writeJSON } from '#lib/vault.js';

const TOKEN_STORAGE = 'joia2.token';

// The GitHub token may be remembered on this device. The encryption key only ever lives in memory,
// and the password itself is never kept: only the key made from it.
export const session = $state({ token: '', key: null, remember: false });

if (browser) {
	try {
		const saved = localStorage.getItem(TOKEN_STORAGE);
		if (saved) {
			session.token = saved;
			session.remember = true;
		}
	} catch {
		// Storage can be blocked (private mode); the token just won't be remembered
	}
}

export function isUnlocked() {
	return session.token !== '' && session.key !== null;
}

export function unlock(token, key, remember) {
	session.token = token;
	session.key = key;
	session.remember = remember;
	try {
		if (remember) localStorage.setItem(TOKEN_STORAGE, token);
		else localStorage.removeItem(TOKEN_STORAGE);
	} catch {
		// See above
	}
}

// Drops the key but keeps the token, so unlocking again only needs the password
export function lock() {
	session.key = null;
	if (!session.remember) session.token = '';
}

// Drops everything, including a remembered token
export function forget() {
	session.token = '';
	session.key = null;
	session.remember = false;
	try {
		localStorage.removeItem(TOKEN_STORAGE);
	} catch {
		// See above
	}
}

// Encrypted files in joia2data, using this session's token and key
export function read(path) {
	return readJSON(session.token, session.key, path);
}

export function write(path, value, sha) {
	return writeJSON(session.token, session.key, path, value, sha);
}
