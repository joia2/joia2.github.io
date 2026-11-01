// Reads and writes files in the private joia2data repo through GitHub's contents API
import { toBase64, fromBase64 } from '#lib/crypto.js';

const REPO = 'https://api.github.com/repos/joia2/joia2data';

export class TokenError extends Error {
	name = 'TokenError';
}

export class NetworkError extends Error {
	name = 'NetworkError';
	constructor() {
		super("Can't reach GitHub. Check your connection.");
	}
}

export class ConflictError extends Error {
	name = 'ConflictError';
	constructor(path) {
		super(`${path} was changed somewhere else. Reload it before saving.`);
	}
}

async function request(token, method, path, body) {
	let response;
	try {
		response = await fetch(REPO + path, {
			method,
			cache: 'no-store', // GitHub allows caching reads for 60 s, which would hide our own writes
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28'
			},
			body: body && JSON.stringify(body)
		});
	} catch {
		throw new NetworkError();
	}
	if (response.status === 401) throw new TokenError('This token is not valid or has expired.');
	return response;
}

async function fail(response, what) {
	const { message } = await response.json().catch(() => ({}));
	return new Error(`${what} failed: ${response.status} ${message ?? ''}`.trim());
}

function contentsPath(path) {
	return '/contents/' + path.split('/').map(encodeURIComponent).join('/');
}

// Throws TokenError unless the token can see joia2data
export async function checkAccess(token) {
	const response = await request(token, 'GET', '');
	if (response.status === 403 || response.status === 404) {
		throw new TokenError('This token has no access to joia2data.');
	}
	if (!response.ok) throw await fail(response, 'Checking joia2data');
}

// Returns { text, sha }, or null when the file doesn't exist
export async function getFile(token, path) {
	const response = await request(token, 'GET', contentsPath(path));
	if (response.status === 404) return null;
	if (!response.ok) throw await fail(response, `Reading ${path}`);
	const { content, sha } = await response.json();
	return { text: new TextDecoder().decode(fromBase64(content.replace(/\n/g, ''))), sha };
}

// Creates the file when sha is null, otherwise replaces that exact version. Returns the new sha.
export async function putFile(token, path, text, sha, message) {
	const response = await request(token, 'PUT', contentsPath(path), {
		message,
		content: toBase64(new TextEncoder().encode(text)),
		...(sha && { sha })
	});
	// 409: the file changed since it was read; 422: it was created meanwhile
	if (response.status === 409 || response.status === 422) throw new ConflictError(path);
	if (response.status === 403 || response.status === 404) {
		throw new TokenError('This token is not allowed to write to joia2data.');
	}
	if (!response.ok) throw await fail(response, `Saving ${path}`);
	return (await response.json()).content.sha;
}

export async function deleteFile(token, path, sha, message) {
	const response = await request(token, 'DELETE', contentsPath(path), { message, sha });
	if (response.status === 409 || response.status === 422) throw new ConflictError(path);
	if (!response.ok) throw await fail(response, `Deleting ${path}`);
}
