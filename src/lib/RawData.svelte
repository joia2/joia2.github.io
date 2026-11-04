<script>
	import X from '@lucide/svelte/icons/x';
	import Copy from '@lucide/svelte/icons/copy';
	import CopyCheck from '@lucide/svelte/icons/copy-check';
	import { loan, plain } from '#lib/loan.svelte.js';
	import { ui } from '#lib/ui.svelte.js';

	let dialog = $state();
	let copied = $state(false);

	// loan.json as it is before encryption, indented with 2 spaces; follows edits while open
	const text = $derived(loan.data ? JSON.stringify(plain(), null, 2) : '');

	$effect(() => {
		if (ui.rawOpen && !dialog.open) dialog.showModal();
		if (!ui.rawOpen && dialog.open) dialog.close();
	});

	async function copy() {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<!-- Escape and the close button both close it -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	aria-label="loan.json"
	onclose={() => (ui.rawOpen = false)}
	onclick={(e) => e.target === dialog && dialog.close()}
>
	<div class="top">
		<h1>loan.json</h1>
		<button class="icon" onclick={copy} aria-label="copy">
			{#if copied}<CopyCheck size={20} />{:else}<Copy size={20} />{/if}
		</button>
		<button class="icon" onclick={() => dialog.close()} aria-label="close">
			<X size={22} />
		</button>
	</div>
	<pre>{text}</pre>
</dialog>

<style>
	dialog {
		width: min(40rem, calc(100vw - 32px));
		max-height: min(42rem, calc(100vh - 64px));
		box-sizing: border-box;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		background: color-mix(in srgb, var(--surface) 80%, transparent);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		box-shadow: var(--shadow);
		color: var(--text);
	}
	dialog[open] {
		display: flex;
		flex-direction: column;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.3);
	}
	.top {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.75rem 0.75rem 0.5rem 1.5rem;
	}
	h1 {
		flex: 1;
		font-size: 1.1rem;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
	}
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
