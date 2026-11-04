<script>
	import '../app.css';
	import { setLucideProps } from '@lucide/svelte';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import Menu from '#lib/Menu.svelte';
	import SaveStatus from '#lib/SaveStatus.svelte';
	import RawData from '#lib/RawData.svelte';
	import { ui } from '#lib/ui.svelte.js';
	import { isUnlocked } from '#lib/session.svelte.js';

	let { children } = $props();

	// One slim line weight for every Lucide icon in the app
	setLucideProps({ strokeWidth: 1.25 });
</script>

<header>
	<nav>
		<a href="/"><img src="/favicon.svg" alt="" width="22" height="22" />joia2</a>
		{#if isUnlocked()}
			<SaveStatus />
			<button id="menu-button" class="icon-button menu" onclick={() => (ui.menuOpen = true)} aria-label="Open menu" aria-expanded={ui.menuOpen}>
				<MenuIcon size={22} />
			</button>
		{/if}
	</nav>
</header>

<!-- Outside the header: its blur would otherwise trap the fixed-position menu inside the bar -->
{#if isUnlocked()}
	<Menu />
	<RawData />
{/if}

<main>
	{@render children()}
</main>

<footer>© all rights reserved</footer>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bar);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
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
	.menu {
		margin-right: -8px;
	}
	main {
		max-width: 980px;
		min-height: calc(100vh - 48px - 4.5rem);
		margin: 0 auto;
		padding: 4rem 16px;
		box-sizing: border-box;
	}
	footer {
		padding: 1.5rem 16px 3rem;
		font-size: 0.75rem;
		color: var(--muted);
		text-align: center;
	}
	@media (max-width: 480px) {
		main {
			padding-top: 2rem;
		}
	}
</style>
