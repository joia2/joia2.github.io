// Removes attachment files that data.json doesn't list: the parts of an upload that stopped
// halfway, or a removal that didn't finish. Run quietly after data.json is opened.
//
// Only files that were already there a week ago are removed, so an upload still going on (on
// another device, or one whose listing is waiting on a device to be saved) is never touched. The
// removal is one commit, made only if nothing was saved meanwhile; otherwise it waits for the next
// opening. It never changes data.json or any listed file.
import { listFiles, filesAt, commitFiles } from '#lib/github.js';

const GRACE = 7 * 24 * 60 * 60 * 1000;

// Every attachment id the data lists: the costs' and the apartment's
const listedIds = (data) => new Set([...(data.costs ?? []).flatMap((c) => c.files ?? []), ...(data.documents ?? [])].map((f) => f.id));

// files/<id>.json and files/<id>.<part>.json → id
const idOf = (path) => path.match(/^files\/([^/.]+)(?:\.\d+)?\.json$/)?.[1];

// Returns how many files were removed
export async function cleanUp(token, data, now = new Date()) {
	const listed = listedIds(data);
	const state = await listFiles(token);
	const unlisted = state.files.filter(({ path }) => idOf(path) && !listed.has(idOf(path)));
	if (!unlisted.length) return 0;
	const weekAgo = await filesAt(token, state.branch, new Date(now.getTime() - GRACE));
	const old = unlisted.filter(({ path }) => weekAgo.has(path));
	if (!old.length) return 0;
	await commitFiles(token, state, old.map(({ path }) => ({ path, remove: true })), 'Remove unused files');
	return old.length;
}
