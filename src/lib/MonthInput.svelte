<script>
	import { currentMonth } from '#lib/loan.js';

	// A month field in English on every device, shown like the rows: "2026 dec".
	// value: 'YYYY-MM'; children: an icon shown on the left
	let { value = $bindable(), disabled = false, label, children } = $props();

	const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
	const now = Number(currentMonth().slice(0, 4));
	const year = $derived(value.slice(0, 4));
	const month = $derived(value.slice(5, 7));
	// From 10 years back to 40 ahead, plus the value's own year if it falls outside
	const years = $derived(
		[...new Set([...Array.from({ length: 51 }, (_, i) => String(now - 10 + i)), year])].sort()
	);
	const set = (y, m) => (value = `${y}-${m}`);
</script>

<span class="month-input" class:disabled>
	{@render children?.()}
	<select aria-label="{label} year" value={year} {disabled} onchange={(e) => set(e.currentTarget.value, month)}>
		{#each years as y (y)}<option value={y}>{y}</option>{/each}
	</select>
	<select aria-label="{label} month" value={month} {disabled} onchange={(e) => set(year, e.currentTarget.value)}>
		{#each MONTHS as name, i (name)}
			{@const m = String(i + 1).padStart(2, '0')}
			<option value={m}>{name}</option>
		{/each}
	</select>
</span>

<style>
	.month-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 1rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--muted);
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}
	.month-input:focus-within {
		border-color: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
		color: var(--accent);
	}
	.disabled {
		opacity: 0.5;
	}
	select {
		-webkit-appearance: none;
		appearance: none;
		min-width: 0;
		padding: 0.8rem 0;
		border: 0;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 1rem;
		font-weight: 400;
		cursor: pointer;
	}
	select:focus {
		outline: none;
	}
</style>
