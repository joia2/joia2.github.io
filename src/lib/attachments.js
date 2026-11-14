// Files attached to the costs (PDFs, images), each kept in joia2data as files/<random id>.json:
// encrypted like loan.json, its name and type inside, so the repo shows neither. loan.json lists
// them per cost as { id, name, type }. A password change re-encrypts them with the rest.
import { session } from '#lib/session.svelte.js';
import { getFile, getRawFile, putFile, deleteFile } from '#lib/github.js';
import { encryptJSON, decryptJSON } from '#lib/crypto.js';

export const MAX_SIZE = 10 * 1024 * 1024; // GitHub takes files up to 100 MB; an encrypted one is about 1.8 times larger
const path = (id) => `files/${id}.json`;

// Uploads a File; returns what loan.json keeps of it
export async function upload(file) {
	const id = crypto.randomUUID();
	const data = new Uint8Array(await file.arrayBuffer()).toBase64();
	const text = await encryptJSON(session.key, { name: file.name, type: file.type, data });
	await putFile(session.token, path(id), text, null, 'Add a file');
	return { id, name: file.name, type: file.type };
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
