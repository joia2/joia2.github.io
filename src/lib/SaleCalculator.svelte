<script>
	import Face from '#lib/Face.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { formatKr, formatPercent, parseAmount, saleSplit, toOre, PEOPLE } from '#lib/loan.js';

	// What each person gets if the apartment is sold now (samboerkontrakt 7.8 and 7.9).
	// state: result.state from compute() (named `now` here: a variable called `state` would turn the
	// $state rune into a store subscription); open: bindable, whether the popup shows
	let { state: now, names, open = $bindable(false) } = $props();

	let price = $state('');
	let costs = $state('');
	const amount = (text) => toOre(parseAmount(text) ?? 0);
	const sale = $derived(saleSplit(now, amount(price), amount(costs)));
	const signed = (ore) => (ore < 0 ? '−' : '') + formatKr(Math.abs(ore));
</script>

<Sheet title="sale calculator" bind:open>
	<div class="scroll">
		<label>
			sale price (kr)
			<input bind:value={price} inputmode="decimal" placeholder="0,00" />
		</label>
		<label>
			costs of sale (kr)
			<input bind:value={costs} inputmode="decimal" placeholder="estate agent's fees and other costs" />
		</label>

		<table>
			<tbody>
				<tr><td>sale price</td><td class="num">{formatKr(amount(price))}</td></tr>
				<tr><td>− costs of sale</td><td class="num">{formatKr(amount(costs))}</td></tr>
				<tr><td>− loan left</td><td class="num">{formatKr(sale.loanLeft)}</td></tr>
				<tr class="total"><td>net proceeds</td><td class="num">{signed(sale.net)}</td></tr>
			</tbody>
		</table>

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
					<td>ownership share</td>
					{#each PEOPLE as p (p)}<td class="num">{formatPercent(sale.share[p] * 100)} %</td>{/each}
				</tr>
				<tr>
					<td>{sale.net < 0 ? 'share of the loss' : 'share of the proceeds'}</td>
					{#each PEOPLE as p (p)}<td class="num">{signed(sale.proceeds[p])}</td>{/each}
				</tr>
				{#if now.debt}
					<tr>
						<td>debt settled</td>
						{#each PEOPLE as p (p)}<td class="num">{sale.settled[p] > 0 ? '+' : ''}{signed(sale.settled[p])}</td>{/each}
					</tr>
				{/if}
				<tr class="total">
					<td>{sale.net < 0 && sale.gets.cyan < 0 && sale.gets.mint < 0 ? 'pays' : 'gets'}</td>
					{#each PEOPLE as p (p)}<td class="num">{signed(sale.gets[p])}</td>{/each}
				</tr>
			</tbody>
		</table>

		<p class="note">
			As of this month, under the samboerkontrakt. The net proceeds are divided by ownership share:
			what each of you has paid in, of what both have paid in (4.1, 7.8). A loss is borne in
			proportion to each person's loan left. A debt between you is settled from the proceeds (7.9).
			A negative amount is what that person must pay in.
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
		margin-bottom: 0.75rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	input {
		font: inherit;
		font-size: 1rem;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		text-align: right;
	}
	input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	input::placeholder {
		color: var(--muted);
		opacity: 0.8;
		text-align: right;
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
