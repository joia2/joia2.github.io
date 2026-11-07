<script>
	import { onMount } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TicketCheck from '@lucide/svelte/icons/ticket-check';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import LockKeyholeOpen from '@lucide/svelte/icons/lock-keyhole-open';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { unlock } from '#lib/session.svelte.js';
	import { login, setup } from '#lib/vault.js';
	import { UserError, NeedsSetupError, WrongPasswordError } from '#lib/errors.js';

	let token = $state('');
	let key = $state('');
	let repeat = $state('');
	let error = $state('');
	let busy = $state(false);
	// 'setup' when joia2data has no salt.json yet: the password is then chosen, and typed twice
	let mode = $state('login');

	// Until the app has loaded, a submit would be a plain HTML form submission that puts the
	// token and password into the page address. A disabled button blocks that, Enter included.
	let ready = $state(false);
	let form = $state();
	onMount(() => {
		// Browsers refill text fields after a reload or a reopened tab; the token must not come back
		form.reset();
		token = key = repeat = '';
		ready = true;
	});

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
			const derived = mode === 'setup' ? await setup(t, key) : await login(t, key);
			unlock(t, derived.key, derived.raw);
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

<form bind:this={form} onsubmit={submit}>
	<label>
		joia2data token
		<!-- A text field marked as the username, so password managers fill it together with the password.
		     Not masked: Safari takes a masked field for a second password and offers no login autofill.
		     Instead its text is invisible, with a dot shown for each character on top. -->
		<span class="field">
			<TicketCheck size={20} />
			<input
				type="text"
				name="username"
				bind:value={token}
				oninput={tokenChanged}
				autocomplete="username"
				autocapitalize="off"
				spellcheck="false"
				placeholder="github_…"
				class="hidden-text"
			/>
			<span class="dots" aria-hidden="true">{'•'.repeat(token.length)}</span>
		</span>
	</label>

	{#if mode === 'setup'}
		<p class="note">
			joia2data has no encryption password yet. Choose one and type it twice. If you forget it, your
			data can't be recovered.
		</p>
	{/if}

	<label>
		encryption password
		<span class="field">
			<KeyRound size={20} />
			<input
				type="password"
				name="password"
				bind:value={key}
				placeholder="•••••"
				autocomplete={mode === 'setup' ? 'new-password' : 'current-password'}
			/>
		</span>
	</label>

	{#if mode === 'setup'}
		<label>
			repeat encryption password
			<span class="field">
				<KeyRound size={20} />
				<input type="password" name="repeat" bind:value={repeat} autocomplete="new-password" placeholder="•••••" />
			</span>
		</label>
	{/if}

	{#if error}
		<p class="error" role="alert"><CircleAlert size={18} />{error}</p>
	{/if}

	<button class="primary" type="submit" disabled={busy || !ready}>
		{#if busy}
			<LoaderCircle size={20} class="spin" />checking…
		{:else if mode === 'setup'}
			<ShieldCheck size={20} />set password
		{:else}
			<LockKeyholeOpen size={20} />unlock
		{/if}
	</button>
</form>

<style>
	/* -webkit-text-fill-color wins over the color Safari sets on autofilled text */
	.hidden-text,
	.hidden-text:-webkit-autofill {
		color: transparent;
		-webkit-text-fill-color: transparent;
		caret-color: var(--text);
	}
	.hidden-text::placeholder {
		-webkit-text-fill-color: var(--muted);
	}
	.hidden-text::selection {
		color: transparent;
	}
	/* Where the text would be: past the icon, inside the field's padding */
	.dots {
		position: absolute;
		inset: 0 1rem 0 2.75rem;
		display: flex;
		align-items: center;
		overflow: hidden;
		white-space: nowrap;
		letter-spacing: 0.1em;
		color: var(--text);
		pointer-events: none;
	}
</style>
