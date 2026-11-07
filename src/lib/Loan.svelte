<script>
	import { onMount, tick } from 'svelte';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Calculator from '@lucide/svelte/icons/calculator';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import House from '@lucide/svelte/icons/house';
	import Info from '@lucide/svelte/icons/info';
	import Face from '#lib/Face.svelte';
	import LoanRow from '#lib/LoanRow.svelte';
	import InterestYears from '#lib/InterestYears.svelte';
	import Instalment from '#lib/Instalment.svelte';
	import Owned from '#lib/Owned.svelte';
	import SaleCalculator from '#lib/SaleCalculator.svelte';
	import { loan, changed } from '#lib/loan.svelte.js';
	import { compute, currentMonth, dropStaleTime, formatKr, formatPercent, other, setValue, taxShares, PEOPLE } from '#lib/loan.js';
	import { ui } from '#lib/ui.svelte.js';

	// The current month, refreshed when the page is shown again (the app may stay open past the 1st)
	let today = $state(currentMonth());
	const result = $derived(compute(loan.data, today));
	const names = $derived(loan.data.names);
	const first = $derived(Object.keys(loan.data.payments).sort()[0]);
	const tax = $derived(result && taxShares(result, today));
	let yearsOpen = $state(false);
	let ownedOpen = $state(false);
	let instalmentOpen = $state(false);
	// This month's row, or the first one with a loan payment after it (before the take-over)
	const thisRow = $derived(result?.rows.find((r) => r.loan && r.month >= today));
	// What each person has paid in (egenkapital and principal), of the apartment's cost, in percent
	const ownedShare = (p) => (Math.max(0, result.state.equity[p]) / (result.state.own.cyan + result.state.own.mint)) * 100;
	const debtor = $derived(result && (result.state.debt > 0 ? 'cyan' : result.state.debt < 0 ? 'mint' : null));

	// How far each half of the bar is filled: what that person has paid in, of their share
	const fill = (p) => Math.min(1, Math.max(0, result.state.equity[p] / result.state.own[p] || 0));

	// Only the last two months with a paid amount and the 10 after them show; the rest is collapsed
	const rows = $derived(result?.rows ?? []);
	const filled = $derived(rows.filter((r) => PEOPLE.some((p) => loan.data.payments[r.month]?.[p] != null)));
	const earlier = $derived(filled.length < 2 ? 0 : rows.indexOf(filled.at(-2)));
	const until = $derived(Math.min(rows.length, rows.indexOf(filled.at(-1)) + 11));
	const later = $derived(rows.length - until);
	const visible = $derived(rows.slice(ui.earlier ? 0 : earlier, ui.later ? rows.length : until));

	// The floating button: to the end of the page, or back to the top once within 100px of the end
	let atEnd = $state(false);
	const checkEnd = () => (atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 100);
	const scrollEnd = () => scrollTo({ top: atEnd ? 0 : document.documentElement.scrollHeight, behavior: 'smooth' });
	$effect(() => {
		void rows.length, ui.earlier, ui.later; // the page grows or shrinks with the rows shown
		checkEnd();
	});

	const edit = (month) => (key, value, person) => {
		setValue(loan.data, month, key, value, person);
		dropStaleTime(loan.data);
		changed();
	};

	// Start at this month's row; the list runs for up to 30 years
	onMount(async () => {
		await tick();
		document.querySelector('.row.now')?.scrollIntoView({ block: 'center' });
	});
</script>

<svelte:window onscroll={checkEnd} onresize={checkEnd} />
<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && (today = currentMonth())} />

