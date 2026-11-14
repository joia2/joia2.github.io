// The clean-up of unused attachment files, against a small GitHub in memory
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { cleanUp, keepExisting } = await import('#lib/cleanup.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-14T12:00:00Z');

// commits: [{ date, files: [paths] }], oldest first; the last is the branch's head
function fakeGitHub(history, { moveBranchMeanwhile = false } = {}) {
	const commits = history.map((c, i) => ({ sha: `c${i}`, tree: `t${i}`, ...c }));
	let head = commits.at(-1);
	const treeOf = (sha) => commits.find((c) => c.tree === sha || c.sha === sha);
	globalThis.fetch = async (url, { method = 'GET', body } = {}) => {
		const path = url.replace('https://api.github.com/repos/joia2/joia2data', '');
		const data = body && JSON.parse(body);
		const reply = (status, json) => ({ status, ok: status < 300, json: async () => json });
		if (method === 'GET' && path === '') return reply(200, { default_branch: 'main' });
		if (method === 'GET' && path === '/git/ref/heads/main') return reply(200, { object: { sha: head.sha } });
		if (method === 'GET' && path.startsWith('/git/trees/')) {
			const c = treeOf(path.slice(11).split('?')[0]);
			return reply(200, { sha: c.tree, truncated: false, tree: c.files.map((p) => ({ path: p, sha: `b-${p}`, type: 'blob' })) });
		}
		if (method === 'GET' && path.startsWith('/commits?')) {
			const until = new Date(new URLSearchParams(path.slice(9)).get('until'));
			const found = commits.filter((c) => c.date <= until).at(-1);
			return reply(200, found ? [{ sha: found.sha, commit: { tree: { sha: found.tree } } }] : []);
		}
		if (method === 'POST' && path === '/git/trees') {
			const removed = new Set(data.tree.filter((e) => e.sha === null).map((e) => e.path));
			const c = { sha: `c${commits.length}`, tree: `t${commits.length}`, date: NOW, files: treeOf(data.base_tree).files.filter((p) => !removed.has(p)) };
			commits.push(c);
			return reply(201, { sha: c.tree });
		}
		if (method === 'POST' && path === '/git/commits') {
			const c = commits.find((x) => x.tree === data.tree);
			c.parent = data.parents[0];
			return reply(201, { sha: c.sha });
		}
		if (method === 'PATCH' && path === '/git/refs/heads/main') {
			if (moveBranchMeanwhile) return reply(422, { message: 'Update is not a fast forward' });
			const c = commits.find((x) => x.sha === data.sha);
			if (c.parent !== head.sha) return reply(422, {});
			head = c;
			return reply(200, {});
		}
		throw new Error(`unexpected ${method} ${path}`);
	};
	return () => head.files;
}

const data = { costs: [{ files: [{ id: 'kept' }] }], documents: [{ id: 'doc' }] };
const listed = ['salt.json', 'data.json', 'files/kept.json', 'files/doc.json', 'files/doc.1.json', 'files/doc.2.json'];

test('clean-up: removes unlisted files older than a week, parts included; keeps the rest', async () => {
	const now = fakeGitHub([
		{ date: new Date(NOW - 8 * DAY), files: [...listed, 'files/old.1.json', 'files/old.2.json', 'files/gone.json'] },
		{ date: new Date(NOW - 3 * DAY), files: [...listed, 'files/old.1.json', 'files/old.2.json', 'files/gone.json', 'files/new.1.json'] }
	]);
	assert.equal(await cleanUp('token', data, NOW), 3);
	assert.deepEqual(now(), [...listed, 'files/new.1.json']); // the recent one may be an upload going on
});

test('clean-up: nothing unlisted, nothing changes', async () => {
	const now = fakeGitHub([{ date: new Date(NOW - 10 * DAY), files: listed }]);
	assert.equal(await cleanUp('token', data, NOW), 0);
	assert.deepEqual(now(), listed);
});

test('clean-up: saved from elsewhere meanwhile, it gives up and changes nothing', async () => {
	const files = [...listed, 'files/old.json'];
	const now = fakeGitHub([{ date: new Date(NOW - 10 * DAY), files }], { moveBranchMeanwhile: true });
	await assert.rejects(cleanUp('token', data, NOW));
	assert.deepEqual(now(), files);
});

test('an edit saved late lists only files still there', async () => {
	fakeGitHub([{ date: new Date(NOW - 2 * DAY), files: listed }]);
	const late = { costs: [{ files: [{ id: 'kept' }, { id: 'removed' }] }, { entries: [] }], documents: [{ id: 'doc' }, { id: 'gone' }] };
	assert.deepEqual(await keepExisting('token', late), { costs: [{ files: [{ id: 'kept' }] }, { entries: [] }], documents: [{ id: 'doc' }] });
});

test('the new format (.bin): an unlisted one is removed, a listed one kept, parts included', async () => {
	const withBin = { ...data, documents: [...data.documents, { id: 'big', bin: true, parts: 2 }, { id: 'small', bin: true }] };
	const files = [...listed, 'files/big.1.bin', 'files/big.2.bin', 'files/small.bin', 'files/stray.bin', 'files/stray2.1.bin'];
	const now = fakeGitHub([{ date: new Date(NOW - 10 * DAY), files }]);
	assert.equal(await cleanUp('token', withBin, NOW), 2);
	assert.deepEqual(now(), files.filter((p) => !p.includes('stray')));
	const late = { documents: [{ id: 'big', bin: true, parts: 2 }, { id: 'small', bin: true }, { id: 'stray', bin: true }] };
	assert.deepEqual((await keepExisting('token', late)).documents.map((f) => f.id), ['big', 'small']);
});
