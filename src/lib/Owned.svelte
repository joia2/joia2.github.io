<script>
	import Face from '#lib/Face.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { formatKr, formatPercent, toOre, PEOPLE } from '#lib/loan.js';

	// What each person owns of the apartment and where it comes from.
	// state: result.state from compute(); open: bindable, whether the popup shows
	let { state, egenkapital, names, open = $bindable(false) } = $props();

	const value = $derived(state.own.cyan + state.own.mint); // the price plus the costs paid so far
	const owned = (p) => Math.max(0, state.equity[p]);
	const signed = (ore) => (ore > 0 ? '+' : ore < 0 ? '−' : '') + formatKr(Math.abs(ore));
	const lines = $derived([
		['owns', (p) => `${formatPercent(owned(p) / value * 100)} %`],
		['egenkapital', (p) => formatKr(toOre(egenkapital?.[p] ?? 0))],
		['principal paid', (p) => formatKr(owned(p) - toOre(egenkapital?.[p] ?? 0) - state.costs[p].maintenance - state.costs[p].improvement - state.covered[p])],
		['covered', (p) => signed(state.covered[p])],
		['maintenance paid', (p) => formatKr(state.costs[p].maintenance)],
		['improvement paid', (p) => formatKr(state.costs[p].improvement)],
		['owned in total', (p) => formatKr(owned(p))],
		['principal left', (p) => formatKr(state.balance[p])]
	]);
</script>

<Sheet title="owned" bind:open>
	<div class="scroll">
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
				{#each lines as [label, show], i (label)}
					<tr class:total={i === 0 || label === 'owned in total'}>
						<td>{label}</td>
						{#each PEOPLE as p (p)}<td class="num">{show(p)}</td>{/each}
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="note">
			In kroner, as of this month. "Owns" is the share of the apartment's value: the price plus the
			maintenance and improvement costs. Covered: what one of you paid for the other, + for the one who paid
			and − for the one it was paid for. Principal the other paid on your part counts in your principal
			paid, and then in covered as −.
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
