<script>
	import { tick } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Lock from '@lucide/svelte/icons/lock';
	import Users from '@lucide/svelte/icons/users';
	import House from '@lucide/svelte/icons/house';
	import ChartPie from '@lucide/svelte/icons/chart-pie';
	import FileBraces from '@lucide/svelte/icons/file-braces';
	import Calculator from '@lucide/svelte/icons/calculator';
	import MopSparkles from '@lucide/svelte/icons/mop-sparkles';
	import { cleanUp } from '#lib/cleanup.js';
	import Receipt from '@lucide/svelte/icons/receipt';
	import { ui } from '#lib/ui.svelte.js';
	import { lock, session } from '#lib/session.svelte.js';
	import { loan, save, hasUnsavedChanges } from '#lib/loan.svelte.js';
	import { version } from '$app/env';

	let first = $state();

	function close() {
		ui.menuOpen = false;
		document.getElementById('menu-button')?.focus();
	}

	// Closes the menu, then runs the chosen action
	const choose = (action) => () => {
		ui.menuOpen = false;
		action();
	};

	const show = (view) => () => (ui.view = view);

	// Removes attachment files the data doesn't list (cleanup.js), sparing any from the last 10
	// minutes (an upload going on). The menu stays open to show how it went.
	let cleaning = $state('');
	async function cleanNow() {
		cleaning = 'cleaning…';
		try {
			await save();
			if (hasUnsavedChanges()) throw new Error('save your last change first');
			const removed = await cleanUp(session.token, $state.snapshot(loan.data), new Date(), 10 * 60 * 1000);
			cleaning = removed ? `removed ${removed} unused file${removed === 1 ? '' : 's'}` : 'nothing to clean';
		} catch (e) {
			cleaning = `not cleaned: ${e.message}`;
		}
	}

	// Locking saves any waiting edit first, and the next login starts at home. If saving fails,
	// locking would lose that edit, so it asks first.
	async function lockApp() {
		await save();
		if (hasUnsavedChanges() && !confirm('Your last change could not be saved. Lock anyway and lose it?')) return;
		ui.view = 'home';
		ui.rawOpen = false;
		lock();
	}

	$effect(() => {
		if (!ui.menuOpen) return;
		if (cleaning !== 'cleaning…') cleaning = ''; // a fresh menu: the last clean-up's message is gone
		// The page behind stays put while the menu is open
		document.documentElement.style.overflow = 'hidden';
		tick().then(() => first?.focus());
		return () => (document.documentElement.style.overflow = '');
	});
</script>

<svelte:window onkeydown={(e) => ui.menuOpen && e.key === 'Escape' && close()} />

<!-- Clicking outside closes the menu; keyboards use Escape or the close button instead -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" class:open={ui.menuOpen} onclick={close}></div>

<aside class:open={ui.menuOpen} inert={!ui.menuOpen} aria-label="Menu">
	<div class="top">
		<button class="icon-button" onclick={close} aria-label="Close menu">
			<X size={22} />
		</button>
	</div>
	<nav>
		<button bind:this={first} onclick={choose(show('names'))}><Users size={20} />names</button>
		<button onclick={choose(show('apartment'))}><House size={20} />apartment</button>
		<button onclick={choose(show('costs'))}><ChartPie size={20} />costs/ownership</button>
		<button onclick={choose(() => ((ui.view = 'home'), (ui.calcOpen = true)))}><Calculator size={20} />calculations</button>
		<button onclick={choose(() => (ui.rawOpen = true))}><FileBraces size={20} />data</button>
		<button onclick={choose(() => ((ui.view = 'home'), (ui.saleOpen = true)))}><Receipt size={20} />sale</button>
		<hr />
		{#if !session.demo}
			<button onclick={cleanNow} disabled={cleaning === 'cleaning…'}><MopSparkles size={20} />{cleaning || 'clean up'}</button>
			<button onclick={choose(show('password'))}><KeyRound size={20} />password</button>
		{/if}
		<button onclick={choose(lockApp)}><Lock size={20} />lock</button>
	</nav>
	<!-- With the seconds until the next check for data saved elsewhere -->
	<p class="version">v {version}{ui.check == null ? '' : ui.check === '…' ? ' (sync…)' : ` (sync in ${ui.check})`}</p>
</aside>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgb(0 0 0 / 0.3);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.35s;
	}
	.backdrop.open {
		opacity: 1;
		pointer-events: auto;
	}
	aside {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		width: min(22rem, 85vw);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		padding: env(safe-area-inset-top) 2rem calc(1rem + env(safe-area-inset-bottom));
		background:
			linear-gradient(180deg, color-mix(in srgb, var(--cyan) 10%, transparent), color-mix(in srgb, var(--mint) 10%, transparent)),
			color-mix(in srgb, var(--surface) 88%, transparent);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		backdrop-filter: saturate(180%) blur(20px);
		box-shadow: var(--shadow);
		overflow-y: auto;
		transform: translateX(100%);
		transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
	}
	aside.open {
		transform: none;
	}
	/* In line with the top bar, a little lower when installed (iOS 27 blurs the top edge) */
	@media (display-mode: standalone) {
		aside {
			padding-top: calc(env(safe-area-inset-top) + 14px);
		}
	}
	.top {
		height: 48px;
		margin-right: -1rem;
		display: flex;
		align-items: center;
		justify-content: flex-end;
	}
	nav {
		display: flex;
		flex-direction: column;
		margin-top: 1.5rem;
	}
	.version {
		margin: auto 0 0;
		padding-top: 2rem;
		font-size: 0.65rem;
		color: var(--muted);
		opacity: 0.7;
	}
	hr {
		width: 100%;
		margin: 0.75rem 0;
		border: 0;
		border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
	}
	nav button {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.5rem 0;
		border: 0;
		border-radius: 0;
		text-align: left;
		font-size: 1.2rem;
		font-weight: 500;
		letter-spacing: -0.015em;
	}
	nav button:hover:not(:disabled) {
		background: transparent;
		color: var(--muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.backdrop,
		aside {
			transition: none;
		}
	}
</style>
