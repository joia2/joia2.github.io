import { browser } from '$app/env';

const TOKEN_STORAGE = 'joia2.token';

// The GitHub token may be remembered on this device; the encryption key only ever lives in memory
export const session = $state({ token: '', key: '', remember: false });

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
	return session.token !== '' && session.key !== '';
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

// Drops the key but keeps the token, so unlocking again only needs the key
export function lock() {
	session.key = '';
	if (!session.remember) session.token = '';
}

// Drops everything, including a remembered token
export function forget() {
	session.token = '';
	session.key = '';
	session.remember = false;
	try {
		localStorage.removeItem(TOKEN_STORAGE);
	} catch {
		// See above
	}
}