{#if !result}
	<div class="empty">
		<p>Set the apartment price and the first payment month to start.</p>
		<button class="primary" onclick={() => (ui.view = 'apartment')}><House size={20} />apartment</button>
	</div>
{:else}
	<section class="people">
		{#each PEOPLE as p, i (p)}
			{#if i === 1 && thisRow}
				<button class="icon-button instalment" onclick={() => (instalmentOpen = true)} aria-label="this month's instalment">
					<Calculator size={22} />
				</button>
			{/if}
			<div class="person {p}">
				<Face person={p} size={64} />
				<span class="who">
					<span class="name">{names[p]}</span>
					<!-- What this person has paid of the apartment so far: egenkapital and principal -->
					<span class="owned">{formatKr(Math.max(0, result.state.equity[p]))} kr</span>
					<span class="owned share">
						{formatPercent(ownedShare(p))} %
						<button class="icon-button info small" onclick={() => (ownedOpen = true)} aria-label="what each has paid">
							<Info size={14} />
						</button>
					</span>
					<span class="label">paid</span>
				</span>
			</div>
		{/each}
	</section>

	<div
		class="bar"
		role="img"
		aria-label="{names.cyan} has paid {Math.round(fill('cyan') * 100)}% of their half, {names.mint} {Math.round(fill('mint') * 100)}%"
	>
		<span class="cyan" style:width="{fill('cyan') * 50}%"></span>
		<span class="mint" style:width="{fill('mint') * 50}%"></span>
	</div>
	<!-- Each end: that person's share of the year's interest, for the skattemelding (rentefradrag) -->
	{#snippet taxShare(p)}
		<span class="tax {p}">
			{#if tax}
				<span class="tax-value">
					<span title="{names[p]}'s share of the {tax.year} interest, for the tax return">{formatPercent(tax[p])} %</span>
					<button class="icon-button info" onclick={() => (yearsOpen = true)} aria-label="interest paid per year">
						<Info size={16} />
					</button>
				</span>
				<span class="label">tax return</span>
			{/if}
		</span>
	{/snippet}
	<div class="shares">
		{@render taxShare('cyan')}
		<span>{formatKr(result.state.own.cyan)} / {formatKr(result.state.own.mint)}</span>
		{@render taxShare('mint')}
	</div>

	{#if debtor}
		<div class="banner" role="alert">
			<CircleAlert size={20} />
			<span>
				<strong>{names[debtor]}</strong> owes <strong>{names[other(debtor)]}</strong>
				{formatKr(Math.abs(result.state.debt))} kr
			</span>
		</div>
	{/if}

	<Owned state={result.state} egenkapital={loan.data.egenkapital} {names} bind:open={ownedOpen} />
	<SaleCalculator state={result.state} {names} bind:open={ui.saleOpen} />
	{#if thisRow}<Instalment rows={result.rows.filter((r) => r.loan)} start={thisRow.month} {names} bind:open={instalmentOpen} />{/if}
	<InterestYears interestPaid={result.interestPaid} yearEnd={result.yearEnd} {names} highlight={tax?.year} bind:open={yearsOpen} />

	<div class="rows">
		{#if earlier}
			<button class="more" onclick={() => (ui.earlier = !ui.earlier)}>
				{ui.earlier ? 'hide' : 'show'} {earlier} earlier months
			</button>
		{/if}
		{#each visible as row (row.month)}
			<LoanRow
				{row}
				{today}
				{names}
				entry={loan.data.payments[row.month] ?? {}}
				first={row.month === first}
				onedit={edit(row.month)}
			/>
		{/each}
		{#if later}
			<button class="more after" onclick={() => (ui.later = !ui.later)}>
				{ui.later ? 'hide' : 'show'} {later} later months
			</button>
		{/if}
	</div>

	<button class="icon-button jump" onclick={scrollEnd} aria-label={atEnd ? 'scroll to top' : 'scroll to bottom'}>
		{#if atEnd}<ArrowUp size={22} />{:else}<ArrowDown size={22} />{/if}
	</button>
{/if}

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		padding-top: 3rem;
		text-align: center;
		color: var(--muted);
	}
	.empty p {
		margin: 0;
	}
	.people {
		display: flex;
		justify-content: space-between;
		max-width: 44rem;
		margin: 0 auto;
	}
	/* Names face the middle: cyan's to the right of its face, mint's to the left */
	.person {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.person.mint {
		flex-direction: row-reverse;
	}
	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.person.mint .who {
		align-items: flex-end;
	}
	.owned {
		font-size: 0.85rem; /* the same as the text under the bar */
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.share {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
	}
	.person.mint .share {
		flex-direction: row-reverse;
	}
	.instalment {
		align-self: center;
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		color: var(--muted);
	}
	.info.small {
		width: 22px;
		height: 22px;
	}
	.name {
		overflow: hidden;
		font-size: 1.1rem;
		font-weight: 600;
		letter-spacing: -0.015em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bar {
		position: relative;
		height: 14px;
		max-width: 44rem;
		margin: 1.5rem auto 0;
		background: color-mix(in srgb, var(--border) 60%, transparent);
		overflow: hidden;
	}
	.bar span {
		position: absolute;
		top: 0;
		bottom: 0;
		transition: width 0.4s;
	}
	.bar .cyan {
		left: 0;
		background: var(--cyan);
	}
	.bar .mint {
		right: 0;
		background: var(--mint);
	}
	/* The middle line: where each half ends */
	.bar::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: var(--bg);
	}
	/* Three parts: cyan's share at the left edge, the ownership split centered, mint's at the right */
	.shares {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.75rem;
		max-width: 44rem;
		margin: 0.5rem auto 0;
		text-align: center;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.6rem;
		max-width: 44rem;
		margin: 1.5rem auto 0;
		padding: 0.9rem 1.1rem;
		border-radius: 16px;
		background: color-mix(in srgb, var(--error) 12%, transparent);
		color: var(--error);
		font-size: 0.94rem;
		text-align: center;
	}
	.rows {
		max-width: 44rem;
		margin: 1.5rem auto 0;
	}
	.more {
		display: block;
		margin: 0 auto 1rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.jump {
		position: fixed;
		right: calc(1rem + env(safe-area-inset-right));
		bottom: calc(1rem + env(safe-area-inset-bottom));
		z-index: 10;
		width: 48px;
		height: 48px;
		border: 1px solid var(--border);
		background: var(--surface);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
	}
	.jump:hover:not(:disabled) {
		background: var(--surface);
	}
	.more.after {
		margin: 1rem auto 0;
	}
	/* The percentage with its info icon, and a small label below */
	.tax {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		white-space: nowrap;
	}
	.tax-value {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.label {
		font-size: 0.68rem;
		line-height: 1;
		margin-top: -0.3rem; /* sit close to the percentage; the info icon makes its line taller */
		color: var(--muted);
		opacity: 0.8;
	}
	@media (max-width: 480px) {
		.shares,
		.owned {
			font-size: 0.72rem;
		}
		.shares {
			gap: 0.4rem;
		}
	}
	/* The info icon sits on the inner side: after cyan's percentage, before mint's */
	.tax.mint {
		align-items: flex-end;
		justify-self: end;
	}
	.tax.mint .tax-value {
		flex-direction: row-reverse;
	}
	.info {
		width: 26px;
		height: 26px;
		color: var(--muted);
	}
</style>
