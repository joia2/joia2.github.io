<script>
	import Face from '#lib/Face.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { formatKr, formatPercent, PEOPLE } from '#lib/loan.js';

	// Each person's part of one month's bank instalment (samboerkontrakt 3.2).
	// row: a row from compute(); open: bindable, whether the popup shows
	let { row, names, open = $bindable(false) } = $props();

	const total = $derived(row.people.cyan.min + row.people.mint.min);
	const month = $derived(new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' }).toLowerCase());
	const lines = [
		['interest', (s) => formatKr(s.interestDue)],
		['principal', (s) => formatKr(s.principalDue)],
		['fee', (s) => formatKr(s.feeDue)],
		['instalment', (s) => formatKr(s.min)],
		['share of the bank instalment', (s) => `${formatPercent(total ? (s.min / total) * 100 : 0)} %`]
	];
</script>

<Sheet title="instalment" bind:open>
	<div class="scroll">
		<table>
			<thead>
				<tr>
					<th>{month}</th>
					{#each PEOPLE as p (p)}
						<th class="num"><span class="who"><Face person={p} size={16} />{names[p]}</span></th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each lines as [label, show] (label)}
					<tr class:total={label !== 'interest' && label !== 'principal' && label !== 'fee'}>
						<td>{label}</td>
						{#each PEOPLE as p (p)}<td class="num">{show(row.people[p])}</td>{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="note">
			In kroner. The bank instalment this month is {formatKr(total)} kr. Each of you pays the instalment on
			your own part of the loan, and the fee is split equally (3.2). This is the minimum: paying more is an
			extra payment.
		</p>
	</div>
</Sheet>

<style>
	.scroll {
		overflow: auto;
		padding: 0 1.5rem 1.5rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.82rem;
		font-variant-numeric: tabular-nums;
	}
	th {
		padding: 0.4rem 0.5rem;
		font-weight: 600;
		color: var(--muted);
		text-align: left;
	}
	td {
		padding: 0.45rem 0.5rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.num {
		text-align: right;
	}
	.who {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	tr.total td {
		font-weight: 600;
	}
	.note {
		margin: 1rem 0 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
