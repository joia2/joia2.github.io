<script>
	import Sheet from '#lib/Sheet.svelte';
	import { loan, changed, save, hasUnsavedChanges } from '#lib/loan.svelte.js';
	import { session } from '#lib/session.svelte.js';
	import { download, upload, oldPaths } from '#lib/attachments.js';
	import { listFiles, commitFiles } from '#lib/github.js';

	// Attachments saved before the binary format (attachments.js) are converted when the app opens,
	// one at a time, with this popup showing how far it is. Safe at every step:
	// - each is downloaded and decrypted, uploaded again in the new format under a new id, read back
	//   and compared byte by byte, and only then is data.json changed to point to the new one, and saved;
	// - the old files are removed only after that, all in one step;
	// - stopped anywhere (closed, offline), nothing listed is lost: what was converted stays
	//   converted, the rest goes on at the next opening. An upload left without its listing is
	//   removed by the clean-up later (cleanup.js).

	// Every list of attachments in the data
	const lists = () => [...(loan.data.costs ?? []).map((c) => c.files ?? []), loan.data.documents ?? []];
	const old = () => lists().flatMap((list) => list.filter((f) => f.id && !f.bin));

	let open = $state(false);
	let done = $state(0);
	let total = $state(0);
	let error = $state('');
	let running = false;
	let failed = false; // tried again only at the next opening

	async function run() {
		if (running) return;
		running = true;
		error = '';
		const todo = old().map((f) => ({ ...f }));
		total = todo.length;
		done = 0;
		const converted = [];
		try {
			for (const f of todo) {
				// Converted, then read back and compared byte by byte before anything points to it
				const original = await download(f);
				const fresh = await upload(original, f.name);
				const [a, b] = await Promise.all([original, await download(fresh)].map(async (x) => new Uint8Array(await x.arrayBuffer())));
				if (a.length !== b.length || a.some((byte, k) => byte !== b[k])) throw new Error(`${f.name} did not convert correctly`);
				for (const list of lists()) {
					const i = list.findIndex((x) => x.id === f.id);
					if (i >= 0) list[i] = fresh;
				}
				changed();
				await save();
				if (hasUnsavedChanges()) throw new Error(loan.error || 'the data could not be saved');
				converted.push(f.id);
				done++;
			}
			// The old files, all in one step (nothing lists them any more); tried again if something
			// else was saved at that moment (the clean-up, say)
			const paths = (await Promise.all(converted.map(oldPaths))).flat();
			for (let attempt = 1; ; attempt++) {
				try {
					const state = await listFiles(session.token);
					const there = new Set(state.files.map((x) => x.path));
					const gone = paths.filter((p) => there.has(p)).map((path) => ({ path, remove: true }));
					if (gone.length) await commitFiles(session.token, state, gone, 'Remove files converted to the new format');
					break;
				} catch (e) {
					if (attempt === 3) throw e;
					await new Promise((wait) => setTimeout(wait, 2000));
				}
			}
			open = false;
		} catch (e) {
			failed = true;
			error = `${e.message}. What was converted is kept; the rest is tried again at the next opening.`;
		} finally {
			running = false;
		}
	}

	// Once the data is loaded and saved, when anything is in the old format
	$effect(() => {
		if (session.demo || !loan.data || !['idle', 'saved'].includes(loan.status) || running || failed) return;
		if (old().length) ((open = true), run());
	});
</script>

<Sheet title="updating files" bind:open>
	<div class="convert">
		<p>Your attachments are being moved to a smaller format: the same encryption, about 45% less space.</p>
		<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={done}>
			<span style:width="{total ? (done / total) * 100 : 0}%"></span>
		</div>
		<p class="count">{done} / {total}</p>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{:else}
			<p class="note">Keep the app open until it's done. If it stops, nothing is lost: it goes on next time.</p>
		{/if}
	</div>
</Sheet>

<style>
	.convert {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0 1.5rem 1.5rem;
		font-size: 0.9rem;
	}
	p {
		margin: 0;
	}
	.bar {
		height: 10px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--border) 60%, transparent);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--cyan), var(--mint));
		transition: width 0.3s;
	}
	.count {
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}
	.note {
		font-size: 0.8rem;
		color: var(--muted);
	}
	.error {
		font-size: 0.85rem;
		color: var(--error);
	}
</style>
