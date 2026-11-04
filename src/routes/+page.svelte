<script>
	import Unlock from '#lib/Unlock.svelte';
	import ChangePassword from '#lib/ChangePassword.svelte';
	import { isUnlocked, lock, forget } from '#lib/session.svelte.js';

	let changing = $state(false);
</script>

<svelte:head>
	<title>joia2</title>
</svelte:head>

{#if !isUnlocked()}
	<Unlock />
{:else if changing}
	<ChangePassword onclose={() => (changing = false)} />
{:else}
	<h1>Hello</h1>
	<p class="actions">
		<button onclick={lock}>Lock</button>
		<button onclick={forget}>Forget token</button>
		<button onclick={() => (changing = true)}>Change password</button>
	</p>
{/if}

<style>
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}
	button {
		font: inherit;
		padding: 0.4rem 0.9rem;
		border: 1px solid currentColor;
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
</style>
