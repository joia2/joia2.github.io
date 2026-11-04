// Reads and writes files in the private joia2data repo through GitHub's contents API
import { TokenError, NetworkError, ConflictError } from '#lib/errors.js';

const REPO = 'https://api.github.com/repos/joia2/joia2data';

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

async function httpError(response, what) {
	const { message } = await response.json().catch(() => ({}));
	return new Error(`${what} failed: ${response.status} ${message ?? ''}`.trim());
}

// 409: the file changed since it was read; 422: it was created or deleted meanwhile
function throwIfConflict(response, path) {
	if (response.status === 409 || response.status === 422) throw new ConflictError(path);
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
	if (!response.ok) throw await httpError(response, 'Checking joia2data');
}

// Returns { text, sha }, or null when the file doesn't exist
export async function getFile(token, path) {
	const response = await request(token, 'GET', contentsPath(path));
	if (response.status === 404) return null;
	if (!response.ok) throw await httpError(response, `Reading ${path}`);
	const { content, sha } = await response.json();
	return { text: new TextDecoder().decode(Uint8Array.fromBase64(content)), sha };
}

// Creates the file when sha is null, otherwise replaces that exact version. Returns the new sha.
export async function putFile(token, path, text, sha, message) {
	const response = await request(token, 'PUT', contentsPath(path), {
		message,
		content: new TextEncoder().encode(text).toBase64(),
		...(sha && { sha })
	});
	throwIfConflict(response, path);
	if (response.status === 403 || response.status === 404) {
		throw new TokenError('This token is not allowed to write to joia2data.');
	}
	if (!response.ok) throw await httpError(response, `Saving ${path}`);
	return (await response.json()).content.sha;
}

export async function deleteFile(token, path, sha, message) {
	const response = await request(token, 'DELETE', contentsPath(path), { message, sha });
	throwIfConflict(response, path);
	if (!response.ok) throw await httpError(response, `Deleting ${path}`);
}

// The lower-level Git API below changes many files in one commit, so a change is all or nothing

async function gitJSON(token, method, path, body) {
	const response = await request(token, method, path, body);
	if (!response.ok) throw await httpError(response, `${method} ${path}`);
	return response.json();
}

// Returns the current state of the default branch: { branch, head, tree, files: [{ path, sha }] }
export async function listFiles(token) {
	const { default_branch: branch } = await gitJSON(token, 'GET', '');
	const { object } = await gitJSON(token, 'GET', `/git/ref/heads/${branch}`);
	const tree = await gitJSON(token, 'GET', `/git/trees/${object.sha}?recursive=1`);
	if (tree.truncated) throw new Error('joia2data has too many files to list at once.');
	const files = tree.tree.filter((entry) => entry.type === 'blob').map(({ path, sha }) => ({ path, sha }));
	return { branch, head: object.sha, tree: tree.sha, files };
}

export async function getBlob(token, sha) {
	const { content } = await gitJSON(token, 'GET', `/git/blobs/${sha}`);
	return new TextDecoder().decode(Uint8Array.fromBase64(content));
}

// Writes { path: text } as one commit on top of state.head. Throws ConflictError if the branch
// moved since listFiles, instead of overwriting what changed meanwhile.
export async function commitFiles(token, { branch, head, tree: baseTree }, files, message) {
	const tree = await gitJSON(token, 'POST', '/git/trees', {
		base_tree: baseTree,
		tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content }))
	});
	const commit = await gitJSON(token, 'POST', '/git/commits', { message, tree: tree.sha, parents: [head] });
	const response = await request(token, 'PATCH', `/git/refs/heads/${branch}`, { sha: commit.sha });
	if (response.status === 422) throw new ConflictError('joia2data');
	if (!response.ok) throw await httpError(response, 'Saving the commit');
}
