<script>
	import Sheet from '#lib/Sheet.svelte';
	import { addMonths, currentMonth, formatKr, formatPercent, toOre, TAX_DEDUCTION } from '#lib/loan.js';

	// The formulas behind the app's numbers, with the samboerkontrakt's sections, and the values
	// they use in the chosen month. rows: from compute() with a loan; result: compute()'s result
	let { rows, result, egenkapital, names, open = $bindable(false) } = $props();
	const a = $derived(names.cyan);
	const b = $derived(names.mint);

	const monthLabel = (m) => `${m.slice(0, 4)} ${new Date(`${m}-01T12:00:00`).toLocaleDateString('en', { month: 'short' }).toLowerCase()}`;
	let month = $state(rows.find((r) => r.month >= currentMonth())?.month ?? rows.at(-1).month);
	const r = $derived(rows.find((x) => x.month === month) ?? rows[0]);

	const kr = (ore) => `${formatKr(ore)} kr`;
	const pct = (value) => `${formatPercent(value)}%`;
	const sum = (key) => r.people.cyan[key] + r.people.mint[key];
	const after = (p) => r.people[p].balance - r.people[p].principal;
	const total = $derived(sum('balance'));
	const totalAfter = $derived(after('cyan') + after('mint'));
	// What each has paid in by the end of the month: egenkapital and principal
	const paidIn = (p) => toOre(egenkapital?.[p] ?? 0) + rows.filter((x) => x.month <= month).reduce((s, x) => s + x.people[p].principal, 0);
	const year = $derived(addMonths(month, -1).slice(0, 4)); // the year this month's interest built up in
	const paidYear = $derived(result.interestPaid[year]);
	const end = $derived(result.yearEnd[month.slice(0, 4)]);
	const loInterest = $derived(sum('interest'));

	const sections = $derived([
		{
			title: 'Instalment (3.2)',
			lines: [
				[
					'bank instalment',
					'total principal left × r ÷ (1 − (1 + r)^−months left), rounded up to whole kr; r = rate ÷ 12',
					[`total principal left = ${kr(total)}`, `rate = ${pct(r.rate)}`, `months left = ${r.people.cyan.monthsLeft}`, `bank instalment = ${kr(sum('due'))}`]
				],
				[
					'each one’s instalment',
					'bank instalment × own principal left ÷ total principal left',
					[
						`${a}: ${kr(r.people.cyan.balance)} → ${pct(total ? (r.people.cyan.balance / total) * 100 : 0)} = ${kr(r.people.cyan.due)}`,
						`${b}: ${kr(r.people.mint.balance)} → ${pct(total ? (r.people.mint.balance / total) * 100 : 0)} = ${kr(r.people.mint.due)}`
					]
				],
				[
					'each one pays',
					'own instalment + fee ÷ 2 (all the fee once the other has repaid)',
					[`fee = ${kr(r.fee)}`, `${a} = ${kr(r.people.cyan.min)}`, `${b} = ${kr(r.people.mint.min)}`]
				]
			]
		},
		{
			title: 'Interest and principal',
			lines: [
				[
					'interest',
					'own principal left × rate × days ÷ (days in the year × 100)',
					[
						`rate = ${pct(r.rate)}`,
						`days = ${r.days}`,
						`days in the year = ${r.yearDays}`,
						`${a} = ${kr(r.people.cyan.interestDue)}`,
						`${b} = ${kr(r.people.mint.interestDue)}`
					]
				],
				['days', 'the days of the month before; the first payment from the take-over day', []],
				[
					'principal',
					'own instalment − own interest',
					[`${a} = ${kr(r.people.cyan.principalDue)}`, `${b} = ${kr(r.people.mint.principalDue)}`]
				],
				[
					'principal left after',
					'own principal left − own principal (− any extra payment)',
					[`${a} = ${kr(after('cyan'))}`, `${b} = ${kr(after('mint'))}`, `total = ${kr(totalAfter)}`]
				]
			]
		},
		{
			title: 'Extra and covered payments (3.3, 3.4)',
			lines: [
				[
					'extra payment',
					'lowers only the payer’s principal left; their instalment is worked out again, same end',
					[`${a} = ${kr(r.people.cyan.extra)}`, `${b} = ${kr(r.people.mint.extra)}`]
				],
				['covered payment', 'counts as paid by the one short, and becomes their debt to the other', []],
				[
					'debt interest',
					'amount covered × rate × days ÷ (days in the year × 100); none if repaid the next month (40 days)',
					[`debt = ${kr(Math.abs(r.debt))}`, `debt interest = ${kr(r.debtInterest ?? 0)}`]
				]
			]
		},
		{
			title: 'LO (3.9)',
			lines: [
				[
					`${b}’s LO`,
					`${a}’s LO fee × (1 − 22%) × ${b}’s principal left ÷ total principal left, after that month’s payment`,
					[
						`${a}’s LO fee = ${kr(r.lo.fee)}`,
						`less 22% = ${kr(Math.round(r.lo.fee * (1 - TAX_DEDUCTION)))}`,
						`${b}’s principal left = ${kr(after('mint'))}`,
						`total principal left = ${kr(totalAfter)}`,
						`share = ${pct(r.lo.share * 100)}`,
						`${b}’s LO = ${kr(r.lo.owed)}`
					]
				]
			]
		},
		{
			title: 'Tax (3.6)',
			lines: [
				[
					'actually',
					'paid − 22% × (own interest + own fee)',
					both((p) => kr(r.people[p].paid - Math.round(TAX_DEDUCTION * (r.people[p].interest + r.people[p].feePaid))))
				],
				[
					'tax return share',
					`own interest and fees in the year ÷ both (${year})`,
					paidYear
						? both((p) => `${kr(paidYear[p])} → ${pct((paidYear[p] / (paidYear.cyan + paidYear.mint)) * 100)}`)
						: []
				],
				[
					'principal left dec 31',
					`own principal left after the December payment (${month.slice(0, 4)})`,
					end ? both((p) => kr(end.loan[p])) : []
				]
			]
		},
		{
			title: 'Ownership and sale (4.1, 4.2, 7.9)',
			lines: [
				[
					'paid in',
					'own egenkapital + own principal paid',
					both((p) => `${kr(toOre(egenkapital?.[p] ?? 0))} + ${kr(paidIn(p) - toOre(egenkapital?.[p] ?? 0))} = ${kr(paidIn(p))}`)
				],
				[
					'paid in %',
					'paid in ÷ total price',
					both((p) => pct((paidIn(p) / (result.half.cyan + result.half.mint)) * 100))
				],
				['ownership', '50% each, whatever is paid', []],
				[
					'each gets on a sale',
					'(price − costs of sale) ÷ 2 − own principal left ± debt between you',
					both((p) => `own principal left = ${kr(after(p))}`)
				]
			]
		},
		{
			title: 'After a termination notice (7.2)',
			lines: [
				[
					'the one living there alone pays',
					'total interest of the month ÷ 4',
					[`total interest = ${kr(loInterest)}`, `÷ 4 = ${kr(Math.round(loInterest / 4))}`]
				]
			]
		}
	]);

	function both(show) {
		return [`${a} = ${show('cyan')}`, `${b} = ${show('mint')}`];
	}
