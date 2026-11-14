<script>
	import Sheet from '#lib/Sheet.svelte';

	// The formulas behind the app's numbers, with the samboerkontrakt's sections
	let { names, open = $bindable(false) } = $props();
	const a = $derived(names.cyan);
	const b = $derived(names.mint);
	const sections = $derived([
		{
			title: 'Instalment (3.2)',
			lines: [
				['bank instalment', 'loan left × r ÷ (1 − (1 + r)^−months left), rounded up to whole kr; r = rate ÷ 12'],
				['each one’s instalment', 'bank instalment × own instalment ÷ both instalments (to the øre)'],
				['same as', 'bank instalment × own loan left ÷ total loan left, at the same rate and months left'],
				['each one pays', 'own instalment + fee ÷ 2 (all the fee once the other has repaid)']
			]
		},
		{
			title: 'Interest and principal',
			lines: [
				['interest', 'own loan left × rate × days ÷ (365 or 366 × 100)'],
				['days', 'the days of the month before; the first payment from the take-over day'],
				['bank interest', `total loan left × rate × days ÷ (365 or 366 × 100); ${b}’s = bank − ${a}’s`],
				['principal', 'own instalment − own interest'],
				['loan left after', 'own loan left − own principal (− any extra payment)']
			]
		},
		{
			title: 'Extra and covered payments (3.3, 3.4)',
			lines: [
				['extra payment', 'lowers only the payer’s loan; their instalment is worked out again, same end'],
				['covered payment', 'counts as paid by the one short, and becomes their debt to the other'],
				['debt interest', 'amount covered × mortgage rate × days ÷ (365 or 366 × 100); none if repaid the next month (40 days)']
			]
		},
		{
			title: 'LO (3.9)',
			lines: [
				[`${b}’s LO`, `${a}’s LO fee × (1 − 22%) × ${b}’s loan left ÷ total loan left`],
				['loan left', 'after that month’s payment']
			]
		},
		{
			title: 'Tax (3.6)',
			lines: [
				['actually', 'paid − 22% × (own interest + own fee)'],
				['tax return share', 'own interest and fees in the year ÷ both'],
				['loan dec 31', 'own loan left after the December payment']
			]
		},
		{
			title: 'Ownership and sale (4.1, 4.2, 7.9)',
			lines: [
				['paid in', 'own egenkapital + own principal paid'],
				['paid in %', 'paid in ÷ total price'],
				['ownership', '50% each, whatever is paid'],
				['each gets on a sale', '(price − costs of sale) ÷ 2 − own loan left ± debt between you']
			]
		},
		{
			title: 'After a termination notice (7.2)',
			lines: [['the one living there alone pays', 'total interest of the month ÷ 4']]
		}
	]);
</script>

<Sheet title="calculations" bind:open>
	<div class="scroll">
		{#each sections as s (s.title)}
			<h2>{s.title}</h2>
			<dl>
				{#each s.lines as [name, formula] (name)}
					<dt>{name}</dt>
					<dd>{formula}</dd>
				{/each}
			</dl>
		{/each}
		<p class="note">Amounts are worked out in øre and rounded to the nearest øre. Loan left: the principal left.</p>
	</div>
</Sheet>

<style>
	.scroll {
		overflow: auto;
		padding: 0 1.5rem 1.5rem;
	}
	h2 {
		margin: 1.25rem 0 0.4rem;
		font-size: 0.95rem;
	}
	h2:first-child {
		margin-top: 0;
	}
	dl {
		margin: 0;
		font-size: 0.82rem;
	}
	dt {
		margin-top: 0.4rem;
		font-weight: 600;
	}
	dd {
		margin: 0.1rem 0 0;
		color: var(--muted);
	}
	.note {
		margin: 1.25rem 0 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
