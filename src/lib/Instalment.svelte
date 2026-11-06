<script>
	import Face from '#lib/Face.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { formatKr, formatPercent, instalmentFor, parseAmount, toOre, PEOPLE } from '#lib/loan.js';

	// Each person's part of a month's bank instalment (samboerkontrakt 3.2), for any month and with
	// the rate, fee and parts changeable to try things out. An empty field uses the month's own value.
	// rows: the rows from compute() with a loan; start: the month to open on; open: bindable
	let { rows, start, names, open = $bindable(false) } = $props();

	let month = $state(start);
	let edits = $state({});
	const row = $derived(rows.find((r) => r.month === month) ?? rows[0]);

	const typed = (key) => parseAmount(edits[key] ?? '') ?? undefined;
	const rate = $derived(typed('rate') ?? row.rate);
	const fee = $derived(typed('fee') !== undefined ? toOre(typed('fee')) : row.fee);
	const part = (p) => (typed(p) !== undefined ? toOre(typed(p)) : row.people[p].balance);
	const result = $derived(instalmentFor(row, { balance: { cyan: part('cyan'), mint: part('mint') }, rate, fee }));
	const share = (p) => (result.total ? result.people[p].total / result.total : 0);

	// What the bank actually charges, split by the same shares
	const bank = $derived(typed('bank') !== undefined ? toOre(typed('bank')) : null);
	const pays = (p) => (p === 'cyan' ? Math.round(bank * share('cyan')) : bank - Math.round(bank * share('cyan')));

	const label = (m) => new Date(`${m}-01T12:00:00`).toLocaleDateString('en', { month: 'short', year: 'numeric' }).toLowerCase();
	const lines = [
		['interest', (p) => formatKr(result.people[p].interest)],
		['principal', (p) => formatKr(result.people[p].principal)],
		['fee', (p) => formatKr(result.people[p].fee)],
		['instalment', (p) => formatKr(result.people[p].total)],
		['share', (p) => `${formatPercent(share(p) * 100)} %`]
	];
</script>

<Sheet title="instalment" bind:open>
	<div class="scroll">
		<div class="fields">
			<label class="wide">
				month
				<select bind:value={month} onchange={() => (edits = {})}>
					{#each rows as r (r.month)}<option value={r.month}>{label(r.month)}</option>{/each}
				</select>
			</label>
			<label>
				interest (%)
				<input bind:value={edits.rate} inputmode="decimal" placeholder={formatPercent(row.rate)} />
			</label>
			<label>
				fee (kr)
				<input bind:value={edits.fee} inputmode="decimal" placeholder={formatKr(row.fee)} />
			</label>
		</div>

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
				<tr>
					<td>loan left</td>
					{#each PEOPLE as p (p)}
						<td class="num">
							<input
								class="cell"
								bind:value={edits[p]}
								inputmode="decimal"
								placeholder={formatKr(row.people[p].balance)}
								aria-label="{names[p]}'s loan left"
							/>
						</td>
					{/each}
				</tr>
				{#each lines as [name, show] (name)}
					<tr class:total={name === 'instalment' || name === 'share'}>
						<td>{name}</td>
						{#each PEOPLE as p (p)}<td class="num">{show(p)}</td>{/each}
					</tr>
				{/each}
				{#if bank !== null}
					<tr class="total">
						<td>pays</td>
						{#each PEOPLE as p (p)}<td class="num">{formatKr(pays(p))}</td>{/each}
					</tr>
				{/if}
			</tbody>
		</table>

		<label class="bank">
			bank instalment (kr)
			<input bind:value={edits.bank} inputmode="decimal" placeholder={formatKr(result.total)} />
		</label>

		<p class="note">
			In kroner. Each of you pays the instalment on your own part of the loan, and the fee is split
			equally (3.2). Change any field to try other numbers; an empty field uses the month's own value.
			Type what the bank charges to split it by the shares.
		</p>
	</div>
</Sheet>

<style>
	.scroll {
		overflow: auto;
		padding: 0 1.5rem 1.5rem;
	}
	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.75rem;
	}
	.wide {
		grid-column: 1 / -1;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.bank {
		margin-top: 1rem;
	}
	input,
	select {
		font: inherit;
		font-size: 1rem;
		padding: 0.5rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		text-align: right;
		width: 100%;
		box-sizing: border-box;
	}
	select {
		text-align: left;
	}
	input.cell {
		font-size: 0.82rem;
		padding: 0.3rem 0.5rem;
		border-radius: 8px;
	}
	input:focus,
	select:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	input::placeholder {
		color: var(--muted);
		opacity: 0.8;
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
