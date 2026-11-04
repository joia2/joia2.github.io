<script>
	import CloudCheck from '@lucide/svelte/icons/cloud-check';
	import CloudUpload from '@lucide/svelte/icons/cloud-upload';
	import CloudAlert from '@lucide/svelte/icons/cloud-exclamation-point';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import { loan, save } from '#lib/loan.svelte.js';
	import { session } from '#lib/session.svelte.js';
</script>

<!-- Whether the loan data is saved to joia2data; always shown in the top bar while unlocked -->
<span class="status" aria-live="polite">
	{#if session.demo}
		demo · not saved
	{:else if loan.status === 'pending' || loan.status === 'saving'}
		<CloudUpload size={18} />saving…
	{:else if loan.status === 'error' && loan.data}
		<button class="error" onclick={save} title="{loan.error} Click to try saving again.">
			<CloudAlert size={18} />not saved
		</button>
	{:else if loan.data}
		<CloudCheck size={18} />saved
	{:else}
		<CloudDownload size={18} />loading…
	{/if}
</span>

<style>
	.status {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-right: 0.5rem;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.error {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		border: 0;
		font-size: 0.78rem;
		color: var(--error);
	}
</style>
