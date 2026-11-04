// Login and encrypted file access for joia2data, combining github.js and crypto.js
import { checkAccess, getFile, putFile, listFiles, getBlob, commitFiles } from '#lib/github.js';
import { createVault, openVault, encryptJSON, decryptJSON, isEncryptedFile } from '#lib/crypto.js';
import { NeedsSetupError } from '#lib/errors.js';

const VAULT_FILE = 'salt.json';

const vaultText = (vault) => JSON.stringify(vault, null, '\t') + '\n';

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
	await putFile(token, vaultFile, vaultText(vault), null, 'Set encryption password');
	return key;
}

// Re-encrypts every encrypted file in salt.json's folder (and below) with a new password, together
// with a new salt.json, as one commit: either all files switch to the new password or none do.
// Unencrypted files are left alone. Throws WrongPasswordError for a wrong current password, and
// DecryptError if any encrypted file can't be opened, before anything is written. Returns the new key.
export async function changePassword(token, current, next, vaultFile = VAULT_FILE) {
	const state = await listFiles(token);
	const vaultEntry = state.files.find((file) => file.path === vaultFile);
	if (!vaultEntry) throw new NeedsSetupError();
	const oldKey = await openVault(JSON.parse(await getBlob(token, vaultEntry.sha)), current);

	const folder = vaultFile.slice(0, vaultFile.lastIndexOf('/') + 1);
	const candidates = state.files.filter(
		({ path }) => path !== vaultFile && path.startsWith(folder) && path.endsWith('.json')
	);
	const texts = await Promise.all(candidates.map(({ sha }) => getBlob(token, sha)));

	const { vault, key } = await createVault(next);
	const files = { [vaultFile]: vaultText(vault) };
	for (const [i, { path }] of candidates.entries()) {
		if (isEncryptedFile(texts[i])) files[path] = await encryptJSON(key, await decryptJSON(oldKey, texts[i]));
	}
	await commitFiles(token, state, files, 'Change encryption password');
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
