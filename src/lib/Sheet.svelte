<script>
	import X from '@lucide/svelte/icons/x';

	// A popup: a glass card over the dimmed page, closed with Escape, the × or a click outside.
	// actions: optional buttons next to the ×
	let { title, open = $bindable(false), actions, children } = $props();

	let dialog = $state();

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={() => (open = false)}
	onclick={(e) => e.target === dialog && dialog.close()}
>
	<div class="top">
		<h1>{title}</h1>
		{@render actions?.()}
		<button class="icon-button" onclick={() => dialog.close()} aria-label="close"><X size={22} /></button>
	</div>
	{@render children()}
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
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		backdrop-filter: saturate(180%) blur(20px);
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
</style>
