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
	// The parts of large files stored in the repo (files/<id>.<part>.json), counted when opened
	let parts = $state(null);
	$effect(() => {
		if (!ui.rawOpen || session.demo) return;
		parts = null;
		listFiles(session.token)
			.then((state) => (parts = state.files.filter((f) => /^files\/[^/]+\.\d+\.json$/.test(f.path)).length))
			.catch(() => {});
	});
	const files = $derived(loan.data ? [...(loan.data.costs ?? []).flatMap((c) => c.files ?? []), ...(loan.data.documents ?? [])].length : 0);

	// data.json as it is before encryption, indented with 2 spaces; follows edits while open
	const text = $derived(loan.data ? JSON.stringify(plain(), null, 2) : '');

	async function copy() {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<Sheet title="data.json" bind:open={ui.rawOpen}>
	{#snippet after()}
		<span class="files">
			• <Files size={16} />{files} file{files === 1 ? '' : 's'}
			{#if !session.demo}({parts ?? '…'} part{parts === 1 ? '' : 's'} total){/if}
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
