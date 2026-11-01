<script>
	let { children } = $props();
</script>

<header>
	<nav>
		<a href="/">joia2</a>
	</nav>
</header>

<main>
	{@render children()}
</main>

<footer>© all rights reserved</footer>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
		line-height: 1.6;
		color: #1a1a1a;
		background: #fafafa;
	}
	@media (prefers-color-scheme: dark) {
		:global(body) {
			color: #eaeaea;
			background: #141414;
		}
	}
	header,
	main,
	footer {
		max-width: 44rem;
		margin: 0 auto;
		padding: 1rem;
	}
	nav {
		display: flex;
		gap: 1.5rem;
	}
	nav a {
		color: inherit;
		text-decoration: none;
		font-weight: 600;
	}
	footer {
		font-size: 0.85rem;
		opacity: 0.6;
	}
</style>
