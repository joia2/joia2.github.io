<script>
	import Pct from '#lib/Pct.svelte';
	import Face from '#lib/Face.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { formatKr, formatPercent, instalmentFor, PEOPLE } from '#lib/loan.js';
	// Each person's part of a month's bank instalment (samboerkontrakt 3.2), for any month.
	// rows: the rows from compute() with a loan; start: the month to open on; open: bindable
	let { rows, start, names, open = $bindable(false) } = $props();
	let month = $state(start);
	const row = $derived(rows.find((r) => r.month === month) ?? rows[0]);
	const balance = $derived({ cyan: row.people.cyan.balance, mint: row.people.mint.balance });
	const result = $derived(instalmentFor(row, { balance, rate: row.rate, fee: row.fee }));
	const share = (p) => (result.total ? result.people[p].total / result.total : 0);
	// "2027 jan"
	const label = (m) => `${m.slice(0, 4)} ${new Date(`${m}-01T12:00:00`).toLocaleDateString('en', { month: 'short' }).toLowerCase()}`;
	const lines = [
		['loan left', (p) => formatKr(balance[p])],
		['interest', (p) => formatKr(result.people[p].interest)],
		['principal', (p) => formatKr(result.people[p].principal)],
		['fee', (p) => formatKr(result.people[p].fee)],
		['instalment', (p) => formatKr(result.people[p].total)],
		['share', (p) => formatPercent(share(p) * 100), true]
	];
</script>

<Sheet title="instalment" bind:open>
	<div class="scroll">
		<label>
			month
			<select bind:value={month}>
				{#each rows as r (r.month)}<option value={r.month}>{label(r.month)}</option>{/each}
			</select>
		</label>
		<p class="terms">{formatPercent(row.rate)}<Pct /> · fee {formatKr(row.fee)} kr · bank {formatKr(result.total)} kr</p>
		<table>
			<thead>
				<tr>
					<th></th>
					{#each PEOPLE as p (p)}
						<th class="num"><span class="who"><Face person={p} size={16} />{names[p]}</span></th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each lines as [name, show, pct] (name)}
					<tr class:total={name === 'instalment' || name === 'share'}>
						<td>{name}</td>
						{#each PEOPLE as p (p)}<td class="num">{show(p)}{#if pct}<Pct />{/if}</td>{/each}
					</tr>
				{/each}
				<tr>
					<td>a quarter of the interest</td>
					<td class="num" colspan="2">{formatKr(Math.round((result.people.cyan.interest + result.people.mint.interest) / 4))}</td>
				</tr>
			</tbody>
		</table>
		<p class="note">
			In kroner. Each of you pays the instalment on your own part of the loan, and the fee is split
			equally (3.2). A quarter of the interest: what the one living in the home alone pays the other
			each month after a termination notice (7.2).
		</p>
	</div>
</Sheet>

<style>
	.scroll {
		overflow: auto;
		padding: 0 1.5rem 1.5rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.terms {
		margin: 0.6rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
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
	table {
		width: 100%;
		margin-top: 1rem;
		border-collapse: collapse;
		font-size: 0.82rem;
		font-variant-numeric: tabular-nums;
	}
	th {
		padding: 0.4rem 0.5rem;
		font-weight: 600;
		color: var(--muted);
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
