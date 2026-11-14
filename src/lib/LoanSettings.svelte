<script>
	import Pct from '#lib/Pct.svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import House from '@lucide/svelte/icons/house';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import Sofa from '@lucide/svelte/icons/sofa';
	import Wallet from '@lucide/svelte/icons/wallet';
	import BanknoteArrowUp from '@lucide/svelte/icons/banknote-arrow-up';
	import BanknoteArrowDown from '@lucide/svelte/icons/banknote-arrow-down';
	import X from '@lucide/svelte/icons/x';
	import Files from '#lib/Files.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { remove } from '#lib/attachments.js';
	import { session } from '#lib/session.svelte.js';
	import Trash from '@lucide/svelte/icons/trash';
	import Face from '#lib/Face.svelte';
	import MonthInput from '#lib/MonthInput.svelte';
	import { ANIMAL_NAMES, killedThisYear } from '#lib/animals.js';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Heart from '@lucide/svelte/icons/heart';
	import RefreshCcw from '@lucide/svelte/icons/refresh-ccw';
	import { loan, changed } from '#lib/loan.svelte.js';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import { addMonths, costSplit, currentMonth, formatAmount, formatKr, formatPercent, parseAmount, setValue, toOre, PEOPLE, TERM } from '#lib/loan.js';

	// section: 'names' | 'apartment' (the apartment and its mortgage) | 'costs' (maintenance, improvements and objects)
	let { section, onclose } = $props();

	const data = loan.data;
	const months = Object.keys(data.payments).sort();
	// The first month can only move while no payments are entered
	const startLocked = months.some((m) => PEOPLE.some((p) => data.payments[m][p] != null));

	let names = $state({ ...data.names });
	let animals = $state({ ...data.animals });
	// The counters under the animals: killed for food so far this year, updated on every frame of the
	// screen, so each one runs at its real pace (a chicken every few hundred microseconds, a camel every ten seconds)
	let now = $state(new Date());
	$effect(() => {
		let frame = requestAnimationFrame(function update() {
			now = new Date();
			frame = requestAnimationFrame(update);
		});
		return () => cancelAnimationFrame(frame);
	});
	const count = (a) => new Intl.NumberFormat('nb-NO').format(killedThisYear(a, now));
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

	// Maintenance, improvements and objects: each with its payments to the store or provider
	// ({ date, amount, who }) and transfers between the two ({ date, amount, from, to })
	const asFields = (c) => ({
		kind: c.kind,
		note: c.note ?? '',
		entries: [...(c.entries ?? [])],
		files: [...(c.files ?? [])] // saved ones { id, name, type }; new ones { name, type, file } until saved
	});
	let costs = $state((data.costs ?? []).map(asFields));
	const filesOf = $state([]); // each cost's file list, for a paste into its description
	// What each kind is called on screen; the data file keeps maintenance, improvement and object
	const label = (c) => ({ maintenance: 'maintain', improvement: 'improve', object: 'object' })[c.kind];
	// A new cost starts with its first payment
	function addCost(kind) {
		costs.push({ kind, note: '', entries: [], files: [] });
		editEntry(costs.at(-1), { who: 'cyan' });
	}

	// The small popup for one payment or transfer: its date and amount (and, for a payment, who paid)
	const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD
	// A transfer as written: John → Iago, Iago → John
	const transfer = (e) => `${data.names[e.from]} → ${data.names[e.to]}`;
	let entry = $state(null); // { cost, index (−1: new), who | from + to, date, amount (text) }
	let entryOpen = $state(false);
	function editEntry(cost, kind, index = -1) {
		const e = cost.entries[index] ?? { date: today(), ...kind };
		entry = { cost, index, ...e, amount: e.amount ? formatAmount(e.amount) : '' };
		entryOpen = true;
	}
	let entryError = $state('');
	function saveEntry(event) {
		event.preventDefault();
		const amount = parseAmount(entry.amount);
		if (!amount || amount < 0) return (entryError = 'Enter the amount in kroner.');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return (entryError = 'Enter the date.');
		const { cost, index, date, who, from, to } = entry;
		const saved = { date, amount, ...(who ? { who } : { from, to }) };
		if (index < 0) cost.entries.push(saved);
		else cost.entries[index] = saved;
		cost.entries.sort((a, b) => (a.date < b.date ? -1 : 1));
		entryError = '';
		entryOpen = false;
	}

	// A text area as tall as its text: after every change, and when it comes into view (in a popup
	// still closed it has no height to measure)
	const grow = (area) => {
		const fit = () => {
			if (!area.offsetParent) return; // not shown yet
			area.style.height = 'auto';
			area.style.height = `${area.scrollHeight + 2}px`;
		};
		const seen = new IntersectionObserver(fit);
		seen.observe(area);
		area.addEventListener('input', fit);
		fit();
		return {
			update: fit,
			destroy: () => (seen.disconnect(), area.removeEventListener('input', fit))
		};
	};
	// The amount field opens with its text selected, so typing replaces it. The focus comes at once, while still in the tap or paste that opened the popup: an iPhone
	// only brings up the keyboard then (or keeps it, when it is already up)
	const selectAll = (input) => {
		const select = () => (input.focus(), input.setSelectionRange(0, input.value.length));
		select();
		requestAnimationFrame(select); // again once the popup is open, which moves the focus to itself
	};


	// Returns the costs for the data file, or an error message
	// The costs as the data file keeps them: attachments only once uploaded
	function parseCosts() {
		return costs.map((c) => {
			const files = c.files.filter((f) => f.id).map(({ id, name, type, size }) => ({ id, name, type, ...(size && { size }) }));
			return {
				kind: c.kind,
				...(c.note.trim() && { note: c.note.trim() }),
				entries: $state.snapshot(c.entries),
				...(files.length && { files })
			};
		});
	}

	// The costs page saves as it goes, with no save button: every change is written to the data
	// (saved shortly after, like the payments), and attachments are uploaded as soon as named
	let lastSaved = JSON.stringify(section === 'costs' ? parseCosts() : null);
	function saveCosts() {
		const parsed = parseCosts();
		const text = JSON.stringify(parsed);
		if (text === lastSaved) return;
		const kept = new Set(parsed.flatMap((c) => (c.files ?? []).map((f) => f.id)));
		const gone = (data.costs ?? []).flatMap((c) => c.files ?? []).filter((f) => !kept.has(f.id));
		lastSaved = text;
		data.costs = parsed;
		changed();
		for (const f of gone) remove(f.id).catch(() => {}); // a file left behind is only unused space
	}
	$effect(() => {
		if (section === 'costs') saveCosts();
	});

	// The apartment's documents: saved as they go, whatever happens to the rest of the page
	let documents = $state([...(data.documents ?? [])]);
	function saveDocuments() {
		const kept = documents.filter((f) => f.id).map(({ id, name, type, size }) => ({ id, name, type, ...(size && { size }) }));
		const ids = new Set(kept.map((f) => f.id));
		const gone = (data.documents ?? []).filter((f) => !ids.has(f.id));
		data.documents = kept;
		changed();
		for (const f of gone) remove(f.id).catch(() => {});
	}

	// The names page saves as it goes too: a name once it isn't empty, an animal when picked
	$effect(() => {
		if (section !== 'names') return;
		const next = { cyan: names.cyan.trim(), mint: names.mint.trim() };
		const picked = { ...animals };
		if (!next.cyan || !next.mint) return;
		if (JSON.stringify([next, picked]) === JSON.stringify([data.names, data.animals ?? {}])) return;
		data.names = next;
		data.animals = picked;
		// The animals right after the names in the file: every other field moves after them
		for (const k of Object.keys(data)) {
			if (k === 'v' || k === 'names' || k === 'animals') continue;
			const v = data[k];
			delete data[k];
			data[k] = v;
		}
		changed();
	});

	async function submit(event) {
		event.preventDefault();
		if (section === 'names') return; // saved as it goes
		if (section === 'costs') return; // saved as it goes
		if (section === 'apartment') {
			const price = parseAmount(total);
			if (!price) return (error = 'Enter the apartment price.');
			if (!/^\d{4}-\d{2}-\d{2}$/.test(takeover)) return (error = 'Enter the take-over day.');
			if (startLocked && start !== months[0]) {
				return (error = `You've entered payments, so the take-over day can only change within ${lockedMonth}.`);
			}
			const [cyan, mint] = PEOPLE.map((p) => parseAmount(egenkapital[p]));
			if (cyan === undefined || mint === undefined) return (error = 'Enter egenkapital in kroner.');
			if (price / 2 < Math.max(cyan ?? 0, mint ?? 0)) return (error = "Egenkapital can't be more than half the price.");
			data.total = price;
			data.takeover = takeover;
			if (!startLocked && start !== months[0]) moveStart();
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

<!-- A person: the start of their name (up to 5 letters) -->
{#snippet initial(p)}
	<span class="initial {p}" title={data.names[p]}>{data.names[p].slice(0, 5).toLowerCase()}</span>
{/snippet}

<form class="settings" onsubmit={submit}>

	{#if section === 'names'}
		{#each PEOPLE as p (p)}
			<label>
				{p === 'cyan' ? 'left' : 'right'}
				<span class="name-row">
					<span class="field">
						<Face person={p} size={20} animal={animals[p]} />
						<input bind:value={names[p]} autocomplete="off" />
					</span>
					<!-- Each animal in turn; turning toward the middle: counter-clockwise on the left, clockwise on the right -->
					<button
						type="button"
						role="switch"
						aria-checked={animals[p] === 'rotate'}
						aria-label="each animal in turn, a new one every minute"
						class:chosen={animals[p] === 'rotate'}
						class="{p} rotate"
						onclick={() => (animals[p] = animals[p] === 'rotate' ? undefined : 'rotate')}
					>
						{#if p === 'cyan'}<RefreshCcw size={22} />{:else}<RefreshCw size={22} />{/if}
					</button>
				</span>
			</label>
			<p class="honour"><Heart size={24} /><span><em>in memoriam</em>, and in honour of the individuals killed and their families…</span></p>
			<!-- The icon: one of the animals, in this person's color; picking the chosen one again goes back to the face -->
			<div class="animals" role="radiogroup" aria-label="{names[p] || p}'s icon">
				{#each ANIMAL_NAMES as a (a)}
					<button
						type="button"
						role="radio"
						aria-checked={animals[p] === a}
						aria-label={a}
						class:chosen={animals[p] === a}
						class={p}
						onclick={() => (animals[p] = animals[p] === a ? undefined : a)}
					>
						<Face person={p} size={44} animal={a} />
						<span class="killed" title="killed for food worldwide so far this year">{count(a)}</span>
					</button>
				{/each}
			</div>
		{/each}
	{:else if section === 'apartment'}
		<!-- The apartment's documents (contracts, plans…), saved as they are added or removed -->
		<div class="documents">
			<Files bind:files={documents} onchange={saveDocuments} tags />
		</div>
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
	{:else if section === 'costs'}
		<!-- What each paid for maintenance and improvements (a record, not ownership: 4.3), and for
		     objects bought for the home, owned by what each paid (the register of household items, 6.1) -->
		{#each costs as c, i (i)}
			{@const split = costSplit(c.entries)}
			<div class="cost">
				<!-- At a glance: the kind's icon, and the description, the total and what each paid -->
				<div class="head">
					<!-- Behind the icon, a pie of who owns how much: mint on the right (from the top, clockwise), cyan on the left -->
					<span class="kind" class:empty={!split.total} style:--share={split.total ? Math.min(100, Math.max(0, (split.cyan / split.total) * 100)) : 0}>
						{#if c.kind === 'maintenance'}<Wrench size={22} />{:else if c.kind === 'object'}<Sofa size={22} />{:else}<Paintbrush size={22} />{/if}
					</span>
					<div class="lines">
						<textarea
							class="description"
							rows="1"
							bind:value={c.note}
							placeholder="description…"
							aria-label="description"
							onpaste={(e) => [...(e.clipboardData?.items ?? [])].some((item) => item.kind === 'file') && filesOf[i]?.paste(e)}
							use:grow={c.note}
						></textarea>
						<span class="total">{formatKr(split.total)} kr</span>
						{#each PEOPLE as p (p)}
							<span class="each">{@render initial(p)} {formatKr(split[p])} kr ({formatPercent(split.total ? (split[p] / split.total) * 100 : 0)}<Pct />)</span>
						{/each}
					</div>
					<button type="button" class="icon-button remove" onclick={() => costs.splice(i, 1)} aria-label="remove {label(c)}">
						<Trash size={18} />
					</button>
				</div>
				<!-- Payments to the store or provider, and transfers between the two: tap one to change it -->
				{#if c.entries.length}
					<ul class="entries">
						{#each c.entries as e, j (j)}
							<li>
								<button type="button" class="entry" onclick={() => editEntry(c, {}, j)}>
									<span class="date">{e.date}</span>
									<span class="what">
										{#if e.who}<Wallet size={15} />{:else if e.from === 'cyan'}<BanknoteArrowDown size={15} class="turn" />{:else}<BanknoteArrowUp size={15} class="turn" />{/if}
										{#if e.who}{@render initial(e.who)} paid
										{:else}{@render initial(e.from)}<span class="arrow">→</span>{@render initial(e.to)}{/if}
									</span>
									<span class="amount">{formatAmount(e.amount)}</span>
								</button>
								<button type="button" class="icon-button" onclick={() => c.entries.splice(j, 1)} aria-label="remove this entry">
									<X size={16} />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				<div class="chips">
					<button type="button" class="attach" onclick={() => editEntry(c, { who: 'cyan' })}><Wallet size={16} />+pay</button>
					<button type="button" class="attach" onclick={() => editEntry(c, { from: 'cyan', to: 'mint' })}><BanknoteArrowDown size={16} class="turn" />{@render initial('cyan')}<span class="arrow">→</span>{@render initial('mint')}</button>
					<button type="button" class="attach" onclick={() => editEntry(c, { from: 'mint', to: 'cyan' })}><BanknoteArrowUp size={16} class="turn" />{@render initial('mint')}<span class="arrow">→</span>{@render initial('cyan')}</button>
				</div>
				<!-- Receipts, invoices, photos: tap one to see it -->
				<Files bind:files={c.files} onchange={saveCosts} bind:this={filesOf[i]} />
			</div>
		{/each}
		<div class="add">
			<div class="add-row">
				<button type="button" onclick={() => addCost('maintenance')}><Wrench size={18} />+ maintain</button>
				<button type="button" onclick={() => addCost('improvement')}><Paintbrush size={18} />+ improve</button>
				<button type="button" onclick={() => addCost('object')}><Sofa size={18} />+ object</button>
			</div>
		</div>
	{/if}

	{#if error}
		<p class="error" role="alert"><CircleAlert size={18} />{error}</p>
	{/if}

	{#if section === 'apartment'}
		<p class="actions">
			<button class="primary" type="submit"><Check size={20} />save</button>
			<button type="button" onclick={onclose}>cancel</button>
		</p>
	{/if}
</form>

<Sheet title={entry?.who !== undefined ? 'payment' : entry ? transfer(entry) : ''} bind:open={entryOpen}>
	{#if entry}
		{#key entry}
			<form class="rename" onsubmit={saveEntry}>
				{#if entry.who !== undefined}
					<!-- Who paid the store or provider -->
					<div class="payer" role="radiogroup" aria-label="paid by">
						{#each PEOPLE as p (p)}
							<button type="button" role="radio" aria-checked={entry.who === p} class:chosen={entry.who === p} class={p} onclick={() => (entry.who = p)}>
								<Face person={p} size={22} />{data.names[p]}
							</button>
						{/each}
					</div>
				{/if}
				<label>
					date
					<input type="date" bind:value={entry.date} />
				</label>
				<label>
					amount (kr)
					<!-- svelte-ignore a11y_autofocus -->
					<input bind:value={entry.amount} inputmode="decimal" placeholder="0,00" autofocus use:selectAll />
				</label>
				{#if entryError}<p class="error" role="alert"><CircleAlert size={18} />{entryError}</p>{/if}
				<button class="primary" type="submit"><Check size={20} />ok</button>
			</form>
		{/key}
	{/if}
</Sheet>


<style>
	.animals {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.4rem;
		margin: -0.25rem 0 0.5rem;
	}
	.honour {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: -0.25rem 0 0;
		font-size: 0.85rem;
		font-style: italic;
		color: var(--muted);
	}
	.killed {
		font-size: 0.65rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.animals button {
		display: grid;
		place-items: center;
		gap: 0.15rem;
		padding: 0.4rem;
		border: 2px solid transparent;
		border-radius: 14px;
		background: transparent;
	}
	/* The name field, and the rotate button beside it at the same height */
	.name-row {
		display: flex;
		gap: 0.5rem;
	}
	.name-row .field {
		flex: 1;
		min-width: 0;
	}
	.rotate {
		display: grid;
		place-items: center;
		padding: 0 0.85rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
	}
	.rotate.cyan {
		color: var(--cyan);
	}
	.rotate.mint {
		color: var(--mint);
	}
	.rotate.chosen.cyan,
	.animals button.chosen.cyan {
		border-color: var(--cyan);
		background: color-mix(in srgb, var(--cyan) 15%, transparent);
	}
	.rotate.chosen.mint,
	.animals button.chosen.mint {
		border-color: var(--mint);
		background: color-mix(in srgb, var(--mint) 15%, transparent);
	}
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
	/* Not the page's card: the popup is the card */
	/* Inside its popup (+page.svelte), which is the card: the form scrolls under the popup's title */
	.settings {
		max-width: none;
		min-height: 0;
		margin: 0;
		padding: 0.25rem 1rem 1.5rem;
		overflow: auto;
		background: none;
		border-radius: 0;
		box-shadow: none;
	}
	/* Like the other fields, a bit smaller, growing with its text */
	/* border-box: the height set from scrollHeight (text and padding) plus the border, and no more */
	.note-field {
		box-sizing: border-box;
		font: inherit;
		font-size: 0.875rem;
		line-height: 1.4;
		padding: 0.6rem 0.9rem;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--text);
		resize: none;
		overflow: hidden;
		min-height: calc(1.4em + 1.2rem + 2px); /* one line, before it is measured */
	}
	.note-field:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	.rename {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-width: none;
		margin: 0;
		padding: 0 1.5rem 1.5rem;
		background: none;
		border-radius: 0;
		box-shadow: none;
	}
	.field-name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.field-name input {
		flex: 1;
		min-width: 0;
	}
	.ext {
		color: var(--muted);
	}
	.share {
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}
	/* The costs: compact, so more of them fit on the screen */
	/* Each cost in a rounded box */
	.cost {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem 0.6rem 0.6rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 14px;
	}
	/* The icon in a 50 px square, then four lines: description, total, and what each paid */
	.head {
		display: flex;
		align-items: flex-start;
		gap: 0.3rem;
	}
	.kind {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 50px;
		height: 50px;
		color: #0b2a2e;
	}
	.kind::before {
		content: '';
		grid-area: 1 / 1;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: conic-gradient(var(--mint) 0 calc((100 - var(--share)) * 1%), var(--cyan) 0);
	}
	.kind.empty::before {
		background: color-mix(in srgb, var(--border) 60%, transparent);
	}
	.kind > :global(svg) {
		grid-area: 1 / 1;
		position: relative;
	}
	.lines {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		font-size: 0.8rem;
		line-height: 1.35;
		font-variant-numeric: tabular-nums;
	}
	/* The description, written in place: no box of its own */
	form .description {
		box-sizing: border-box;
		width: 100%;
		min-height: 0;
		padding: 0;
		border: 0;
		border-radius: 4px;
		background: transparent;
		font: inherit;
		color: var(--text);
		resize: none;
		overflow: hidden;
	}
	form .description:focus {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
	}
	.total {
		color: var(--text);
	}
	.each {
		font-size: 0.72rem;
		color: var(--muted);
		white-space: nowrap;
	}
	.cost label {
		gap: 0.2rem;
		font-size: 0.75rem;
	}
	.cost .note-field {
		font-size: 0.8rem;
		padding: 0.35rem 0.6rem;
		border-radius: 8px;
		min-height: calc(1.4em + 0.7rem + 2px);
	}
	.cost .attach,
	.cost .files .name {
		font-size: 0.75rem;
	}
	form .cost .attach {
		gap: 0.2rem;
		padding: 0.15rem 0.3rem;
		border-radius: 8px;
	}
	.cost .remove {
		width: 30px;
		height: 30px;
	}
	.entries {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.entries li {
		display: flex;
		align-items: center;
	}
	/* Each payment, transfer or attachment as a line of a list */
	.entries li::before {
		content: '';
		flex-shrink: 0;
		width: 5px;
		height: 5px;
		margin: 0 0.2rem 0 0.35rem;
		border-radius: 50%;
		background: var(--muted); /* a drawn dot: exactly in the line's middle, unlike the • character */
	}
	.entry {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.6rem;
		flex: 1;
		min-width: 0;
		padding: 0.15rem 0.3rem;
		border: 0;
		background: transparent;
		font-size: 0.78rem;
		text-align: left;
	}
	.entry .date {
		font-size: 0.68rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.entry .what {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
	}
	.entry .amount {
		font-variant-numeric: tabular-nums;
	}
	.entries .icon-button {
		width: 28px;
		height: 28px;
	}
	.chips .attach {
		min-width: 0;
		white-space: nowrap;
	}
	/* Close to the two names it joins */
	.arrow {
		margin-inline: -0.12rem;
	}
	.initial {
		display: inline-flex;
		align-items: center;
		gap: 0.2em;
		white-space: nowrap;
	}
	.documents {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem 0.6rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: 12px;
	}
	/* The transfer icons on their side, the arrow along the →. On its side the banknote is 16 of 24
	   wide and sits 2 off center: stretched to the wallet's 18 and centered, its height unchanged
	   (the stretch and shift are along the note's own height, which the turn makes the width) */
	.chips :global(.turn),
	.entries :global(.turn) {
		transform: rotate(-90deg) translateY(-9.4%) scaleY(1.125);
	}
	/* The three on one line, whatever the width: they shrink a little instead of wrapping */
	.chips {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.25rem;
	}
	.payer {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.payer button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		border: 2px solid transparent;
	}
	.payer button.chosen.cyan {
		border-color: var(--cyan);
	}
	.payer button.chosen.mint {
		border-color: var(--mint);
	}
	/* Not uploaded yet */
	.files .uploading {
		opacity: 0.55;
	}
	/* The kind's icon (image, PDF, other) and the name, cut with … when too long */
	.files .name {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 0;
		padding: 0.3rem 0.2rem 0.3rem 0.5rem;
		border: 0;
		background: transparent;
		font-size: 0.82rem;
	}
	.files .name span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.files .name :global(svg) {
		flex-shrink: 0;
		color: var(--muted);
	}
	.files .icon-button {
		width: 28px;
		height: 28px;
	}
	form .attach {
		display: inline-flex;
		flex-direction: row;
		background: transparent;
		color: var(--muted);
		font-weight: 500;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.6rem;
		border: 1px dashed var(--border);
		border-radius: 10px;
		font-size: 0.82rem;
		cursor: pointer;
	}
	.attach input[type='file'] {
		display: none;
	}
	/* The paste field: no box of its own inside the chip, "+ paste" as clear as the chip's other text */
	form .paste input {
		width: 4.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		font: inherit;
		color: inherit;
	}
	form .paste input:focus {
		box-shadow: none;
	}
	.paste:focus-within {
		border-color: var(--accent);
	}
	.paste input::placeholder {
		color: inherit;
		opacity: 1;
	}
	/* The three on one row; when the row is too narrow for icon and text side by side, every
	   button puts its icon above its text */
	.add {
		container-type: inline-size;
	}
	.add-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	.add button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.5rem 0.6rem;
		font-size: 0.875rem;
		white-space: nowrap;
	}
	@container (max-width: 30rem) {
		.add button {
			flex-direction: column;
			gap: 0.2rem;
			font-size: 0.8rem;
		}
	}
</style>
