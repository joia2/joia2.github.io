// Login and encrypted file access for joia2data, combining github.js and crypto.js
import { checkAccess, getFile, putFile } from '#lib/github.js';
import { createVault, openVault, encryptJSON, decryptJSON, DecryptError } from '#lib/crypto.js';

const VAULT_FILE = 'salt.json';

export class NeedsSetupError extends Error {
	name = 'NeedsSetupError';
	constructor() {
		super('joia2data has no encryption password yet.');
	}
}

// Returns the key, or throws TokenError, NeedsSetupError or WrongPasswordError
export async function login(token, password, vaultFile = VAULT_FILE) {
	await checkAccess(token);
	const file = await getFile(token, vaultFile);
	if (!file) throw new NeedsSetupError();
	return openVault(JSON.parse(file.text), password);
}

// First use only: creates salt.json for this password and returns the key.
// Fails with ConflictError if salt.json already exists, so an existing password is never replaced.
export async function setup(token, password, vaultFile = VAULT_FILE) {
	await checkAccess(token);
	const { vault, key } = await createVault(password);
	await putFile(token, vaultFile, JSON.stringify(vault, null, '\t') + '\n', null, 'Set encryption password');
	return key;
}

// Returns { value, sha }, or null when the file doesn't exist. Throws DecryptError for unreadable files.
export async function readJSON(token, key, path) {
	const file = await getFile(token, path);
	if (!file) return null;
	let envelope;
	try {
		envelope = JSON.parse(file.text);
	} catch {
		throw new DecryptError();
	}
	return { value: await decryptJSON(key, envelope), sha: file.sha };
}

// Pass the sha from readJSON to update a file, or null to create one. Returns the new sha.
export async function writeJSON(token, key, path, value, sha) {
	const envelope = await encryptJSON(key, value);
	return putFile(token, path, JSON.stringify(envelope) + '\n', sha, `Save ${path}`);
}
