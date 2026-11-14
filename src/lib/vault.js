// Login and encrypted file access for joia2data, combining github.js and crypto.js
import { checkAccess, getFile, putFile, listFiles, getBlob, getBlobBytes, createBlob, commitFiles } from '#lib/github.js';
import { createVault, openVault, encryptJSON, decryptJSON, isEncryptedFile, encryptBytes, decryptBytes, isEncryptedBytes } from '#lib/crypto.js';
import { NeedsSetupError } from '#lib/errors.js';

const VAULT_FILE = 'salt.json';

const vaultText = (vault) => JSON.stringify(vault, null, '\t') + '\n';

// Returns { key, raw }, or throws TokenError, NeedsSetupError or WrongPasswordError
export async function login(token, password, vaultFile = VAULT_FILE) {
	// Both at once; checkAccess tells a missing salt.json apart from a repo the token can't see
	const [, file] = await Promise.all([checkAccess(token), getFile(token, vaultFile)]);
	if (!file) throw new NeedsSetupError();
	return openVault(JSON.parse(file.text), password);
}

// First use only: creates salt.json for this password and returns { key, raw }.
// Fails with ConflictError if salt.json already exists, so an existing password is never replaced.
export async function setup(token, password, vaultFile = VAULT_FILE) {
	await checkAccess(token);
	const { vault, key, raw } = await createVault(password);
	await putFile(token, vaultFile, vaultText(vault), null, 'Set encryption password');
	return { key, raw };
}

// Re-encrypts every encrypted file in salt.json's folder (and below): the .json ones (data.json) and
// the .bin ones (attachments, crypto.js encryptBytes), with a new password, together
// with a new salt.json. Safe at every step:
// - Nothing in the repo changes until the very end. Each file is read, decrypted with the old key,
//   encrypted with the new one, checked to open again to the same content, and stored as a blob
//   that no commit uses yet, one file at a time (so a large repo never has to fit in memory).
// - Then one commit puts all of them and the new salt.json in place, and the branch moves to it
//   in one step, only if it hasn't moved since the start: either everything switches to the new
//   password or nothing does. Stopped earlier (closed, offline, an error), the data is exactly as it
//   was, with the old password, and the change can simply be started again.
// - A wrong current password (WrongPasswordError) or a file that won't decrypt (DecryptError)
//   stops it before anything is written. Unencrypted files are left alone.
// onprogress(done, total): after each file. Returns the new { key, raw }.
export async function changePassword(token, current, next, vaultFile = VAULT_FILE, onprogress) {
	const state = await listFiles(token);
	const vaultEntry = state.files.find((file) => file.path === vaultFile);
	if (!vaultEntry) throw new NeedsSetupError();
	const { key: oldKey } = await openVault(JSON.parse(await getBlob(token, vaultEntry.sha)), current);

	const folder = vaultFile.slice(0, vaultFile.lastIndexOf('/') + 1);
	const candidates = state.files.filter(({ path }) => path !== vaultFile && path.startsWith(folder) && /\.(json|bin)$/.test(path));

	// The new salt.json must open with the new password, as the next login will do
	const { vault, key, raw } = await createVault(next);
	await openVault(vault, next);

	const entries = [{ path: vaultFile, text: vaultText(vault) }];
	onprogress?.(0, candidates.length);
	for (const [i, { path, sha }] of candidates.entries()) {
		const wrong = () => new Error(`${path} did not re-encrypt correctly. Nothing was changed.`);
		if (path.endsWith('.bin')) {
			const bytes = await getBlobBytes(token, sha);
			if (isEncryptedBytes(bytes)) {
				const plain = await decryptBytes(oldKey, bytes);
				const fresh = await encryptBytes(key, plain);
				const back = await decryptBytes(key, fresh);
				if (back.length !== plain.length || back.some((b, k) => b !== plain[k])) throw wrong();
				entries.push({ path, sha: await createBlob(token, fresh) });
			}
		} else {
			const text = await getBlob(token, sha);
			if (isEncryptedFile(text)) {
				const value = await decryptJSON(oldKey, text);
				const fresh = await encryptJSON(key, value);
				if (JSON.stringify(await decryptJSON(key, fresh)) !== JSON.stringify(value)) throw wrong();
				entries.push({ path, sha: await createBlob(token, fresh) });
			}
		}
		onprogress?.(i + 1, candidates.length);
	}
	await commitFiles(token, state, entries, 'Change encryption password');
	return { key, raw };
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
