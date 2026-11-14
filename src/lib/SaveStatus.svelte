<script>
	import CloudCheck from '@lucide/svelte/icons/cloud-check';
	import CloudUpload from '@lucide/svelte/icons/cloud-upload';
	import CloudAlert from '@lucide/svelte/icons/cloud-exclamation-point';
	import CloudDownload from '@lucide/svelte/icons/cloud-download';
	import { loan, save, loadLoan, changedElsewhere } from '#lib/loan.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
	import { uploading } from '#lib/attachments.js';

	// What was saved on another device shows up by itself: checked when the app comes back to the
	// screen and every 5 seconds while it's on it (720 requests an hour, of GitHub's 5 000). Only when everything here is saved and no popup
	// with its own copy of the data (names, apartment, costs) is open and no upload is going on, so
	// nothing is ever lost.
	const quiet = () => !session.demo && loan.data && ['idle', 'saved'].includes(loan.status) && ui.view === 'home' && !uploading();
	// One check at a time: on a slow connection the next waits until the last has returned
	let checking = $state(false);
	async function check() {
		if (checking || document.visibilityState !== 'visible' || !quiet()) return;
		checking = true;
		try {
			if ((await changedElsewhere().catch(() => false)) && quiet()) await loadLoan();
		} finally {
			checking = false;
			left = 5;
		}
	}
	// The seconds until the next check, shown beside "saved": (5), (4)… counting while a check can run
	let left = $state(5);
	const tick = () => {
		if (checking || !quiet() || document.visibilityState !== 'visible') return void (left = 5);
		if (--left <= 0) check();
	};
	$effect(() => {
		const timer = setInterval(tick, 1_000);
		document.addEventListener('visibilitychange', check);
		return () => (clearInterval(timer), document.removeEventListener('visibilitychange', check));
	});
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
	{:else if loan.status === 'loading' && loan.data}
		<CloudDownload size={18} />loading…
	{:else if loan.data}
		<!-- Everything here is saved: a click fetches what was saved elsewhere since (another device) -->
		<button class="refresh" onclick={loadLoan} title="Saved. Click to get the latest data from joia2data.">
			<CloudCheck size={18} />saved{#if quiet()}<span class="left">({checking ? '…' : Math.max(1, left)})</span>{/if}
		</button>
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
	.refresh {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.6rem;
		border: 0;
		background: transparent;
		font-size: 0.78rem;
		color: var(--muted);
	}
	.left {
		min-width: 1.6em; /* the same width for every number, so "saved" doesn't move */
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
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
