// Encryption for joia2data, using only the browser's Web Crypto.
// The password becomes an AES-256-GCM key via PBKDF2-SHA256. One random salt, stored in
// salt.json together with an encrypted check value, is shared by all files, so the slow
// key derivation runs once per login.

const ITERATIONS = 600_000; // OWASP recommendation for PBKDF2-SHA256
const CHECK = 'joia2'; // Known plaintext; decrypting it proves the password is right

export class WrongPasswordError extends Error {
	constructor() {
		super('Wrong encryption password');
		this.name = 'WrongPasswordError';
	}
}

export class DecryptError extends Error {
	constructor() {
		super('This file could not be decrypted. It may have been changed or damaged.');
		this.name = 'DecryptError';
	}
}

export function toBase64(bytes) {
	const all = new Uint8Array(bytes);
	let text = '';
	// In chunks: spreading a large file into one call overflows the stack
	for (let i = 0; i < all.length; i += 0x8000) text += String.fromCharCode(...all.subarray(i, i + 0x8000));
	return btoa(text);
}

export function fromBase64(text) {
	return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function random(length) {
	return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveKey(password, salt, iterations) {
	const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
		'deriveKey'
	]);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		material,
		{ name: 'AES-GCM', length: 256 },
		false, // The raw key can never be read back out, not even by this app
		['encrypt', 'decrypt']
	);
}

async function encryptText(key, text) {
	const iv = random(12); // Fresh for every encryption; reusing one with the same key breaks AES-GCM
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
	return { v: 1, iv: toBase64(iv), data: toBase64(data) };
}

async function decryptText(key, envelope) {
	if (envelope?.v !== 1) throw new DecryptError();
	try {
		const data = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromBase64(envelope.iv) },
			key,
			fromBase64(envelope.data)
		);
		return new TextDecoder().decode(data);
	} catch {
		// AES-GCM rejects a wrong key and any change to the file the same way
		throw new DecryptError();
	}
}

// First use: makes the contents of salt.json and the key for this session
export async function createVault(password) {
	const salt = random(16);
	const key = await deriveKey(password, salt, ITERATIONS);
	const vault = {
		v: 1,
		kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: toBase64(salt) },
		check: await encryptText(key, CHECK)
	};
	return { vault, key };
}

// Every login: checks the password against salt.json and returns the key, or throws WrongPasswordError
export async function openVault(vault, password) {
	const key = await deriveKey(password, fromBase64(vault.kdf.salt), vault.kdf.iterations);
	try {
		if ((await decryptText(key, vault.check)) === CHECK) return key;
	} catch {
		// Falls through to the error below
	}
	throw new WrongPasswordError();
}

export async function encryptJSON(key, value) {
	return encryptText(key, JSON.stringify(value));
}

export async function decryptJSON(key, envelope) {
	return JSON.parse(await decryptText(key, envelope));
}
