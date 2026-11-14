// Removes attachment files that data.json doesn't list: the parts of an upload that stopped
// halfway, or a removal that didn't finish. Run quietly after data.json is opened.
//
// Only files that were already there a day ago are removed, so an upload still going on is never
// touched. An edit waiting on a device to be saved may list a file removed meanwhile: that listing is
// dropped when the edit is saved (keepExisting). The
// removal is one commit, made only if nothing was saved meanwhile; otherwise it waits for the next
// opening. It never changes data.json or any listed file.
import { listFiles, filesAt, commitFiles } from '#lib/github.js';

const GRACE = 24 * 60 * 60 * 1000;

// Every attachment id the data lists: the costs' and the apartment's
const listedIds = (data) => new Set([...(data.costs ?? []).flatMap((c) => c.files ?? []), ...(data.documents ?? [])].map((f) => f.id));

// files/<id>.json and files/<id>.<part>.json → id
const idOf = (path) => path.match(/^files\/([^/.]+)(?:\.\d+)?\.json$/)?.[1];

// The data without attachments whose file isn't in the repo any more: for an edit saved late
export async function keepExisting(token, data) {
	const there = new Set((await listFiles(token)).files.map((f) => f.path));
	const exists = (f) => there.has(`files/${f.id}.json`);
	return {
		...data,
		...(data.costs && { costs: data.costs.map((c) => (c.files ? { ...c, files: c.files.filter(exists) } : c)) }),
		...(data.documents && { documents: data.documents.filter(exists) })
	};
}

// Returns how many files were removed
export async function cleanUp(token, data, now = new Date()) {
	const listed = listedIds(data);
	const state = await listFiles(token);
	const unlisted = state.files.filter(({ path }) => idOf(path) && !listed.has(idOf(path)));
	if (!unlisted.length) return 0;
	const dayAgo = await filesAt(token, state.branch, new Date(now.getTime() - GRACE));
	const old = unlisted.filter(({ path }) => dayAgo.has(path));
	if (!old.length) return 0;
	await commitFiles(token, state, old.map(({ path }) => ({ path, remove: true })), 'Remove unused files');
	return old.length;
}
