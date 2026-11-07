// Encryption for joia2data, using only the browser's Web Crypto.
// The password becomes an AES-256-GCM key via PBKDF2-SHA256. One random salt, stored in
// salt.json together with an encrypted check value, is shared by all files, so the slow
// key derivation runs once per login.
import { WrongPasswordError, DecryptError } from '#lib/errors.js';

const ITERATIONS = 600_000; // OWASP recommendation for PBKDF2-SHA256
const CHECK = 'joia2'; // Known plaintext; decrypting it proves the password is right

const random = (length) => crypto.getRandomValues(new Uint8Array(length));

// Returns { key, raw }: the key can't be read back out, not even by this app; `raw` is its bytes,
// only for handing the login over to the installed app (session.svelte.js)
async function deriveKey(password, salt, iterations) {
	const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
		'deriveBits'
	]);
	const raw = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, 256));
	return { key: await keyFromRaw(raw), raw };
}

// The key from its bytes, unreadable again
export const keyFromRaw = (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

async function encrypt(key, text) {
	const iv = random(12); // Fresh for every encryption; reusing one with the same key breaks AES-GCM
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
	return { v: 1, iv: iv.toBase64(), data: new Uint8Array(data).toBase64() };
}

async function decrypt(key, envelope) {
	if (envelope?.v !== 1) throw new DecryptError();
	try {
		const iv = Uint8Array.fromBase64(envelope.iv);
		const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, Uint8Array.fromBase64(envelope.data));
		return new TextDecoder().decode(data);
	} catch {
		// AES-GCM rejects a wrong key and any change to the file the same way
		throw new DecryptError();
	}
}

// First use: makes the contents of salt.json and the key for this session ({ vault, key, raw })
export async function createVault(password) {
	const salt = random(16);
	const { key, raw } = await deriveKey(password, salt, ITERATIONS);
	const vault = {
		v: 1,
		kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: salt.toBase64() },
		check: await encrypt(key, CHECK)
	};
	return { vault, key, raw };
}

// Every login: checks the password against salt.json and returns { key, raw }, or throws
// WrongPasswordError
export async function openVault(vault, password) {
	const derived = await deriveKey(password, Uint8Array.fromBase64(vault.kdf.salt), vault.kdf.iterations);
	await decrypt(derived.key, vault.check).catch(() => {
		throw new WrongPasswordError();
	});
	return derived;
}

// Whether text is an encrypted file written by this app, whatever key it was made with
export function isEncryptedFile(text) {
	try {
		const { v, iv, data } = JSON.parse(text);
		return v === 1 && typeof iv === 'string' && typeof data === 'string';
	} catch {
		return false;
	}
}

// Returns the text of an encrypted file
export async function encryptJSON(key, value) {
	return JSON.stringify(await encrypt(key, JSON.stringify(value))) + '\n';
}

// Takes the text of an encrypted file; throws DecryptError if it isn't one or doesn't match the key
export async function decryptJSON(key, text) {
	let envelope;
	try {
		envelope = JSON.parse(text);
	} catch {
		// Not JSON: decrypt() rejects the missing envelope below
	}
	return JSON.parse(await decrypt(key, envelope));
}
