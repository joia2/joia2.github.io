<script>
	import Copy from '@lucide/svelte/icons/copy';
	import CopyCheck from '@lucide/svelte/icons/copy-check';
	import Sheet from '#lib/Sheet.svelte';
	import { loan, plain } from '#lib/loan.svelte.js';
	import { ui } from '#lib/ui.svelte.js';

	let copied = $state(false);

	// loan.json as it is before encryption, indented with 2 spaces; follows edits while open
	const text = $derived(loan.data ? JSON.stringify(plain(), null, 2) : '');

	async function copy() {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<Sheet title="loan.json" bind:open={ui.rawOpen}>
	{#snippet actions()}
		<button class="icon-button" onclick={copy} aria-label="copy">
			{#if copied}<CopyCheck size={20} />{:else}<Copy size={20} />{/if}
		</button>
	{/snippet}
	<pre>{text}</pre>
</Sheet>

<style>
	pre {
		margin: 0;
		padding: 0.5rem 1.5rem 1.5rem;
		overflow: auto;
		font-family: ui-monospace, 'SF Mono', Menlo, monospace;
		font-size: 0.8rem;
		line-height: 1.5;
		tab-size: 2;
	}
</style>