</script>

<Sheet title="calculations" bind:open>
	<label>
			year month
			<select bind:value={month}>
				{#each rows as x (x.month)}<option value={x.month}>{monthLabel(x.month)}</option>{/each}
			</select>
	</label>
	<div class="scroll">
		{#each sections as s (s.title)}
			<h2>{s.title}</h2>
			<dl>
				{#each s.lines as [name, formula, values] (name)}
					<dt>{name}</dt>
					<dd>{formula}</dd>
					{#each values as v, i (i)}<dd class="value">{v}</dd>{/each}
				{/each}
			</dl>
		{/each}
		<p class="note">Amounts are worked out in øre and rounded to the nearest øre.</p>
	</div>
</Sheet>

<style>
	.scroll {
		overflow: auto;
		padding: 0 1.5rem 1.5rem;
	}
	/* Outside the scrolling part: the month stays at the top */
	label {
		margin: 0 1.5rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	select {
		font: inherit;
		font-size: 1rem;
		padding: 0.5rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		width: 100%;
		box-sizing: border-box;
	}
	select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	h2 {
		margin: 1.25rem 0 0.4rem;
		font-size: 0.95rem;
	}
	dl {
		margin: 0;
		font-size: 0.82rem;
	}
	dt {
		margin-top: 0.5rem;
		font-weight: 600;
	}
	dd {
		margin: 0.1rem 0 0;
		color: var(--muted);
	}
	.value {
		padding-left: 0.75rem;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}
	.value::before {
		content: '• ';
		color: var(--muted);
	}
	.note {
		margin: 1.25rem 0 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
