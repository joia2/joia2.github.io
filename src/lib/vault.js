// Login and encrypted file access for joia2data, combining github.js and crypto.js
import { checkAccess, getFile, putFile } from '#lib/github.js';
import { createVault, openVault, encryptJSON, decryptJSON } from '#lib/crypto.js';
import { NeedsSetupError } from '#lib/errors.js';

const VAULT_FILE = 'salt.json';

// Returns the key, or throws TokenError, NeedsSetupError or WrongPasswordError
export async function login(token, password, vaultFile = VAULT_FILE) {
	// Both at once; checkAccess tells a missing salt.json apart from a repo the token can't see
	const [, file] = await Promise.all([checkAccess(token), getFile(token, vaultFile)]);
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
	return file && { value: await decryptJSON(key, file.text), sha: file.sha };
}

// Pass the sha from readJSON to update a file, or null to create one. Returns the new sha.
export async function writeJSON(token, key, path, value, sha) {
	return putFile(token, path, await encryptJSON(key, value), sha, `Save ${path}`);
}
