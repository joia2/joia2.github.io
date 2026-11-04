<script>
	import Unlock from '#lib/Unlock.svelte';
	import ChangePassword from '#lib/ChangePassword.svelte';
	import { isUnlocked } from '#lib/session.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
</script>

<svelte:head>
	<title>joia2</title>
</svelte:head>

{#if !isUnlocked()}
	<Unlock />
{:else if ui.changingPassword}
	<ChangePassword onclose={() => (ui.changingPassword = false)} />
{:else}
	<section>
		<h1>Hello</h1>
	</section>
{/if}

<style>
	section {
		text-align: center;
		padding-top: 2rem;
	}
	h1 {
		font-size: clamp(3.5rem, 12vw, 6rem);
		font-weight: 700;
		letter-spacing: -0.045em;
		line-height: 1.05;
		background: var(--gradient);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}
</style>
