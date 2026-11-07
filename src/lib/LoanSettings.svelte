<script>
	import Pct from '#lib/Pct.svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import House from '@lucide/svelte/icons/house';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import Trash from '@lucide/svelte/icons/trash';
	import Face from '#lib/Face.svelte';
	import MonthInput from '#lib/MonthInput.svelte';
	import { loan, changed } from '#lib/loan.svelte.js';
	import Percent from '@lucide/svelte/icons/percent';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import { addMonths, currentMonth, formatAmount, parseAmount, setValue, toOre, DEBT_RATE, PEOPLE, TERM } from '#lib/loan.js';

	// section: 'names' | 'apartment' | 'mortgage'
	let { section, onclose } = $props();

	const data = loan.data;
	const months = Object.keys(data.payments).sort();
	// The first month can only move while no payments are entered
	const startLocked = months.some((m) => PEOPLE.some((p) => data.payments[m][p] != null));

	let names = $state({ ...data.names });
	let total = $state(data.total ? formatAmount(data.total) : '');
	// The take-over day: the loan is paid out then, and the first payment is on the 1st of the next
	// month. Older data without one counts from the 1st of the month before the first payment.
	let takeover = $state(data.takeover ?? `${months.length ? addMonths(months[0], -1) : currentMonth()}-01`);
	const start = $derived(addMonths(takeover.slice(0, 7), 1));
	// The take-over month while payments are entered: "2026 nov"
	const lockedMonth = (() => {
		const m = months.length ? addMonths(months[0], -1) : '';
		return m && `${m.slice(0, 4)} ${new Date(`${m}-01T12:00:00`).toLocaleDateString('en', { month: 'short' }).toLowerCase()}`;
	})();
	let debtRate = $state(data.debtRate != null ? formatAmount(data.debtRate) : '');
	let egenkapital = $state({ cyan: formatAmount(data.egenkapital.cyan || ''), mint: formatAmount(data.egenkapital.mint || '') });
	// The mortgage's length, changed from this month on (from the first payment while before it)
	const from = months.length && currentMonth() < months[0] ? months[0] : currentMonth();
	const monthLabel = (m) => `${m.slice(0, 4)} ${new Date(`${m}-01T12:00:00`).toLocaleDateString('en', { month: 'short' }).toLowerCase()}`;
	// Every length change so far ({ month, months }, in order), edited here and written on save
	let changes = $state(months.filter((m) => data.payments[m].term != null).map((m) => ({ month: m, months: Number(data.payments[m].term) })));
	const termOf = (list, month) => list.filter((c) => c.month <= month).at(-1)?.months ?? TERM;
	let term = $state(termOf(changes, from));
	// A new length replaces any change from this month on; picking what applied before adds none
	function pick(n) {
		const kept = changes.filter((c) => c.month < from);
		if (n !== termOf(kept, from)) kept.push({ month: from, months: n });
		changes = kept;
		term = n;
	}
	function removeLatest() {
		changes = changes.slice(0, -1);
		term = termOf(changes, from);
	}
	const lengths = Array.from({ length: TERM }, (_, i) => i + 1);
	const lengthLabel = (n) => `${n}\u00a0m${n % 12 ? '' : `\u00a0(${n / 12}\u00a0y)`}`; // kept on one line
	let error = $state('');

	// Maintenance and improvement costs, as text while editing. A total splits 50/50; changing one
	// person's part instead keeps the other and updates the total.
	const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
	const asFields = (c) => ({
		kind: c.kind,
		month: c.month,
		note: c.note ?? '',
		total: formatAmount((c.cyan || 0) + (c.mint || 0)),
		cyan: formatAmount(c.cyan || 0),
		mint: formatAmount(c.mint || 0)
	});
	let costs = $state((data.costs ?? []).map(asFields));
	const addCost = (kind) => costs.push({ kind, month: currentMonth(), note: '', total: '', cyan: '', mint: '' });

	function totalChanged(c) {
		const total = parseAmount(c.total);
		if (total == null) return;
		const cyan = Math.floor(toOre(total) / 2);
		c.cyan = formatAmount(cyan / 100);
		c.mint = formatAmount((toOre(total) - cyan) / 100);
	}
	function partChanged(c) {
		const [cyan, mint] = PEOPLE.map((p) => parseAmount(c[p]));
		if (cyan !== undefined && mint !== undefined) c.total = formatAmount((cyan ?? 0) + (mint ?? 0));
	}

	// Returns the costs for the data file, or an error message
	function parseCosts() {
		const parsed = [];
		for (const c of costs) {
			const [cyan, mint] = PEOPLE.map((p) => parseAmount(c[p]));
			if (cyan === undefined || mint === undefined || !(cyan || mint)) return `Enter what each paid for the ${c.kind} cost.`;
			if (!MONTH.test(c.month)) return `Enter the month of the ${c.kind} cost as YYYY-MM.`;
			parsed.push({ kind: c.kind, month: c.month, cyan: cyan ?? 0, mint: mint ?? 0, ...(c.note.trim() && { note: c.note.trim() }) });
		}
		return parsed.sort((a, b) => (a.month < b.month ? -1 : 1));
	}

	function submit(event) {
		event.preventDefault();
		if (section === 'names') {
			const cyan = names.cyan.trim();
			const mint = names.mint.trim();
			if (!cyan || !mint) return (error = 'Enter both names.');
			data.names = { cyan, mint };
		}
		if (section === 'apartment') {
			const price = parseAmount(total);
			if (!price) return (error = 'Enter the apartment price.');
			if (!/^\d{4}-\d{2}-\d{2}$/.test(takeover)) return (error = 'Enter the take-over day.');
			if (startLocked && start !== months[0]) {
				return (error = `You've entered payments, so the take-over day can only change within ${lockedMonth}.`);
			}
			if (price / 2 < Math.max(data.egenkapital.cyan, data.egenkapital.mint)) {
				return (error = "Egenkapital can't be more than half the price.");
			}
			const parsed = parseCosts();
			if (typeof parsed === 'string') return (error = parsed);
			const rate = parseAmount(debtRate);
			if (rate === undefined) return (error = 'Enter the debt interest as a percentage.');
			if (rate === null) delete data.debtRate;
			else data.debtRate = rate;
			data.total = price;
			data.takeover = takeover;
			data.costs = parsed; // always there, empty when there are none
			if (!startLocked && start !== months[0]) moveStart();
		}
		if (section === 'mortgage') {
			const [cyan, mint] = PEOPLE.map((p) => parseAmount(egenkapital[p]));
			if (cyan === undefined || mint === undefined) return (error = 'Enter amounts in kroner.');
			if (data.total && Math.max(cyan, mint) > data.total / 2) {
				return (error = "Egenkapital can't be more than half the price.");
			}
			data.egenkapital = { cyan: cyan ?? 0, mint: mint ?? 0 };
			for (const m of Object.keys(data.payments)) setValue(data, m, 'term', null);
			for (const c of changes) setValue(data, c.month, 'term', c.months);
		}
		changed();
		onclose();
	}

	// The first month holds the starting rate (5.03 % until changed); later months stay
	function moveStart() {
		const firstEntry = months.length ? data.payments[months[0]] : {};
		const kept = Object.entries(data.payments).filter(([m]) => m > start && m !== months[0]);
		data.payments = { [start]: { ...firstEntry, interest: firstEntry.interest ?? 5.03 }, ...Object.fromEntries(kept) };
	}
