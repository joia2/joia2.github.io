// The password change against a small GitHub in memory: it must switch every encrypted file to
// the new password at once, or leave everything exactly as it was.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Node 22 has no Uint8Array base64 helpers yet; the browsers the app runs in do
Uint8Array.fromBase64 ??= (text) => new Uint8Array(Buffer.from(text, 'base64'));
Uint8Array.prototype.toBase64 ??= function () {
	return Buffer.from(this).toString('base64');
};

const { changePassword } = await import('#lib/vault.js');
const { createVault, openVault, encryptJSON, decryptJSON } = await import('#lib/crypto.js');
const { WrongPasswordError, ConflictError, DecryptError } = await import('#lib/errors.js');

// A repo: blobs by sha, trees (path → blob sha) by sha, commits by sha, and the branch's head
function fakeGitHub(files, { failBlobsFrom = Infinity, moveBranchMeanwhile = false } = {}) {
	let n = 0;
	const id = () => `sha${++n}`;
	const blobs = new Map();
	const trees = new Map();
	const commits = new Map();
	const tree = {};
	for (const [path, text] of Object.entries(files)) blobs.set((tree[path] = id()), text);
	const firstTree = id();
	trees.set(firstTree, tree);
	let head = id();
	commits.set(head, { tree: firstTree });
	let blobsCreated = 0;

	globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
		const path = url.replace('https://api.github.com/repos/joia2/joia2data', '');
		const data = body && JSON.parse(body);
		const reply = (status, json) => ({ status, ok: status < 300, json: async () => json });
		if (method === 'GET' && path === '') return reply(200, { default_branch: 'main' });
		if (method === 'GET' && path === '/git/ref/heads/main') return reply(200, { object: { sha: head } });
		if (method === 'GET' && path.startsWith('/git/trees/')) {
			let sha = path.slice(11).split('?')[0];
			if (commits.has(sha)) sha = commits.get(sha).tree; // a commit is read as its tree, as GitHub does
			return reply(200, { sha, truncated: false, tree: Object.entries(trees.get(sha)).map(([p, s]) => ({ path: p, sha: s, type: 'blob' })) });
		}
		if (method === 'GET' && path.startsWith('/git/blobs/')) return reply(200, { content: Buffer.from(blobs.get(path.slice(11))).toString('base64') });
		if (method === 'POST' && path === '/git/blobs') {
			if (++blobsCreated >= failBlobsFrom) throw new TypeError('offline');
			const sha = id();
			blobs.set(sha, data.content);
			return reply(201, { sha });
		}
		if (method === 'POST' && path === '/git/trees') {
			const next = { ...trees.get(data.base_tree) };
			for (const e of data.tree) {
				if (e.content !== undefined) blobs.set((next[e.path] = id()), e.content);
				else next[e.path] = e.sha;
			}
			const sha = id();
			trees.set(sha, next);
			return reply(201, { sha });
		}
		if (method === 'POST' && path === '/git/commits') {
			const sha = id();
			commits.set(sha, { tree: data.tree, parent: data.parents[0] });
			return reply(201, { sha });
		}
		if (method === 'PATCH' && path === '/git/refs/heads/main') {
			if (moveBranchMeanwhile) {
				// another device saved in between (here the same files, in a commit of its own)
				const other = id();
				commits.set(other, { tree: commits.get(head).tree, parent: head });
				head = other;
			}
			if (commits.get(data.sha).parent !== head) return reply(422, { message: 'Update is not a fast forward' });
			head = data.sha;
			return reply(200, {});
		}
		throw new Error(`unexpected ${method} ${path}`);
	};
	// The files at the branch's head, as texts
	return () => Object.fromEntries(Object.entries(trees.get(commits.get(head).tree)).map(([p, s]) => [p, blobs.get(s)]));
}

async function repo() {
	const { vault, key } = await createVault('old');
	const files = {
		'salt.json': JSON.stringify(vault),
		'loan.json': await encryptJSON(key, { total: 8770310, names: { cyan: 'John', mint: 'Iago' } }),
		'files/a.json': await encryptJSON(key, { name: 'receipt.pdf', type: 'application/pdf', data: 'JVBERi0x' }),
		'files/b.json': await encryptJSON(key, { name: 'big.pdf', type: 'application/pdf', parts: 2 }),
		'files/b.1.json': await encryptJSON(key, { data: 'AAAA' }),
		'files/b.2.json': await encryptJSON(key, { data: 'BBBB' }),
		'notes.json': '{"plain": true}\n',
		'README.md': 'hello\n'
	};
	return files;
}
const values = async (files, password) => {
	const { key } = await openVault(JSON.parse(files['salt.json']), password);
	const out = {};
	for (const p of ['loan.json', 'files/a.json', 'files/b.json', 'files/b.1.json', 'files/b.2.json']) out[p] = await decryptJSON(key, files[p]);
	return out;
};

test('password change: every encrypted file opens with the new password, the same content; the rest untouched', async () => {
	const before = await repo();
	const now = fakeGitHub(before);
	const steps = [];
	await changePassword('token', 'old', 'new', undefined, (done, total) => steps.push(`${done}/${total}`));
	const after = now();
	assert.deepEqual(await values(after, 'new'), await values(before, 'old'));
	await assert.rejects(openVault(JSON.parse(after['salt.json']), 'old'), WrongPasswordError);
	assert.equal(after['notes.json'], before['notes.json']);
	assert.equal(after['README.md'], before['README.md']);
	assert.deepEqual(steps, ['0/6', '1/6', '2/6', '3/6', '4/6', '5/6', '6/6']);
});

test('password change: a wrong current password changes nothing', async () => {
	const before = await repo();
	const now = fakeGitHub(before);
	await assert.rejects(changePassword('token', 'wrong', 'new'), WrongPasswordError);
	assert.deepEqual(now(), before);
});

test('password change: stopped halfway (offline) changes nothing; the old password still opens all', async () => {
	const before = await repo();
	const now = fakeGitHub(before, { failBlobsFrom: 3 });
	await assert.rejects(changePassword('token', 'old', 'new'));
	assert.deepEqual(now(), before);
	assert.deepEqual(await values(now(), 'old'), await values(before, 'old'));
});

test('password change: saved from elsewhere meanwhile, nothing is overwritten', async () => {
	const before = await repo();
	const now = fakeGitHub(before, { moveBranchMeanwhile: true });
	await assert.rejects(changePassword('token', 'old', 'new'), ConflictError);
	assert.deepEqual(now(), before);
});

test('password change: a damaged file stops it before anything is written', async () => {
	const before = await repo();
	const damaged = JSON.parse(before['files/a.json']);
	damaged.data = damaged.data.replace(/^./, (c) => (c === 'A' ? 'B' : 'A'));
	before['files/a.json'] = JSON.stringify(damaged);
	const now = fakeGitHub(before);
	await assert.rejects(changePassword('token', 'old', 'new'), DecryptError);
	assert.deepEqual(now(), before);
});
