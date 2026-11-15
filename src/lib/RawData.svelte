<script>
	import Copy from '@lucide/svelte/icons/copy';
	import CopyCheck from '@lucide/svelte/icons/copy-check';
	import Files from '@lucide/svelte/icons/files';
	import Search from '@lucide/svelte/icons/search';
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
	// Search: every match marked, the current one scrolled to while typing; Enter goes to the next
	let query = $state('');
	let current = $state(0);
	let count = $state(0);
	let pre = $state();
	const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const find = $derived(query.trim() && new RegExp(`(${escape(query.trim())})`, 'gi'));
	// A piece's text cut at the matches: the odd ones are matches
	const cut = (s) => (find ? s.split(find) : [s]);
	$effect(() => {
		find; // when the search changes, back to its first match
		current = 0;
	});
	$effect(() => {
		pieces, find, current;
		const marks = pre ? [...pre.querySelectorAll('mark')] : [];
		count = marks.length;
		marks.forEach((m, i) => m.classList.toggle('current', i === current % count));
		const mark = marks[current % count];
		if (mark) pre.scrollTop = mark.offsetTop - pre.clientHeight / 2;
	});
	function next(e) {
		if (e.key !== 'Enter' || !count) return;
		e.preventDefault();
		current = (current + (e.shiftKey ? count - 1 : 1)) % count;
	}

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
	{#snippet marked(text)}{#each cut(text) as s, k (k)}{#if k % 2}<mark>{s}</mark>{:else}{s}{/if}{/each}{/snippet}
	<pre bind:this={pre}>{#each pieces as t, i (i)}{#if t.kind}<span class={t.kind}>{@render marked(t.text)}</span>{:else}{@render marked(t.text)}{/if}{/each}</pre>
	<label class="search">
		<Search size={16} />
		<input type="search" bind:value={query} onkeydown={next} placeholder="search…" aria-label="search the data" autocomplete="off" />
		{#if find}<span class="count">{count ? `${(current % count) + 1}/${count}` : '0'}</span>{/if}
	</label>
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
		position: relative; /* the matches' offsetTop counts from here */
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
	mark {
		border-radius: 3px;
		background: color-mix(in srgb, #ffd60a 35%, transparent);
		color: inherit;
	}
	mark:global(.current) {
		background: #ffd60a;
		color: #000;
	}
	/* Always at the bottom, under the text that scrolls */
	.search {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 1rem 1rem;
		padding: 0.35rem 0.75rem;
		border-radius: 980px;
		background: color-mix(in srgb, var(--muted) 12%, transparent);
		color: var(--muted);
	}
	.search input {
		flex: 1;
		min-width: 0;
		padding: 0.2rem 0;
		border: 0;
		background: none;
		font-size: 16px; /* no zooming in on an iPhone */
		color: var(--text);
		outline: none;
	}
	.count {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
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
