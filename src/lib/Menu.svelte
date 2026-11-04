<script>
	import { tick } from 'svelte';
	import { ui } from '#lib/ui.svelte.js';
	import { lock, forget } from '#lib/session.svelte.js';

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

	// Locking also leaves any open screen, so the next login starts at home
	const leave = (action) => () => {
		ui.changingPassword = false;
		action();
	};

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
		<button class="close" onclick={close} aria-label="Close menu">
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
				<path d="M6 6l12 12M18 6L6 18" />
			</svg>
		</button>
	</div>
	<nav>
		<button bind:this={first} onclick={choose(() => (ui.changingPassword = true))}>Change password</button>
		<button onclick={choose(leave(lock))}>Lock</button>
		<button onclick={choose(leave(forget))}>Forget token</button>
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
	.close {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
	}
	.close path {
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}
	nav {
		display: flex;
		flex-direction: column;
		margin-top: 1.5rem;
	}
	nav button {
		padding: 0.55rem 0;
		border: 0;
		border-radius: 0;
		text-align: left;
		font-size: 1.6rem;
		font-weight: 600;
		letter-spacing: -0.025em;
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
