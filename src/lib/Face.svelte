<script>
	import { ANIMALS, ANIMAL_NAMES, FACING } from '#lib/animals.js';
	import { clock } from '#lib/clock.svelte.js';
	import { loan } from '#lib/loan.svelte.js';
	// A person's icon: the animal they picked, or the logo's face. cyan for person A, mint for person B.
	// animal: shows that one instead of the picked one (the picker in the names popup). 'rotate': each
	// animal in turn, a new one every minute: on the left backwards from the last (camel, horse…), on
	// the right forwards from the first (fish, chicken…). The two never show the same animal.
	let { person, size = 56, animal } = $props();
	const color = $derived(person === 'cyan' ? '#22d3ee' : '#2dd4bf');
	const chosen = $derived(animal ?? loan.data?.animals?.[person]);
	const n = ANIMAL_NAMES.length;
	const turn = $derived(ANIMAL_NAMES[person === 'mint' ? clock.minute % n : n - 1 - (clock.minute % n)]);
	const name = $derived(chosen === 'rotate' ? turn : chosen);
	const icon = $derived(ANIMALS[name]);
	// Each looks toward the middle: the left one to the right, the right one to the left
	const mirrored = $derived(FACING[name] === (person === 'cyan' ? 'left' : 'right'));
</script>

{#if icon}
	<svg class="face" class:mirrored viewBox="0 0 {icon.size} {icon.size}" width={size} height={size} aria-hidden="true">{@html icon.draw(color)}</svg>
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

<style>
	.mirrored {
		transform: scaleX(-1);
	}
</style>
