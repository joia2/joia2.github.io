<script>
	import { onMount } from 'svelte';
	import { session, unlock } from '#lib/session.svelte.js';
	import { login, setup } from '#lib/vault.js';
	import { UserError, NeedsSetupError, WrongPasswordError } from '#lib/errors.js';

	let token = $state(session.token);
	let key = $state('');
	let repeat = $state('');
	let remember = $state(session.remember);
	let error = $state('');
	let busy = $state(false);
	// 'setup' when joia2data has no salt.json yet: the password is then chosen, and typed twice
	let mode = $state('login');

	// Until the app has loaded, a submit would be a plain HTML form submission that puts the
	// token and password into the page address. A disabled button blocks that, Enter included.
	let ready = $state(false);
	onMount(() => (ready = true));

	async function submit(event) {
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
		if (mode === 'setup' && key !== repeat) {
			error = "The two passwords don't match.";
			return;
		}

		error = '';
		busy = true;
		try {
			const cryptoKey = mode === 'setup' ? await setup(t, key) : await login(t, key);
			unlock(t, cryptoKey, remember);
		} catch (e) {
			if (e instanceof NeedsSetupError) {
				mode = 'setup';
				repeat = '';
			} else {
				error = e instanceof UserError ? e.message : `Something went wrong: ${e.message}`;
				if (e instanceof WrongPasswordError) key = '';
			}
		} finally {
			busy = false;
		}
	}

	// A different token may point at a set-up repo again
	function tokenChanged() {
		mode = 'login';
		repeat = '';
	}
</script>

<form onsubmit={submit}>
	<h1>Login</h1>

	<label>
		joia2data token
		<!-- A text field marked as the username, so password managers fill it together with the password.
		     It stays masked like a password where the browser supports -webkit-text-security. -->
		<input
			class="masked"
			type="text"
			name="username"
			bind:value={token}
			oninput={tokenChanged}
			autocomplete="username"
			autocapitalize="off"
			spellcheck="false"
			placeholder="github_…"
		/>
	</label>

	<label class="check">
		<input type="checkbox" bind:checked={remember} />
		Remember token on this device
	</label>

	{#if mode === 'setup'}
		<p class="note">
			joia2data has no encryption password yet. Choose one and type it twice. If you forget it, your
			data can't be recovered.
		</p>
	{/if}

	<label>
		encryption password
		<input
			type="password"
			name="password"
			bind:value={key}
			autocomplete={mode === 'setup' ? 'new-password' : 'current-password'}
		/>
	</label>

	{#if mode === 'setup'}
		<label>
			repeat encryption password
			<input type="password" name="repeat" bind:value={repeat} autocomplete="new-password" />
		</label>
	{/if}

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<button class="primary" type="submit" disabled={busy || !ready}>
		{busy ? 'Checking…' : mode === 'setup' ? 'Set password' : 'Unlock'}
	</button>
</form>

<style>
	.masked {
		-webkit-text-security: disc;
	}
</style>