</script>

<form onsubmit={submit}>
	<h1>{section}</h1>

	{#if section === 'names'}
		{#each PEOPLE as p (p)}
			<label>
				{p === 'cyan' ? 'left' : 'right'}
				<span class="field">
					<Face person={p} size={20} />
					<input bind:value={names[p]} autocomplete="off" />
				</span>
			</label>
		{/each}
	{:else if section === 'apartment'}
		<label>
			total price (kr)
			<span class="field">
				<House size={20} />
				<input bind:value={total} inputmode="decimal" placeholder="8 700 000,00" />
			</span>
		</label>
		<label>
			take-over day
			<MonthInput bind:value={takeover} label="take-over day"><Calendar size={20} /></MonthInput>
		</label>
		<p class="note">
			The loan is paid out on this day; the first payment is on {start.slice(0, 4)}
			{new Date(`${start}-01T12:00:00`).toLocaleDateString('en', { month: 'short' }).toLowerCase()} 1.
			{#if startLocked}
				You've entered payments, so the take-over day can only change within {lockedMonth}.
			{/if}
		</p>

		<label>
			debt interest (%)
			<span class="field">
				<Percent size={20} />
				<input bind:value={debtRate} inputmode="decimal" placeholder={formatAmount(DEBT_RATE)} />
			</span>
		</label>
		<p class="note">
			The interest on a debt between you (forsinkelsesrente, samboerkontrakt 3.4). It changes on 1 January
			and 1 July; empty uses {formatAmount(DEBT_RATE)}<Pct />.
		</p>

		<!-- What each paid for maintenance and improvements: a record, not ownership (4.3) -->
		{#each costs as c, i (i)}
			<fieldset>
				<legend>
					{#if c.kind === 'maintenance'}<Wrench size={18} />{:else}<Paintbrush size={18} />{/if}
					{c.kind} cost
					<button type="button" class="icon-button remove" onclick={() => costs.splice(i, 1)} aria-label="remove {c.kind} cost">
						<Trash size={18} />
					</button>
				</legend>
				<div class="pair">
					<label>
						month
						<MonthInput bind:value={c.month} label="{c.kind} cost" />
					</label>
					<label>
						total (kr)
						<input bind:value={c.total} oninput={() => totalChanged(c)} inputmode="decimal" placeholder="0,00" />
					</label>
				</div>
				<div class="pair">
					{#each PEOPLE as p (p)}
						<label>
							{data.names[p]} (kr)
							<span class="field">
								<Face person={p} size={18} />
								<input bind:value={c[p]} oninput={() => partChanged(c)} inputmode="decimal" placeholder="0,00" />
							</span>
						</label>
					{/each}
				</div>
				<label>
					note
					<input bind:value={c.note} placeholder="new kitchen, roof…" autocomplete="off" />
				</label>
			</fieldset>
		{/each}
		<div class="add">
			<button type="button" onclick={() => addCost('maintenance')}><Wrench size={18} />maintenance cost</button>
			<button type="button" onclick={() => addCost('improvement')}><Paintbrush size={18} />improvement cost</button>
		</div>
	{:else}
		{#if months.length}
			<label>
				length
				<span class="field">
					<Hourglass size={20} />
					<select value={term} onchange={(e) => pick(Number(e.currentTarget.value))}>
						{#each lengths as n (n)}<option value={n}>{lengthLabel(n)}</option>{/each}
					</select>
				</span>
			</label>
			<p class="note">From the first payment. A change counts from {monthLabel(from)} on: the payments are worked out again.</p>
			{#if changes.length}
				<ul class="changes">
					{#each changes as c, i (c.month)}
						<li>
							<span>{monthLabel(c.month)}: {lengthLabel(i ? changes[i - 1].months : TERM)} → {lengthLabel(c.months)}</span>
							{#if i === changes.length - 1}
								<button type="button" class="icon-button remove" onclick={removeLatest} aria-label="remove the latest change">
									<Trash size={18} />
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
		{#each PEOPLE as p (p)}
			<label>
				egenkapital {data.names[p]} (kr)
				<span class="field">
					<Face person={p} size={20} />
					<input bind:value={egenkapital[p]} inputmode="decimal" placeholder="0,00" />
				</span>
			</label>
		{/each}
	{/if}

	{#if error}
		<p class="error" role="alert"><CircleAlert size={18} />{error}</p>
	{/if}

	<p class="actions">
		<button class="primary" type="submit"><Check size={20} />save</button>
		<button type="button" onclick={onclose}>cancel</button>
	</p>
</form>

<style>
	fieldset {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0; /* a fieldset otherwise refuses to shrink below its fields' natural width */
		margin: 0;
		padding: 0.75rem 1rem 1rem;
		border: 1px solid var(--border);
		border-radius: 16px;
	}
	legend {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0 0.3rem;
		font-size: 0.875rem;
		font-weight: 500;
	}
	.remove {
		width: 32px;
		height: 32px;
		color: var(--muted);
	}
	.changes {
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 0.875rem;
	}
	.changes li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 32px;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
	}
	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.pair input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.add button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.9rem;
		font-size: 0.875rem;
	}
</style>
