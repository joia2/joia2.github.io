<script>
	import { session, unlock } from '#lib/session.svelte.js';

	let token = $state(session.token);
	let key = $state('');
	let remember = $state(session.remember);
	let error = $state('');

	function submit(event) {
		event.preventDefault();
		const t = token.trim();

		// Fine-grained tokens can be limited to the joia2data repo; classic ones can't
		if (!t.startsWith('github_pat_')) {
			error = 'Use a fine-grained token. It starts with github_pat_.';
			return;
		}
		if (key === '') {
			error = 'Enter your encryption password.';
			return;
		}

		error = '';
		unlock(t, key, remember);
	}
</script>

<form onsubmit={submit}>
	<h1>Login</h1>

	<label>
		joia2data token
		<input type="password" bind:value={token} autocomplete="off" spellcheck="false" placeholder="github_…" />
	</label>

	<label class="check">
		<input type="checkbox" bind:checked={remember} />
		Remember token on this device
	</label>

	<label>
		encryption password
		<input type="password" bind:value={key} autocomplete="current-password" />
	</label>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<button type="submit">Unlock</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 24rem;
	}
	h1 {
		margin: 0;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-weight: 600;
	}
	label.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		font-weight: normal;
	}
	input[type='password'] {
		font: inherit;
		padding: 0.6rem 0.75rem;
		border: 1px solid #c4c4c4;
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
	}
	.error {
		margin: 0;
		color: #c62828;
	}
	button {
		font: inherit;
		font-weight: 600;
		padding: 0.6rem 1rem;
		border: 0;
		border-radius: 0.5rem;
		background: #22d3ee;
		color: #0b2a2e;
		cursor: pointer;
	}
	@media (prefers-color-scheme: dark) {
		input[type='password'] {
			border-color: #444;
		}
		.error {
			color: #ef9a9a;
		}
	}
</style>
