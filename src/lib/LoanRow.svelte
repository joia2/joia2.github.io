<script>
	import TriangleAlert from '@lucide/svelte/icons/triangle-exclamation-point';
	import Check from '@lucide/svelte/icons/check';
	import { formatAmount, formatKr, parseAmount, PEOPLE } from '#lib/loan.js';
	import { typing } from '#lib/loan.svelte.js';

	// row: one month from compute(); entry: what the data file holds for that month
	let { row, entry, first, today, names, onedit } = $props();

	const label = $derived(
		new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en', { month: 'short', year: 'numeric' }).toLowerCase()
	);

	// Saves a field when it loses focus. Text that isn't an amount puts the field back as it was.
	// key: a person ('cyan', 'mint'), 'interest' or 'fee'
	const edited = (key) => (event) => {
		const input = event.currentTarget;
		const value = parseAmount(input.value);
		const keepsRate = key === 'interest' && first && value === null; // the first month must have a rate
		if (value === undefined || keepsRate) {
			input.value = key === 'interest' ? (entry.interest ?? '') : formatAmount(entry[key]);
			return;
		}
		onedit(key, value);
	};

	// The checkbox inside a paid field marks the month as paid: checked when at least the minimum is
	// entered, typed or ticked. Ticking it enters exactly the minimum; unticking clears the field.
	const paidMinimum = (s) => s.typed && s.paid >= s.min;
	const toggleMinimum = (p) => {
		const s = row.people[p];
		onedit(p, paidMinimum(s) ? null : s.min / 100);
	};
</script>

<div class="row" class:now={row.month === today}>
	{#each PEOPLE as p, i (p)}
		{#if i === 1}
			<div class="mid">
				<span class="month">{label}</span>
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
						<span class="prefix" aria-hidden="true">fee</span>
						<input
							class="prefixed suffixed"
							inputmode="decimal"
							value={formatAmount(entry.fee)}
							placeholder={formatKr(row.fee)}
							aria-label="fee in kroner"
							oninput={typing}
							onchange={edited('fee')}
						/>
						<span class="suffix" aria-hidden="true">kr</span>
					</span>
				{/if}
			</div>
		{/if}

		<div class="side {p}">
			{#if row.loan}
				{@const s = row.people[p]}
				<span class="affix">
					<button
						class="minimum {p}"
						role="checkbox"
						aria-checked={paidMinimum(s)}
						aria-label="{names[p]} paid at least the minimum"
						disabled={!s.min}
						onclick={() => toggleMinimum(p)}
					>
						{#if paidMinimum(s)}<Check size={14} />{/if}
					</button>
					<input
						class="checkable"
						inputmode="decimal"
						value={formatAmount(entry[p])}
						placeholder={formatKr(s.min)}
						aria-label="paid by {names[p]}"
						oninput={typing}
						onchange={edited(p)}
					/>
				</span>
				<dl class:projected={!s.typed}>
					<dt>as principal</dt>
					<dd>{formatKr(s.principal)}</dd>
					<dt>as interest</dt>
					<dd>{formatKr(s.interest)}</dd>
				</dl>
				{#if s.covered < 0}
					<p class="minus">−{formatKr(-s.covered)} kr</p>
				{:else if s.covered > 0}
					<p class="plus">+{formatKr(s.covered)} kr</p>
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
						<span class:on={!s.time}>−payment</span>
						<span class="track"><span class="knob"></span></span>
						<span class:on={s.time}>−time</span>
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

<style>
	.row {
		display: grid;
		/* The same space at both outer edges and between the columns keeps the fields narrow on
		   wide screens; it shrinks with the screen */
		--space: clamp(0.25rem, 4vw - 0.5rem, 2.5rem);
		grid-template-columns: 1fr 5.75rem 1fr;
		gap: 0.75rem max(0.75rem, var(--space));
		padding: 0.9rem var(--space);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.row.now {
		background: color-mix(in srgb, var(--accent) 7%, transparent);
		border-radius: 14px;
	}
	.side,
	.mid {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		min-width: 0;
	}
	.side.mint {
		text-align: right;
	}
	.mid {
		text-align: center;
	}
	.month {
		font-size: 0.82rem;
		font-weight: 600;
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
		text-align: right;
		padding: 0.15rem 0.4rem;
		border-radius: 8px;
		font-size: 0.75rem;
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
	.mid input.suffixed {
		padding-right: 1.25rem;
	}
	dl {
		display: grid;
		grid-template-columns: auto auto;
		justify-content: space-between;
		gap: 0.1rem 0.5rem;
		margin: 0;
		padding: 0 0.6rem;
		font-size: 0.78rem;
	}
	dt {
		color: var(--muted);
		white-space: nowrap;
		text-align: left; /* also on mint's side, where the rest is right-aligned */
	}
	dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	dl.projected dd {
		color: var(--muted);
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
		padding: 0.15rem 0.6rem;
		border: 0;
		font-size: 0.72rem;
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
			grid-template-columns: 1fr 5.6rem 1fr;
			gap: 0.5rem;
			padding-inline: 0;
		}
		dl {
			gap: 0.1rem 0.3rem;
			padding: 0 0.5rem;
			font-size: 0.7rem;
		}
		.side > p,
		.toggle {
			padding-inline: 0.5rem;
		}
		input {
			font-size: 0.88rem;
			padding: 0.25rem 0.5rem;
		}
	}
</style>
