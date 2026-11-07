<script>
	import Pct from '#lib/Pct.svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-exclamation-point';
	import Check from '@lucide/svelte/icons/check';
	import MoveLeft from '@lucide/svelte/icons/move-left';
	import MoveRight from '@lucide/svelte/icons/move-right';
	import { formatAmount, formatKr, formatPercent, parseAmount, PEOPLE } from '#lib/loan.js';
	import { typing } from '#lib/loan.svelte.js';

	// row: one month from compute(); entry: what the data file holds for that month
	let { row, entry, first, today, names, onedit } = $props();

	// "2026 dec": the payment made on 1 December 2026
	const label = $derived(
		`${row.month.slice(0, 4)} ${new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en', { month: 'short' }).toLowerCase()}`
	);

	// Saves a field when it loses focus. Text that isn't an amount puts the field back as it was.
	// key: a person ('cyan', 'mint'), 'interest' or 'fee'
	const edited = (key) => (event) => {
		const input = event.currentTarget;
		const value = parseAmount(input.value);
		const keepsRate = key === 'interest' && first && value === null; // the first month must have a rate
		if (value === undefined || keepsRate) {
			input.value = key === 'interest' ? (entry.interest ?? '') : shown(key);
			return;
		}
		onedit(key, value);
	};

	// The debt one person repaid in money this month: kept per person, like `time`
	const editedDebt = (p) => (event) => {
		const input = event.currentTarget;
		const value = parseAmount(input.value);
		if (value === undefined) {
			input.value = formatAmount(entry.debt?.[p]);
			return;
		}
		onedit('debt', value, p);
	};

	// The checkbox inside a paid field: checked when any amount is entered. Ticking stores today's
	// minimum as the amount paid; unticking clears it.
	const paidMinimum = (s) => s.typed;
	const toggleMinimum = (p) => onedit(p, paidMinimum(row.people[p]) ? null : row.people[p].min / 100);

	// What a paid field shows: the amount typed
	const shown = (key) => formatAmount(entry[key]);
	// The fee without øre when it has none: 60, or 60,50
	const whole = (kr) => (kr == null || kr === '' ? '' : new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(kr));

	// What the bank charges this month, and each person's part of it, of the principal and of the
	// interest, in percent: 56,25
	const sum = (key) => row.people.cyan[key] + row.people.mint[key];
	const bank = $derived(row.loan ? sum('min') : 0);
	const part = (p, key) => formatPercent(sum(key) ? (row.people[p][key] / sum(key)) * 100 : 0);

	// Swiping a row on a touch screen ticks or unticks a side: right for the left person, left for
	// the right one. Vertical scrolling stays with the browser (touch-action), which cancels the swipe.
	// Behind the row, the side's color and a check show as it slides; the side is kept after
	// release so the color stays while the row slides back.
	let startX = null;
	let dx = $state(0);
	let side = $state('cyan');
	const swipeStart = (e) => {
		if (e.pointerType !== 'mouse' && row.loan && e.target !== document.activeElement) startX = e.clientX;
	};
	const swipeMove = (e) => {
		if (startX === null) return;
		dx = e.clientX - startX;
		side = PEOPLE[dx > 0 ? 0 : 1];
	};
	const swipeEnd = (e) => {
		const p = PEOPLE[dx > 0 ? 0 : 1];
		if (e.type === 'pointerup' && Math.abs(dx) > 60 && row.people[p].min) toggleMinimum(p);
		startX = null;
		dx = 0;
	};
</script>

<div class="swipe">
<span class="reveal {side}" style:opacity={Math.min(1, Math.abs(dx) / 60)}><Check size={22} /></span>
<div
	class="row"
	class:now={row.month === today}
	class:swiping={dx}
	data-month={row.month}
	style:transform={dx ? `translateX(${Math.max(-80, Math.min(80, dx * 0.6))}px)` : null}
	onpointerdown={swipeStart}
	onpointermove={swipeMove}
	onpointerup={swipeEnd}
	onpointercancel={swipeEnd}
