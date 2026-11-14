// Files attached to the costs (PDFs, images), each kept in joia2data as files/<random id>.json:
// encrypted like loan.json, its name and type inside, so the repo shows neither. loan.json lists
// them per cost as { id, name, type }. A password change re-encrypts them with the rest.
import { session } from '#lib/session.svelte.js';
import { getFile, getRawFile, putFile, deleteFile } from '#lib/github.js';
import { encryptJSON, decryptJSON } from '#lib/crypto.js';

// The largest file that can be kept: GitHub refuses files over 100 MB, and an encrypted one is
// written as text, about 16/9 of its size (base64 inside the encryption, and again around it).
// Anything smaller is tried; an error from GitHub is shown if it still can't be saved.
export const MAX_SIZE = Math.floor((100 * 1000 * 1000 * 9) / 16) - 1000;
const path = (id) => `files/${id}.json`;

// Uploads a File, under its name or another; returns what loan.json keeps of it
export async function upload(file, name = file.name) {
	const id = crypto.randomUUID();
	const data = new Uint8Array(await file.arrayBuffer()).toBase64();
	const text = await encryptJSON(session.key, { name, type: file.type, data });
	await putFile(session.token, path(id), text, null, 'Add a file');
	return { id, name, type: file.type };
}

// Returns the attachment as a Blob, decrypted
export async function download(id) {
	const { type, data } = await decryptJSON(session.key, await getRawFile(session.token, path(id)));
	return new Blob([Uint8Array.fromBase64(data)], { type });
}

export async function remove(id) {
	const file = await getFile(session.token, path(id));
	if (file) await deleteFile(session.token, path(id), file.sha, 'Remove a file');
}
