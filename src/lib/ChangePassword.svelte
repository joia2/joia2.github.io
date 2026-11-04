<script>
	import { session, changePassword } from '#lib/session.svelte.js';
	import { UserError, WrongPasswordError } from '#lib/errors.js';

	let { onclose } = $props();

	let current = $state('');
	let next = $state('');
	let repeat = $state('');
	let error = $state('');
	let done = $state(false);
	let busy = $state(false);

	async function submit(event) {
		event.preventDefault();
		if (current === '' || next === '') {
			error = 'Enter your current and new password.';
			return;
		}
		if (next !== repeat) {
			error = "The two new passwords don't match.";
			return;
		}
		if (next === current) {
			error = 'The new password is the same as the current one.';
			return;
		}

		error = '';
		busy = true;
		try {
			await changePassword(current, next);
			done = true;
			current = next = repeat = '';
		} catch (e) {
			error = e instanceof UserError ? e.message : `Something went wrong: ${e.message}`;
			if (e instanceof WrongPasswordError) current = '';
		} finally {
			busy = false;
		}
	}
</script>

<form onsubmit={submit}>
	<h2>Change encryption password</h2>

	{#if done}
		<p class="success" role="status">Password changed. All data is now encrypted with the new one.</p>
		<button class="primary" type="button" onclick={onclose}>Done</button>
	{:else}
		<!-- Hidden, so password managers know which entry to update -->
		<input type="text" name="username" autocomplete="username" value={session.token} hidden />

		<label>
			current password
			<input type="password" name="current" bind:value={current} autocomplete="current-password" />
		</label>
		<label>
			new password
			<input type="password" name="new" bind:value={next} autocomplete="new-password" />
		</label>
		<label>
			repeat new password
			<input type="password" name="repeat" bind:value={repeat} autocomplete="new-password" />
		</label>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<p class="actions">
			<button class="primary" type="submit" disabled={busy}>
				{busy ? 'Re-encrypting…' : 'Change password'}
			</button>
			<button type="button" onclick={onclose} disabled={busy}>Cancel</button>
		</p>
	{/if}
</form>

<style>
	.actions {
		display: flex;
		gap: 0.75rem;
	}
	.actions button:not(.primary) {
		font: inherit;
		padding: 0.6rem 1rem;
		border: 1px solid currentColor;
		border-radius: 0.5rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}
</style>
