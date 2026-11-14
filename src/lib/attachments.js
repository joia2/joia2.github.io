// Files attached to the costs and the apartment (PDFs, images), kept in joia2data's files/ folder.
// Each is encrypted as bytes (crypto.js encryptBytes: 32 bytes more than the file), under a random
// id: the repo shows neither its name nor its type, which data.json (itself encrypted) keeps as
// { id, name, type, size, bin: true, parts }. A password change re-encrypts them with the rest.
//
// A file up to 8 MB is one file, files/<id>.bin; a larger one is cut into parts of 8 MB,
// files/<id>.1.bin, .2.bin… (parts: their number), as GitHub refuses very large requests.
//
// Files saved before (encrypted as text, files/<id>.json) are still read and removed, and are
// converted to this format when the app opens (Convert.svelte).
import { session } from '#lib/session.svelte.js';
import { getFile, getRawFile, getRawBytes, putFile, deleteFile } from '#lib/github.js';
import { encryptBytes, decryptBytes, decryptJSON } from '#lib/crypto.js';
import { binPaths } from '#lib/paths.js';

const PART = 8 * 1024 * 1024; // about 11 MB a request: GitHub's API wants the bytes as base64
export const MAX_SIZE = 200 * 1024 * 1024; // the whole file has to fit in a phone's memory twice

// Ten at a time: much faster than one after another, well within what GitHub allows
async function eachAtOnce(count, work) {
	let next = 0;
	const worker = async () => {
		for (let k = next++; k < count; k = next++) await work(k);
	};
	await Promise.all(Array.from({ length: Math.min(10, count) }, worker));
}

// Uploads a File (or Blob), under its name or another; returns what data.json keeps of it.
// onprogress(done, parts): after each part of a larger file
export async function upload(file, name = file.name, onprogress) {
	const id = crypto.randomUUID();
	const bytes = new Uint8Array(await file.arrayBuffer());
	const parts = bytes.length > PART ? Math.ceil(bytes.length / PART) : 0;
	const entry = { id, name, type: file.type, size: bytes.length, bin: true, ...(parts && { parts }) };
	const paths = binPaths(entry);
	for (const [k, path] of paths.entries()) {
		const chunk = parts ? bytes.subarray(k * PART, (k + 1) * PART) : bytes;
		await putFile(session.token, path, await encryptBytes(session.key, chunk), null, 'Add a file');
		if (parts) onprogress?.(k + 1, parts);
	}
	return entry;
}

// Returns the attachment as a Blob, decrypted
export async function download(f) {
	if (!f.bin) return downloadOld(f.id);
	const paths = binPaths(f);
	const chunks = new Array(paths.length);
	await eachAtOnce(paths.length, async (k) => (chunks[k] = await decryptBytes(session.key, await getRawBytes(session.token, paths[k]))));
	return new Blob(chunks, { type: f.type });
}

export async function remove(f) {
	const paths = f.bin ? binPaths(f) : await oldPaths(f.id);
	for (const path of paths) {
		const file = await getFile(session.token, path);
		if (file) await deleteFile(session.token, path, file.sha, 'Remove a file');
	}
}

// The format before: text, files/<id>.json holding { name, type, data } or { name, type, parts },
// with the parts in files/<id>.<k>.json as { data }; data in base64
const oldPath = (id, part) => `files/${id}${part ? `.${part}` : ''}.json`;
const readOld = async (path) => decryptJSON(session.key, await getRawFile(session.token, path));

async function downloadOld(id) {
	const { type, data, parts } = await readOld(oldPath(id));
	if (!parts) return new Blob([Uint8Array.fromBase64(data)], { type });
	const chunks = new Array(parts);
	await eachAtOnce(parts, async (k) => (chunks[k] = Uint8Array.fromBase64((await readOld(oldPath(id, k + 1))).data)));
	return new Blob(chunks, { type });
}

export async function oldPaths(id) {
	const { parts = 0 } = await readOld(oldPath(id)).catch(() => ({}));
	return [oldPath(id), ...Array.from({ length: parts }, (_, k) => oldPath(id, k + 1))];
}
