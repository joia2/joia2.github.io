<script>
	import Face from '#lib/Face.svelte';
	import Pct from '#lib/Pct.svelte';
	import { formatKr, formatPercent, other, PEOPLE } from '#lib/loan.js';

	// A year at a glance, after its December: what each paid, and the two numbers for the skattemelding.
	// rows: that year's months from compute(); paid: result.interestPaid[year]; end: result.yearEnd[year]
	let { year, rows, paid, end, names } = $props();

	const loanRows = $derived(rows.filter((r) => r.loan));
	const total = (p, key) => loanRows.reduce((s, r) => s + r.people[p][key], 0);
	// Not every month entered yet: counted at the minimum
	const estimate = $derived(Boolean(paid?.estimate) || loanRows.some((r) => PEOPLE.some((p) => !r.people[p].typed && r.people[p].min)));
	const share = (values, p) => formatPercent(values.cyan + values.mint ? (values[p] / (values.cyan + values.mint)) * 100 : 0);
	const owes = $derived(end?.debt > 0 ? 'cyan' : end?.debt < 0 ? 'mint' : null);
</script>

<div class="summary">
	<div class="head">
		<strong>{year}</strong>
		{#if estimate}<span class="tag">estimate</span>{/if}
	</div>
	{#each PEOPLE as p (p)}
		<dl class={p}>
			<dt class="who"><Face person={p} size={16} />{names[p]}</dt>
			<dd></dd>
			<dt>paid</dt>
			<dd>{formatKr(total(p, 'paid'))}</dd>
			<dt>principal</dt>
			<dd>{formatKr(total(p, 'principal'))}</dd>
			{#if paid}
				<!-- Skattemelding: interest and fees that built up in the year (rentefradrag) -->
				<dt><span class="long">interest</span><span class="short">int.</span> + fees ({share(paid, p)}<Pct />)</dt>
				<dd class="tax">{formatKr(paid[p])}</dd>
			{/if}
			{#if end}
				<!-- Skattemelding: each person's part of the loan on dec 31 (gjeld) -->
				<dt>loan dec 31 ({share(end.loan, p)}<Pct />)</dt>
				<dd class="tax">{formatKr(end.loan[p])}</dd>
				{#if owes === p}
					<dt class="minus">owes {names[other(p)]}</dt>
					<dd class="minus">{formatKr(Math.abs(end.debt))}</dd>
				{:else if owes === other(p)}
					<dt class="plus">owed</dt>
					<dd class="plus">{formatKr(Math.abs(end.debt))}</dd>
				{/if}
			{/if}
		</dl>
	{/each}
	<p class="note">
		For the skattemelding: interest + fees as each one's <em>rentefradrag</em>, loan dec 31 as each one's
		<em>gjeld</em>{#if owes}, and the debt between you as a private debt and claim{/if}.
		{#if estimate}An estimate: months not entered count at the minimum.{/if}
	</p>
</div>

<style>
	.summary {
		position: relative;
		isolation: isolate;
		display: grid;
		--space: clamp(0.25rem, 4vw - 0.5rem, 2.5rem);
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem max(0.75rem, var(--space));
		padding: 0.9rem var(--space);
		margin: 0.4rem 0;
	}
	/* A soft cyan and mint wash, blurred at the edges */
	.summary::before {
		content: '';
		position: absolute;
		inset: 0.2rem;
		z-index: -1;
		border-radius: 18px;
		background: linear-gradient(90deg, var(--cyan), var(--mint));
		opacity: 0.2;
		filter: blur(12px);
	}
	.head {
		grid-column: 1 / -1;
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.4rem;
	}
	strong {
		font-size: 1rem;
		letter-spacing: -0.01em;
	}
	.tag {
		font-size: 0.66rem;
		color: var(--muted);
	}
	dl {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: space-between;
		align-content: start;
		gap: 0.1rem 0.5rem;
		margin: 0;
		padding: 0 0.6rem;
		font-size: 0.78rem;
		line-height: 1.3;
	}
	dt {
		color: var(--muted);
		white-space: nowrap;
	}
	dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.short {
		display: none;
	}
	.who {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		margin-bottom: 0.2rem;
		color: var(--text);
		font-weight: 600;
	}
	/* The two numbers to type in the skattemelding */
	.tax {
		font-weight: 600;
	}
	.minus {
		color: var(--minus);
	}
	.plus {
		color: var(--plus);
	}
	.note {
		grid-column: 1 / -1;
		margin: 0.2rem 0 0;
		padding: 0 0.6rem;
		font-size: 0.7rem;
		color: var(--muted);
		text-align: center;
	}
	@media (max-width: 480px) {
		.summary {
			gap: 0.4rem;
			padding-inline: 0;
		}
		dl {
			gap: 0.1rem 0.3rem;
			padding: 0 0.3rem;
			font-size: 0.66rem;
		}
		.long {
			display: none;
		}
		.short {
			display: inline;
		}
	}
</style>
