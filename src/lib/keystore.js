// The encryption key, kept in the browser's IndexedDB between reloads of a tab. IndexedDB stores the
// CryptoKey object itself, so the key stays unreadable: the app can use it, but nothing can read it
// out. Each tab's key is saved under a random id that only that tab knows (in sessionStorage).
const open = () =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open('joia2', 1);
		request.onupgradeneeded = () => request.result.createObjectStore('keys');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

// Runs one request on the 'keys' store and resolves with its result
async function run(mode, use) {
	const db = await open();
	return new Promise((resolve, reject) => {
		const request = use(db.transaction('keys', mode).objectStore('keys'));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	}).finally(() => db.close());
}

export const saveKey = (id, key) => run('readwrite', (store) => store.put({ key, at: Date.now() }, id));
export const loadKey = async (id) => (await run('readonly', (store) => store.get(id)))?.key ?? null;
export const deleteKey = (id) => run('readwrite', (store) => store.delete(id));

// Keys left behind by tabs that were closed: older than a day and not this tab's
export async function deleteOldKeys(keep) {
	const ids = await run('readonly', (store) => store.getAllKeys());
	const day = Date.now() - 86_400_000;
	for (const id of ids) {
		if (id === keep) continue;
		const entry = await run('readonly', (store) => store.get(id));
		if (!(entry?.at > day)) await deleteKey(id);
	}
}