>
	{#each PEOPLE as p, i (p)}
		{#if i === 1}
			<div class="mid">
				{#if row.loan}
					<!-- The bank's total for the month; each person's part of it shows beside their field -->
					<span class="bank" title="what the bank charges this month">
						<MoveLeft size={12} />{formatKr(bank)}<MoveRight size={12} />
					</span>
				{/if}
				<span class="month">{label}</span>
				<!-- The rate and the fee on one line: (5.03%) (60 kr) -->
				<span class="rates">
				<span class="affix">
					<input
						class="suffixed"
						inputmode="decimal"
						value={entry.interest ?? ''}
						placeholder={String(row.rate)}
						aria-label="interest in percent"
						oninput={typing}
						onchange={edited('interest')}
					/>
					<span class="suffix" aria-hidden="true">%</span>
				</span>
				{#if row.loan}
					<span class="affix">
						<input
							class="suffixed"
							inputmode="decimal"
							value={whole(entry.fee)}
							placeholder={whole(row.fee / 100)}
							aria-label="fee in kroner"
							oninput={typing}
							onchange={edited('fee')}
						/>
						<span class="suffix" aria-hidden="true">kr</span>
					</span>
				{/if}
				</span>
			</div>
		{/if}

		<div class="side {p}">
			{#if row.loan}
				{@const s = row.people[p]}
				<span class="payline">
				<span class="affix">
					<button
						class="minimum {p}"
						role="checkbox"
						aria-checked={paidMinimum(s)}
						aria-label="{names[p]} paid"
						disabled={!s.min}
						onclick={() => toggleMinimum(p)}
					>
						{#if paidMinimum(s)}<Check size={14} />{/if}
					</button>
					<input
						class="checkable"
						inputmode="decimal"
						value={shown(p)}
						placeholder={formatKr(s.min)}
						aria-label="paid by {names[p]}"
						oninput={typing}
						onchange={edited(p)}
					/>
				</span>
				<span class="share" title="{names[p]}'s part of what the bank charges">{part(p, 'min')}<Pct /></span>
				</span>
				<dl>
					<dt>principal</dt>
					<dd>{formatKr(s.principal)}</dd>
					<dt><span class="long">interest</span><span class="short">int.</span> ({part(p, 'interest')}<Pct />)</dt>
					<dd>{formatKr(s.interest)}</dd>
				</dl>
				{#if s.covered < 0}
					<p class="minus">−{formatKr(-s.covered)} kr</p>
				{:else if s.covered > 0}
					<p class="plus">+{formatKr(s.covered)} kr</p>
				{/if}
				{#if row.owing === p || entry.debt?.[p] != null}
					<!-- While this person owes the other, the debt can also be repaid in money (3.4.3).
					     An amount once typed always shows, so it can be seen and cleared. -->
					<span class="affix">
						<span class="prefix" aria-hidden="true">debt</span>
						<input
							class="prefixed debt"
							inputmode="decimal"
							value={formatAmount(entry.debt?.[p])}
							placeholder="0,00"
							aria-label="debt repaid in money by {names[p]}"
							oninput={typing}
							onchange={editedDebt(p)}
						/>
					</span>
					{#if row.debtSurplus[p]}
						<p class="warn">
							<TriangleAlert size={14} />{formatKr(row.debtSurplus[p])} kr {row.owing === p ? 'more than the debt' : 'but no debt to repay'}
						</p>
					{/if}
					{#if Math.sign(row.debt) === (p === 'cyan' ? 1 : -1)}
						<p class="minus">still owes {formatKr(Math.abs(row.debt))} kr</p>
					{/if}
				{/if}
				{#if s.uncovered}
					<p class="warn"><TriangleAlert size={14} />{formatKr(s.uncovered)} kr unpaid</p>
				{/if}
				{#if s.surplus}
					<p class="warn"><TriangleAlert size={14} />{formatKr(s.surplus)} kr more than owed</p>
				{/if}
				{#if s.typed && s.extra > s.surplus}
					<!-- What the extra paid does: lower the next payments, or keep them and finish sooner -->
					<button
						class="toggle"
						role="switch"
						aria-checked={s.time}
						aria-label="extra shortens the time instead of lowering the payment"
						onclick={() => onedit('time', !s.time, p)}
					>
						<span class:on={!s.time}>−pay</span>
						<span class="track"><span class="knob"></span></span>
						<span class:on={s.time}>−time{#if s.monthsSaved}<span> ({s.monthsSaved})</span>{/if}</span>
					</button>
				{/if}
			{:else if row.debtor === p}
				<input
					inputmode="decimal"
					value={formatAmount(entry[p])}
					placeholder="0,00"
					aria-label="paid by {names[p]}"
					oninput={typing}
					onchange={edited(p)}
				/>
				<dl>
					<dt>interest</dt>
					<dd>+{formatKr(row.debtInterest)}</dd>
				</dl>
				<p class="minus">−{formatKr(Math.abs(row.debt))} kr</p>
				{#if row.surplus}
					<p class="warn"><TriangleAlert size={14} />{formatKr(row.surplus)} kr more than owed</p>
				{/if}
			{:else}
				<p class="plus">+{formatKr(Math.abs(row.debt))} kr</p>
			{/if}
		</div>
	{/each}
</div>
</div>

<style>
	.swipe {
		position: relative;
		overflow: hidden;
	}
	.reveal {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		padding-inline: 1.5rem;
		background: var(--cyan);
		color: #0b2a2e;
		transition: opacity 0.2s;
	}
	.swipe:has(.swiping) .reveal {
		transition: none;
	}
	.swipe:has(.now) {
		border-radius: 14px;
	}
	.reveal.mint {
		justify-content: flex-end;
		background: var(--mint);
	}
	.row {
		position: relative;
		background: var(--bg);
		display: grid;
		/* The same space at both outer edges and between the columns keeps the fields narrow on
		   wide screens; it shrinks with the screen */
		--space: clamp(0.25rem, 4vw - 0.5rem, 2.5rem);
		grid-template-columns: 1fr 6.25rem 1fr;
		gap: 0.75rem max(0.75rem, var(--space));
		padding: 0.9rem var(--space);
		scroll-margin-top: 56px; /* lands below the top bar when jumped to */
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
		touch-action: pan-y;
		transition: transform 0.2s;
	}
	.row.swiping {
		transition: none;
	}
	.row.now {
		background: color-mix(in srgb, var(--accent) 7%, var(--bg)); /* opaque: hides the reveal */
		border-radius: 14px;
	}
	.side,
	.mid {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}
	.side.mint {
		text-align: right;
	}
	.mid {
		text-align: center;
	}
	/* On the fields' line: as tall as they are, so the three line up */
	.bank {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.15rem;
		min-height: 1.6rem;
		font-size: 0.78rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.bank :global(svg) {
		flex: none;
		color: var(--muted);
	}
	/* The paid field and, on its inner side, this person's part of the bank's total */
	.payline {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.side.mint .payline {
		flex-direction: row-reverse;
	}
	.payline .affix {
		flex: 1;
		min-width: 0;
	}
	.share {
		flex: none;
		font-size: 0.72rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.month {
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1;
		margin-bottom: 0.2rem;
		letter-spacing: -0.01em;
	}
	input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.94rem;
		padding: 0.3rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--text);
		text-align: inherit;
	}
	input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	input::placeholder {
		color: var(--muted);
		opacity: 0.8;
	}
	.mid input {
		background: transparent;
		border-color: color-mix(in srgb, var(--border) 50%, transparent);
		text-align: right;
		padding: 0.05rem 0.4rem;
		line-height: 1.25;
		border-radius: 8px;
		font-size: 0.75rem;
	}
	.mid input:focus {
		border-color: var(--accent);
	}
	.rates {
		display: flex;
		gap: 0.2rem;
	}
	.rates .affix {
		flex: 1;
		min-width: 0;
	}
	/* The rate needs more room than the fee: 5.03 against 60 */
	.rates .affix:first-child {
		flex: 1.5;
	}
	.mid .rates input.suffixed {
		padding: 0.05rem 0.85rem 0.05rem 0.2rem;
		font-size: 0.7rem;
	}
	.rates .suffix {
		right: 0.3rem;
		font-size: 0.6rem;
	}
	/* A unit or name shown inside a field, not editable: "fee [ 50 ] kr", "[ 4.78 ] %" */
	.affix {
		position: relative;
		display: flex;
	}
	.prefix,
	.suffix {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		font-size: 0.65rem;
		color: var(--muted);
		pointer-events: none;
	}
	.prefix {
		left: 0.45rem;
	}
	.suffix {
		right: 0.45rem;
	}
	/* The minimum checkbox, inside the paid field on the left. Centered with margins, not a
	   transform: the shared button press style changes transforms, which made the box jump down
	   under the pointer and lose the click. While pressed it grows in place instead. */
	.minimum {
		position: absolute;
		left: 0.5rem;
		top: 0;
		bottom: 0;
		margin: auto 0;
		display: grid;
		place-items: center;
		width: 1.05rem;
		height: 1.05rem;
		padding: 0;
		border: 1.5px solid var(--border);
		border-radius: 5px;
		background: transparent;
		color: #0b2a2e;
		transition: transform 0.15s ease-out;
	}
	.minimum:hover:not(:disabled) {
		border-color: var(--muted);
		background: transparent;
	}
	.minimum:active:not(:disabled) {
		transform: scale(1.35);
	}
	@media (prefers-reduced-motion: reduce) {
		.minimum {
			transition: none;
		}
	}
	.minimum[aria-checked='true'].cyan {
		border-color: var(--cyan);
		background: var(--cyan);
	}
	.minimum[aria-checked='true'].mint {
		border-color: var(--mint);
		background: var(--mint);
	}
	.minimum:disabled {
		opacity: 0.3;
	}
	input.checkable {
		padding-left: 2rem;
	}
	.mid input.prefixed {
		padding-left: 1.6rem;
	}
	/* The debt repaid in money: smaller than the payment field, like the middle ones */
	input.debt {
		padding: 0.1rem 0.5rem 0.1rem 2.2rem;
		font-size: 0.8rem;
		border-radius: 8px;
	}
	.side .prefix {
		left: 0.6rem;
	}
	.mid input.suffixed {
		padding-right: 1.25rem;
	}
	dl {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: space-between;
		gap: 0 0.5rem;
		margin: 0;
		padding: 0 0.6rem;
		font-size: 0.78rem;
		line-height: 1.3;
	}
	dt {
		color: var(--muted);
		white-space: nowrap;
		text-align: left; /* also on mint's side, where the rest is right-aligned */
	}
	.short {
		display: none;
	}
	dd {
		margin: 0;
		color: var(--muted);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	p {
		margin: 0;
		padding: 0 0.6rem;
		font-size: 0.82rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.minus {
		color: var(--minus);
	}
	.plus {
		color: var(--plus);
	}
	.warn {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--warn);
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.05rem 0.6rem;
		border: 0;
		font-size: 0.66rem;
		color: var(--muted);
	}
	.side.mint :is(.warn, .toggle) {
		justify-content: flex-end;
	}
	.toggle:hover:not(:disabled) {
		background: transparent;
	}
	.toggle .on {
		color: var(--text);
		font-weight: 600;
	}
	.track {
		position: relative;
		width: 1.8rem;
		height: 1rem;
		border-radius: 1rem;
		background: var(--border);
	}
	.knob {
		position: absolute;
		top: 0.125rem;
		left: 0.125rem;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--surface);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
		transition: transform 0.2s;
	}
	.toggle[aria-checked='true'] .knob {
		transform: translateX(0.8rem);
	}
	.toggle[aria-checked='true'] .track {
		background: var(--accent);
	}
	/* Phones: a narrower middle and smaller details keep each side on one line per value */
	@media (max-width: 480px) {
		.row {
			grid-template-columns: 1fr 5.5rem 1fr;
			gap: 0.4rem;
			padding-inline: 0.5rem;
		}
		dl {
			gap: 0.1rem 0.25rem;
			padding: 0 0.3rem;
			font-size: 0.64rem;
		}
		.payline {
			gap: 0.15rem;
		}
		.share {
			font-size: 0.56rem;
		}
		input.checkable {
			padding-left: 1.55rem;
			padding-right: 0.35rem;
		}
		.minimum {
			left: 0.35rem;
			width: 0.95rem;
			height: 0.95rem;
		}
		.bank {
			gap: 0;
			font-size: 0.66rem;
		}
		/* "pri." and "int.": the whole words leave no room for the amount */
		.long {
			display: none;
		}
		.short {
			display: inline;
		}
		.side > p,
		.toggle {
			padding-inline: 0.5rem;
		}
		input {
			font-size: 0.8rem;
			padding: 0.25rem 0.35rem;
		}
	}
</style>
