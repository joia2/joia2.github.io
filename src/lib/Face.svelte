<script>
	import { ANIMALS } from '#lib/animals.js';
	import { loan } from '#lib/loan.svelte.js';
	// A person's icon: the animal they picked, or the logo's face. cyan for person A, mint for person B.
	// animal: shows that one instead of the picked one (the picker in the names popup)
	let { person, size = 56, animal } = $props();
	const color = $derived(person === 'cyan' ? '#22d3ee' : '#2dd4bf');
	const icon = $derived(ANIMALS[animal ?? loan.data?.animals?.[person]]);
</script>

{#if icon}
	<svg class="face" viewBox="0 0 {icon.size} {icon.size}" width={size} height={size} aria-hidden="true">{@html icon.draw(color)}</svg>
{:else}
	<svg class="face" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
		<circle cx="20" cy="20" r="17.5" fill={color} />
		<g fill="none" stroke="#0b2a2e" stroke-width="2.5" stroke-linecap="round">
			<circle cx="20" cy="20" r="17.5" />
			<path d="M11.5 23.5q8.5 7.5 17 0" />
		</g>
		<circle cx="14" cy="16" r="2.3" fill="#0b2a2e" />
		<circle cx="26" cy="16" r="2.3" fill="#0b2a2e" />
	</svg>
{/if}
