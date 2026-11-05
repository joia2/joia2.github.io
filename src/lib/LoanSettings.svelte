<script>
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import House from '@lucide/svelte/icons/house';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import Trash from '@lucide/svelte/icons/trash';
	import Face from '#lib/Face.svelte';
	import { loan, changed } from '#lib/loan.svelte.js';
	import { addMonths, currentMonth, formatAmount, parseAmount, toOre, PEOPLE } from '#lib/loan.js';

	// section: 'names' | 'apartment' | 'egenkapital'
	let { section, onclose } = $props();

	const data = loan.data;
	const months = Object.keys(data.payments).sort();
	// The first month can only move while no payments are entered
	const startLocked = months.some((m) => PEOPLE.some((p) => data.payments[m][p] != null));

	let names = $state({ ...data.names });
	let total = $state(data.total ? formatAmount(data.total) : '');
	let start = $state(months[0] ?? addMonths(currentMonth(), 1));
	let egenkapital = $state({ cyan: formatAmount(data.egenkapital.cyan || ''), mint: formatAmount(data.egenkapital.mint || '') });
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
			if (!MONTH.test(start)) return (error = 'Enter the first payment month as YYYY-MM.');
			if (price / 2 < Math.max(data.egenkapital.cyan, data.egenkapital.mint)) {
				return (error = "Egenkapital can't be more than half the price.");
			}
			const parsed = parseCosts();
			if (typeof parsed === 'string') return (error = parsed);
			data.total = price;
			data.costs = parsed; // always there, empty when there are none
			if (!startLocked && start !== months[0]) moveStart();
		}
		if (section === 'egenkapital') {
			const [cyan, mint] = PEOPLE.map((p) => parseAmount(egenkapital[p]));
			if (cyan === undefined || mint === undefined) return (error = 'Enter amounts in kroner.');
			if (data.total && Math.max(cyan, mint) > data.total / 2) {
				return (error = "Egenkapital can't be more than half the price.");
			}
			data.egenkapital = { cyan: cyan ?? 0, mint: mint ?? 0 };
		}
		changed();
		onclose();
	}

	// The first month holds the starting rate (4.78 % until changed); later months stay
	function moveStart() {
		const firstEntry = months.length ? data.payments[months[0]] : {};
		const kept = Object.entries(data.payments).filter(([m]) => m > start && m !== months[0]);
		data.payments = { [start]: { ...firstEntry, interest: firstEntry.interest ?? 4.78 }, ...Object.fromEntries(kept) };
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
			first payment
			<span class="field">
				<Calendar size={20} />
				<input type="month" bind:value={start} disabled={startLocked} placeholder="2026-12" />
			</span>
		</label>
		{#if startLocked}
			<p class="note">The first month can't change once payments are entered.</p>
		{/if}

		<!-- Costs that raise the apartment's value; what each paid counts as owned -->
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
						<input type="month" bind:value={c.month} placeholder="2027-05" />
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
		{#each PEOPLE as p (p)}
			<label>
				{data.names[p]} (kr)
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
