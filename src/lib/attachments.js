// Files attached to the costs and the apartment (PDFs, images), kept in joia2data's files/ folder,
// encrypted like loan.json with their name and type inside, so the repo shows neither. loan.json
// lists them as { id, name, type, size } (size in bytes). A password change re-encrypts them with the rest.
//
// A small file is one file: files/<random id>.json. A larger one is cut into parts of 2 MB, as
// GitHub refuses requests far below its 100 MB file limit (a whole 38 MB PDF failed):
// files/<id>.json holds its name, type and number of parts, files/<id>.1.json, .2.json… the parts.
// Each part is its own encrypted file, and a part's upload is small enough to go through.
import { session } from '#lib/session.svelte.js';
import { getFile, getRawFile, putFile, deleteFile } from '#lib/github.js';
import { encryptJSON, decryptJSON } from '#lib/crypto.js';

const PART = 2 * 1024 * 1024; // about 5 MB a request once encrypted
export const MAX_SIZE = 200 * 1024 * 1024; // the whole file has to fit in a phone's memory twice
const path = (id, part) => `files/${id}${part ? `.${part}` : ''}.json`;
const encrypt = (value) => encryptJSON(session.key, value);
const read = async (p) => decryptJSON(session.key, await getRawFile(session.token, p));

// Uploads a File, under its name or another; returns what loan.json keeps of it.
// onprogress(done, parts): after each part of a larger file
export async function upload(file, name = file.name, onprogress) {
	const id = crypto.randomUUID();
	const bytes = new Uint8Array(await file.arrayBuffer());
	const type = file.type;
	const size = bytes.length;
	if (bytes.length <= PART) {
		await putFile(session.token, path(id), await encrypt({ name, type, data: bytes.toBase64() }), null, 'Add a file');
		return { id, name, type, size };
	}
	// The parts first, one after another; the file that lists them last, so it never points to a
	// part that isn't there
	const parts = Math.ceil(bytes.length / PART);
	for (let k = 1; k <= parts; k++) {
		const data = bytes.subarray((k - 1) * PART, k * PART).toBase64();
		await putFile(session.token, path(id, k), await encrypt({ data }), null, 'Add a file');
		onprogress?.(k, parts);
	}
	await putFile(session.token, path(id), await encrypt({ name, type, parts }), null, 'Add a file');
	return { id, name, type, size };
}

// Returns the attachment as a Blob, decrypted
export async function download(id) {
	const { type, data, parts } = await read(path(id));
	if (!parts) return new Blob([Uint8Array.fromBase64(data)], { type });
	const chunks = [];
	for (let k = 1; k <= parts; k++) chunks.push(Uint8Array.fromBase64((await read(path(id, k))).data));
	return new Blob(chunks, { type });
}

export async function remove(id) {
	const { parts = 0 } = await read(path(id)).catch(() => ({}));
	for (const p of [path(id), ...Array.from({ length: parts }, (_, k) => path(id, k + 1))]) {
		const file = await getFile(session.token, p);
		if (file) await deleteFile(session.token, p, file.sha, 'Remove a file');
	}
}
