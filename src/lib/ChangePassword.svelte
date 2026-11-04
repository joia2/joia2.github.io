<script>
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { session, changePassword } from '#lib/session.svelte.js';
	import { UserError, WrongPasswordError } from '#lib/errors.js';
	import { flush, loadLoan } from '#lib/loan.svelte.js';

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
			await flush(); // a pending loan edit is saved first, so it gets re-encrypted too
			await changePassword(current, next);
			await loadLoan(); // re-encrypting gave loan.json a new version to save on top of
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
	<h1>change password</h1>

	{#if done}
		<p class="success" role="status"><CircleCheck size={18} />Password changed. All data is now encrypted with the new one.</p>
		<button class="primary" type="button" onclick={onclose}>done</button>
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
			<p class="error" role="alert"><CircleAlert size={18} />{error}</p>
		{/if}

		<p class="actions">
			<button class="primary" type="submit" disabled={busy}>
				{busy ? 're-encrypting…' : 'change password'}
			</button>
			<button type="button" onclick={onclose} disabled={busy}>cancel</button>
		</p>
	{/if}
</form>
