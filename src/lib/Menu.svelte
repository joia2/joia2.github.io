<script>
	import { tick } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Lock from '@lucide/svelte/icons/lock';
	import Users from '@lucide/svelte/icons/users';
	import House from '@lucide/svelte/icons/house';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import FileBraces from '@lucide/svelte/icons/file-braces';
	import { ui } from '#lib/ui.svelte.js';
	import { lock } from '#lib/session.svelte.js';
	import { save, hasUnsavedChanges } from '#lib/loan.svelte.js';

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
		<button onclick={choose(show('egenkapital'))}><PiggyBank size={20} />egenkapital</button>
		<button onclick={choose(() => (ui.rawOpen = true))}><FileBraces size={20} />raw data</button>
		<hr />
		<button onclick={choose(show('password'))}><KeyRound size={20} />change password</button>
		<button onclick={choose(lockApp)}><Lock size={20} />lock</button>
	</nav>
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
		padding: 0 2rem 2rem;
		background: color-mix(in srgb, var(--surface) 88%, transparent);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		box-shadow: var(--shadow);
		overflow-y: auto;
		transform: translateX(100%);
		transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
	}
	aside.open {
		transform: none;
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
