<script>
	import { tick } from 'svelte';
	import { loan } from '#lib/loan.svelte.js';
	import { ui } from '#lib/ui.svelte.js';
	import { TERM } from '#lib/loan.js';

	// Shortcuts to every 6th year of the loan, from the first payment; a dropdown on narrow screens
	const first = $derived(loan.data && Object.keys(loan.data.payments).sort()[0]);
	const years = $derived.by(() => {
		if (!first) return [];
		const start = Number(first.slice(0, 4));
		return Array.from({ length: Math.floor(TERM / 12 / 6) + 1 }, (_, i) => start + i * 6);
	});

	// Shows every month first, since the year may be among the collapsed ones
	async function jump(year) {
		ui.earlier = ui.later = true;
		await tick();
		document.querySelector(`.row[data-month^="${year}"]`)?.scrollIntoView({ block: 'start' });
	}
</script>

{#if years.length}
	<span class="years" aria-label="jump to year">
		{#each years as year (year)}
			<button onclick={() => jump(year)}>{year}</button>
		{/each}
	</span>
	<select
		class="years-menu"
		aria-label="jump to year"
		onchange={(e) => {
			jump(e.currentTarget.value);
			e.currentTarget.value = '';
		}}
	>
		<option value="">year</option>
		{#each years as year (year)}
			<option value={year}>{year}</option>
		{/each}
	</select>
{/if}

<style>
	.years {
		display: flex;
		gap: 0.1rem;
	}
	.years button {
		padding: 0.25rem 0.6rem;
		border: 0;
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.years button:hover:not(:disabled) {
		color: var(--text);
	}
	.years-menu {
		display: none;
		padding: 0.2rem 0.5rem;
		border: 1px solid var(--border);
		border-radius: 980px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
	}
	@media (max-width: 640px) {
		.years {
			display: none;
		}
		.years-menu {
			display: block;
		}
	}
</style>
