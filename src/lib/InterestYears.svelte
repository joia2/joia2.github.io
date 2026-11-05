<script>
	import Face from '#lib/Face.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { formatKr, formatPercent, PEOPLE } from '#lib/loan.js';

	// interestPaid: from compute(); open: bindable, whether the popup shows
	let { interestPaid, names, highlight, open = $bindable(false) } = $props();

	const share = (paid, p) => {
		const sum = paid.cyan + paid.mint;
		return sum ? formatPercent((paid[p] / sum) * 100) : '–';
	};
	const years = $derived(Object.entries(interestPaid));
</script>

<!-- The bank interest each person paid per year: what the skattemelding splits (rentefradrag) -->
<Sheet title="interest and fees" bind:open>
	<div class="scroll">
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
	.pct {
		display: block;
		font-size: 0.72rem;
		color: var(--muted);
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
	.note {
		margin: 1rem 0 0;
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
