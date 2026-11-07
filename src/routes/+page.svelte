<script>
	import { untrack } from 'svelte';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Unlock from '#lib/Unlock.svelte';
	import ChangePassword from '#lib/ChangePassword.svelte';
	import Loan from '#lib/Loan.svelte';
	import LoanSettings from '#lib/LoanSettings.svelte';
	import { isUnlocked, session } from '#lib/session.svelte.js';
	import { loan, loadLoan, unloadLoan, hasUnsavedChanges } from '#lib/loan.svelte.js';
	import { ui } from '#lib/ui.svelte.js';

	const home = () => (ui.view = 'home');

	// The loan file is read after login and dropped from memory when the app locks
	$effect(() => {
		const unlocked = isUnlocked();
		untrack(() => {
			if (!unlocked) unloadLoan();
			else if (!loan.data && loan.status === 'idle') loadLoan();
		});
	});
</script>

<svelte:head>
	<title>joia2</title>
</svelte:head>

<!-- Asks before closing the page while an edit isn't saved yet -->
<svelte:window onbeforeunload={(e) => hasUnsavedChanges() && e.preventDefault()} />

{#if session.restoring}
	<p class="loading"><LoaderCircle size={24} class="spin" /></p>
{:else if !isUnlocked()}
	<Unlock />
{:else if ui.view === 'password'}
	<ChangePassword onclose={home} />
{:else if !loan.data}
	<p class="loading">
		{#if loan.status === 'error'}
			{loan.error} <button onclick={loadLoan}>try again</button>
		{:else}
			<LoaderCircle size={24} class="spin" />
		{/if}
	</p>
{:else if ui.view === 'home'}
	<Loan />
{:else}
	<LoanSettings section={ui.view} onclose={home} />
{/if}

<style>
	.loading {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.75rem;
		padding-top: 3rem;
		color: var(--muted);
	}
</style>
