<script>
	import { onMount, tick } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import House from '@lucide/svelte/icons/house';
	import Face from '#lib/Face.svelte';
	import LoanRow from '#lib/LoanRow.svelte';
	import { loan, changed } from '#lib/loan.svelte.js';
	import { compute, currentMonth, formatKr, other, setValue, PEOPLE } from '#lib/loan.js';
	import { ui } from '#lib/ui.svelte.js';

	const today = currentMonth();
	const result = $derived(compute(loan.data, today));
	const names = $derived(loan.data.names);
	const first = $derived(Object.keys(loan.data.payments).sort()[0]);
	const debtor = $derived(result && (result.state.debt > 0 ? 'cyan' : result.state.debt < 0 ? 'mint' : null));

	// How far each half of the bar is filled: what that person has paid in, of their share
	const fill = (p) => Math.min(1, Math.max(0, result.state.equity[p] / result.state.own[p] || 0));

	const edit = (month) => (key, value, person) => {
		setValue(loan.data, month, key, value, person);
		changed();
	};

	// Start at this month's row; the list runs for up to 30 years
	onMount(async () => {
		await tick();
		document.querySelector('.row.now')?.scrollIntoView({ block: 'center' });
	});
</script>

{#if !result}
	<div class="empty">
		<p>Set the apartment price and the first payment month to start.</p>
		<button class="primary" onclick={() => (ui.view = 'apartment')}><House size={20} />apartment</button>
	</div>
{:else}
	<section class="people">
		{#each PEOPLE as p (p)}
			<div class="person {p}">
				<Face person={p} size={64} />
				<span class="name">{names[p]}</span>
			</div>
		{/each}
	</section>

	<div
		class="bar"
		role="img"
		aria-label="{names.cyan} has paid {Math.round(fill('cyan') * 100)}% of their half, {names.mint} {Math.round(fill('mint') * 100)}%"
	>
		<span class="cyan" style:width="{fill('cyan') * 50}%"></span>
		<span class="mint" style:width="{fill('mint') * 50}%"></span>
	</div>
	<p class="shares">{formatKr(result.state.own.cyan)} / {formatKr(result.state.own.mint)}</p>

	{#if debtor}
		<div class="banner" role="alert">
			<CircleAlert size={20} />
			<span>
				<strong>{names[debtor]}</strong> owes <strong>{names[other(debtor)]}</strong>
				{formatKr(Math.abs(result.state.debt))} kr
			</span>
		</div>
	{/if}

	<div class="rows">
		{#each result.rows as row (row.month)}
			<LoanRow
				{row}
				{today}
				{names}
				entry={loan.data.payments[row.month] ?? {}}
				first={row.month === first}
				onedit={edit(row.month)}
			/>
		{/each}
	</div>
{/if}

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		padding-top: 3rem;
		text-align: center;
		color: var(--muted);
	}
	.empty p {
		margin: 0;
	}
	.people {
		display: flex;
		justify-content: space-between;
		max-width: 44rem;
		margin: 0 auto;
	}
	/* Names face the middle: cyan's to the right of its face, mint's to the left */
	.person {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.person.mint {
		flex-direction: row-reverse;
	}
	.name {
		overflow: hidden;
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar {
		position: relative;
		height: 14px;
		max-width: 44rem;
		margin: 1.5rem auto 0;
		border-radius: 14px;
		background: color-mix(in srgb, var(--border) 60%, transparent);
		overflow: hidden;
	}
	.bar span {
		position: absolute;
		top: 0;
		bottom: 0;
		transition: width 0.4s;
	}
	.bar .cyan {
		left: 0;
		background: var(--cyan);
	}
	.bar .mint {
		right: 0;
		background: var(--mint);
	}
	/* The middle line: where each half ends */
	.bar::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: var(--bg);
	}
	.shares {
		margin: 0.5rem 0 0;
		text-align: center;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		max-width: 44rem;
		margin: 1.5rem auto 0;
		padding: 0.9rem 1.1rem;
		border-radius: 16px;
		background: color-mix(in srgb, var(--error) 12%, transparent);
		color: var(--error);
		font-size: 0.94rem;
		text-align: center;
	}
	.rows {
		max-width: 44rem;
		margin: 1.5rem auto 0;
	}
</style>
