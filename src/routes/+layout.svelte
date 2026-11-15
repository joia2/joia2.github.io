<script>
	import '../app.css';
	import { setLucideProps } from '@lucide/svelte';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import Menu from '#lib/Menu.svelte';
	import SaveStatus from '#lib/SaveStatus.svelte';
	import RawData from '#lib/RawData.svelte';
	import YearJump from '#lib/YearJump.svelte';
	import { ui, goHome } from '#lib/ui.svelte.js';
	import { isUnlocked, session, startDemo } from '#lib/session.svelte.js';
	import { version } from '$app/env';

	let { children } = $props();

	// One slim line weight for every Lucide icon in the app
	setLucideProps({ strokeWidth: 1.25 });
</script>

<header>
	<nav>
		<a href="/" onclick={(e) => (e.preventDefault(), goHome())}><img src="/favicon.svg" alt="" width="22" height="22" />joia2</a>
		{#if isUnlocked()}
			{#if ui.view !== 'password'}<YearJump />{/if}
			<span class="end">
				<SaveStatus />
				<button id="menu-button" class="icon-button menu" onclick={() => (ui.menuOpen = true)} aria-label="Open menu" aria-expanded={ui.menuOpen}>
					<MenuIcon size={22} />
				</button>
			</span>
		{:else if !session.restoring}
			<!-- Opens example data without a token; nothing is saved -->
			<button class="demo" onclick={startDemo}>demo</button>
		{/if}
	</nav>
</header>
<!-- The top bar's place in the page: the bar itself is fixed, so it stays put while the page bounces -->
<div class="under-header"></div>

<!-- Outside the header: its blur would otherwise trap the fixed-position menu inside the bar -->
{#if isUnlocked()}
	<Menu />
	<RawData />
{/if}

<main>
	{@render children()}
</main>

<footer>
	© all rights reserved
	{#if !isUnlocked()}<span class="version">v {version}</span>{/if}
</footer>

<style>
	header {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		background: var(--tint), var(--bar);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		backdrop-filter: saturate(180%) blur(20px);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
		padding-top: env(safe-area-inset-top); /* below the iPhone's clock */
	}
	.under-header {
		height: calc(49px + env(safe-area-inset-top)); /* with its border */
	}
	/* Installed: darker towards the top, so the white clock and battery stay readable */
	@media (display-mode: standalone) {
		/* iOS 27 blurs the screen's top edge, a little past the clock: the bar's items stay below it */
		header {
			background: linear-gradient(to top, transparent, rgb(0 0 0 / 0.45)), var(--tint), var(--bar);
			padding-top: calc(env(safe-area-inset-top) + 14px);
		}
		.under-header {
			height: calc(63px + env(safe-area-inset-top));
		}
		/* The items 4px lower in the bar, the bar itself the same */
		nav {
			position: relative;
			top: 4px;
		}
	}
	nav {
		max-width: 980px;
		height: 48px;
		margin: 0 auto;
		padding: 0 16px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	nav a {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text);
		text-decoration: none;
		font-size: 0.94rem;
		font-weight: 600;
		letter-spacing: -0.015em;
	}
	.demo {
		padding: 0.25rem 0.8rem;
		border: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.end {
		display: flex;
		align-items: center;
	}
	.menu {
		margin-right: -8px;
	}
	main {
		flex: 1 0 auto;
		width: 100%;
		max-width: 980px;
		margin: 0 auto;
		padding: 4rem 16px;
		box-sizing: border-box;
	}
	footer {
		/* Above the home bar's own bar when it shows (--bottom-bar, set by Loan.svelte) */
		padding: 1.5rem 16px max(calc(1rem + env(safe-area-inset-bottom)), calc(var(--bottom-bar, 0px) + 1rem));
		font-size: 0.75rem;
		color: var(--muted);
		text-align: center;
	}
	.version {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.65rem;
		opacity: 0.7;
	}
	@media (max-width: 480px) {
		main {
			padding-top: 2rem;
		}
	}
</style>
