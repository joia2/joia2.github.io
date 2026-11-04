import { browser } from '$app/env';
import { readJSON, writeJSON, changePassword as changeVaultPassword } from '#lib/vault.js';

// The token and the encryption key only live in memory, and only while unlocked: locking, closing
// or reloading the page drops both. Nothing is stored on the device, and the password itself is
// never kept, only the key made from it.
export const session = $state({ token: '', key: null });

// Earlier versions could remember the token on the device; remove any copy left behind
if (browser) {
	try {
		localStorage.removeItem('joia2.token');
	} catch {}
}

export function isUnlocked() {
	return session.token !== '' && session.key !== null;
}

export function unlock(token, key) {
	Object.assign(session, { token, key });
}

export function lock() {
	session.token = '';
	session.key = null;
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
