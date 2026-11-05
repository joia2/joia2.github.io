<script>
	import Face from '#lib/Face.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { formatKr, formatPercent, other, PEOPLE } from '#lib/loan.js';

	// What the skattemelding needs, per year: the interest and fees each person paid (rentefradrag)
	// and what each owed on 31 December (formue).
	// interestPaid, yearEnd: from compute(); open: bindable, whether the popup shows
	let { interestPaid, yearEnd, names, highlight, open = $bindable(false) } = $props();

	const share = (values, p) => {
		const sum = values.cyan + values.mint;
		return sum ? formatPercent((values[p] / sum) * 100) : '–';
	};
	const years = $derived(Object.entries(interestPaid));
	const ends = $derived(Object.entries(yearEnd ?? {}).filter(([, end]) => end.loan.cyan + end.loan.mint > 0));
	// Who owed the other on 31 December, if anyone: debt above 0 means cyan owes mint
	const owes = (debt) => (debt > 0 ? 'cyan' : debt < 0 ? 'mint' : null);
	const anyDebt = $derived(ends.some(([, end]) => end.debt !== 0));
</script>

<Sheet title="tax return" bind:open>
	<div class="scroll">
		<h2>Interest and fees (<em>rentefradrag</em>)</h2>
		<p class="note intro">
			Each person's share of the year's interest and fees. In the skattemelding, under
			<em>Bank, lån og forsikring → Lån og renter</em>, change the shared loan from 50/50 so the interest
			matches these shares, both of you, adding up to 100 %. Do it for each finished year, in spring; it
			can be corrected for up to three years.
		</p>
		<p class="note intro">
			To get the deduction in every salary instead of after the year, enter your amount in kroner for
			the coming year in the skattekort (<em>Skattekort → Endre skattekort</em>, under loans and
			interest), early in the year. Less tax is then taken each month.
		</p>
		<table>
			<thead>
				<tr>
					<th>year</th>
					{#each PEOPLE as p (p)}
						<th class="num"><span class="who"><Face person={p} size={16} />{names[p]}</span></th>
					{/each}
					<th class="num">total</th>
				</tr>
			</thead>
			<tbody>
				{#each years as [year, paid] (year)}
					<tr class:highlight={Number(year) === highlight} class:estimate={paid.estimate}>
						<td>
							{year}
							{#if paid.estimate}<span class="tag">estimate</span>{/if}
						</td>
						{#each PEOPLE as p (p)}
							<td class="num">
								{formatKr(paid[p])}
								<span class="pct">{share(paid, p)} %</span>
							</td>
						{/each}
						<td class="num">{formatKr(paid.cyan + paid.mint)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="note">
			In kroner, interest and fees (both deductible), in the year they built up: the payment on
			1 January is December's, so it counts in the year before. What one of you covered for the other
			counts for the one who paid it. Estimates count months not entered yet at the minimum.
		</p>

		<h2>Debt on 31 December (<em>formue</em>)</h2>
		<p class="note intro">
			Each person's part of the shared loan on 31 December, which reduces your wealth (<em>formue</em>).
			If the skattemelding lets you split the loan and the interest separately, use these shares for
			the loan; if it asks for one share for both, use the interest share above. The apartment's value
			and its share of the housing cooperative's debt (<em>fellesgjeld</em>) are filled in by the
			cooperative at the registered 50/50 and need no change.
		</p>
		<table>
			<thead>
				<tr>
					<th>year</th>
					{#each PEOPLE as p (p)}
						<th class="num"><span class="who"><Face person={p} size={16} />{names[p]}</span></th>
					{/each}
					<th class="num">total</th>
				</tr>
			</thead>
			<tbody>
				{#each ends as [year, end] (year)}
					<tr class:highlight={Number(year) === highlight} class:estimate={interestPaid[year]?.estimate}>
						<td>
							{year}
							{#if interestPaid[year]?.estimate}<span class="tag">estimate</span>{/if}
						</td>
						{#each PEOPLE as p (p)}
							<td class="num">
								{formatKr(end.loan[p])}
								<span class="pct">{share(end.loan, p)} %</span>
								{#if owes(end.debt) === p}
									<span class="owed minus">owes {names[other(p)]} {formatKr(Math.abs(end.debt))}</span>
								{:else if owes(end.debt) === other(p)}
									<span class="owed plus">owed {formatKr(Math.abs(end.debt))}</span>
								{/if}
							</td>
						{/each}
						<td class="num">{formatKr(end.loan.cyan + end.loan.mint)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if anyDebt}
			<p class="note">
				A debt between the two of you on 31 December also counts for wealth: the one who owes enters it
				as debt to a private person (<em>gjeld til privatperson</em>), the one owed as a claim
				(<em>utestående fordring</em>).
			</p>
		{/if}
	</div>
</Sheet>

<style>
	.scroll {
		overflow: auto;
		padding: 0 1.5rem 1.5rem;
	}
	h2 {
		margin: 1.5rem 0 0.5rem;
		font-size: 0.95rem;
	}
	h2:first-child {
		margin-top: 0;
	}
	h2 em {
		font-weight: 400;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		font-variant-numeric: tabular-nums;
	}
	th {
		position: sticky;
		top: 0;
		padding: 0.4rem 0.5rem;
		font-weight: 600;
		text-align: left;
		color: var(--muted);
		background: color-mix(in srgb, var(--surface) 92%, transparent);
	}
	td {
		padding: 0.45rem 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		vertical-align: top;
	}
	.num {
		text-align: right;
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.pct,
	.owed {
		display: block;
		font-size: 0.72rem;
		color: var(--muted);
	}
	.owed.minus {
		color: var(--minus);
	}
	.owed.plus {
		color: var(--plus);
	}
	tr.highlight td {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		font-weight: 600;
	}
	tr.estimate td {
		color: var(--muted);
	}
	.tag {
		display: block;
		font-size: 0.68rem;
		font-weight: 400;
	}
	.note.intro {
		margin: 0 0 1rem;
	}
	.note {
		margin: 1rem 0 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
