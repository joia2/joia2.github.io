<script>
	import Copy from '@lucide/svelte/icons/copy';
	import CopyCheck from '@lucide/svelte/icons/copy-check';
	import Files from '@lucide/svelte/icons/files';
	import Sheet from '#lib/Sheet.svelte';
	import { loan, plain } from '#lib/loan.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
	import { session } from '#lib/session.svelte.js';
	import { listPaths } from '#lib/github.js';
	import { idOf } from '#lib/paths.js';

	let copied = $state(false);

	// The attachments the data lists: the costs' and the apartment's documents
	// What the repo's files/ folder holds, counted when opened (one request): the attachments (files/<id>.json) and
	// all its files, the parts of large attachments included
	let stored = $state(null); // { files, parts }
	$effect(() => {
		if (!ui.rawOpen || session.demo) return;
		stored = null;
		listPaths(session.token)
			.then((paths) => {
				const all = paths.filter((p) => p.startsWith('files/'));
				stored = { files: new Set(all.map(idOf).filter(Boolean)).size, parts: all.length };
			})
			.catch(() => {});
	});
	// data.json as it is before encryption, indented with 2 spaces; follows edits while open
	const text = $derived(loan.data ? JSON.stringify(plain(), null, 2) : '');
	// Colored as in a code editor: keys, strings, numbers, true/false/null; the rest as it is
	const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
	const pieces = $derived.by(() => {
		const out = [];
		let at = 0;
		for (const m of text.matchAll(TOKEN)) {
			if (m.index > at) out.push({ text: text.slice(at, m.index) });
			if (m[1]) out.push({ text: m[1], kind: m[2] ? 'key' : 'string' }, ...(m[2] ? [{ text: m[2] }] : []));
			else out.push({ text: m[0], kind: m[3] ? 'number' : 'literal' });
			at = m.index + m[0].length;
		}
		if (at < text.length) out.push({ text: text.slice(at) });
		return out;
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
	<pre>{#each pieces as t, i (i)}{#if t.kind}<span class={t.kind}>{t.text}</span>{:else}{t.text}{/if}{/each}</pre>
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
		color: var(--muted); /* brackets, commas and colons */
	}
	.key {
		color: color-mix(in srgb, var(--cyan) 65%, var(--text));
	}
	.string {
		color: color-mix(in srgb, var(--mint) 70%, var(--text));
	}
	.number {
		color: #d9822b;
	}
	.literal {
		color: #a463d6;
	}
</style>
