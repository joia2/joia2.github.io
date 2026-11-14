<script>
	import Copy from '@lucide/svelte/icons/copy';
	import CopyCheck from '@lucide/svelte/icons/copy-check';
	import Files from '@lucide/svelte/icons/files';
	import Sheet from '#lib/Sheet.svelte';
	import { loan, plain } from '#lib/loan.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
	import { session } from '#lib/session.svelte.js';
	import { listFiles } from '#lib/github.js';

	let copied = $state(false);

	// The attachments the data lists: the costs' and the apartment's documents
	// What the repo's files/ folder holds, counted when opened: the attachments (files/<id>.json) and
	// all its files, the parts of large attachments included
	let stored = $state(null); // { files, parts }
	$effect(() => {
		if (!ui.rawOpen || session.demo) return;
		stored = null;
		listFiles(session.token)
			.then((state) => {
				const all = state.files.filter((f) => f.path.startsWith('files/'));
				stored = { files: all.filter((f) => /^files\/[^/.]+\.json$/.test(f.path)).length, parts: all.length };
			})
			.catch(() => {});
	});
	const plural = (n, word) => `${n ?? '…'} ${word}${n === 1 ? '' : 's'}`;

	async function copy() {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<Sheet title="data.json" bind:open={ui.rawOpen}>
	{#snippet after()}
		<span class="files">
			• <Files size={16} />{plural(session.demo ? 0 : stored?.files, 'file')}
			{#if !session.demo}({plural(stored?.parts, 'part')}){/if}
		</span>
	{/snippet}
	{#snippet actions()}
		<button type="button" class="icon-button" onclick={copy} aria-label="copy">
			{#if copied}<CopyCheck size={20} />{:else}<Copy size={20} />{/if}
		</button>
	{/snippet}
	<pre>{text}</pre>
</Sheet>

<style>
	.files {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		margin-left: 0.5rem;
		font-size: 0.8rem;
		font-weight: 400;
		color: var(--muted);
		vertical-align: middle;
	}
	pre {
		margin: 0;
		padding: 0.5rem 1.5rem 1.5rem;
		overflow: auto;
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.68rem;
		line-height: 1.45;
		tab-size: 2;
		white-space: pre-wrap; /* long lines wrap instead of scrolling sideways */
		overflow-wrap: anywhere;
	}
</style>
