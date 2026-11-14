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
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import X from '@lucide/svelte/icons/x';
	import Attachment from '#lib/Attachment.svelte';
	import Sheet from '#lib/Sheet.svelte';
	import { upload, remove, MAX_SIZE } from '#lib/attachments.js';
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
	// What each kind is called on screen; the data file keeps maintenance, improvement and object
	const label = (c) => ({ maintenance: 'maintain', improvement: 'improve', object: 'object' })[c.kind];
	// A new cost starts with its first payment
	function addCost(kind) {
		costs.push({ kind, note: '', entries: [], files: [] });
		editEntry(costs.at(-1), { who: 'cyan' });
	}

	// The small popup for one payment or transfer: its date and amount (and, for a payment, who paid)
	const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD
	// A transfer as written: cyan on the left, the arrow showing the way (John → Iago, John ← Iago)
	const transfer = (e) => (e.from === 'cyan' ? `${data.names.cyan} → ${data.names.mint}` : `${data.names.cyan} ← ${data.names.mint}`);
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

	// Attachments: picked files wait here, and are uploaded (encrypted) when the page is saved
	let shown = $state(null); // the attachment in the preview
	let previewOpen = $state(false);
	// Returns the entry added, or nothing when the file is too large
	function add(c, file) {
		if (file.size > MAX_SIZE) return void (error = `${file.name} is larger than ${MAX_SIZE / 1024 / 1024} MB.`);
		c.files.push({ name: file.name, type: file.type, file });
		return c.files.at(-1);
	}
	function attach(c, event) {
		for (const file of event.currentTarget.files) {
			const entry = add(c, file);
			if (entry) startRename(entry);
		}
		event.currentTarget.value = '';
	}
	// An image or PDF copied to the clipboard, named by when it was pasted: pasted 2026-11-14 18.05.png
	const isFile = (type) => type.startsWith('image/') || type === 'application/pdf';
	// Keeps the file's own name when it has one (a PDF from Mail), else names it by the time
	function addPasted(c, blob, type) {
		const stamp = new Date().toLocaleString('sv').slice(0, 16).replace(':', '.');
		const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg');
		const own = blob.name && !/^image\.\w+$/.test(blob.name) ? blob.name : '';
		const entry = add(c, new File([blob], own || `pasted ${stamp}.${ext}`, { type }));
		if (entry) startRename(entry);
	}
	// Right after a file is added or pasted: a small popup to name it, one file after another; the
	// extension stays as it is
	let renaming = $state(null); // { entry, base, ext }
	let renameOpen = $state(false);
	const waiting = []; // files added together, named one after another
	function startRename(entry) {
		if (renameOpen) return void waiting.push(entry);
		const dot = entry.name.lastIndexOf('.');
		renaming = { entry, base: dot > 0 ? entry.name.slice(0, dot) : entry.name, ext: dot > 0 ? entry.name.slice(dot) : '' };
		renameOpen = true;
	}
	function rename(event) {
		event.preventDefault();
		const base = renaming.base.trim();
		if (base) renaming.entry.name = base + renaming.ext;
		renameOpen = false;
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
	// The name field opens with its text selected, so typing replaces it; after the popup has taken
	// the focus on opening
	const selectAll = (input) => {
		setTimeout(() => (input.focus(), input.setSelectionRange(0, input.value.length)), 50);
	};
	// The next one once this popup has closed, saved or not
	$effect(() => {
		if (!renameOpen && waiting.length) setTimeout(() => startRename(waiting.shift()));
	});
	// What a file really is, from its first bytes, when the clipboard doesn't say (an iPhone can give
	// a PDF from Mail no type at all)
	async function sniff(blob) {
		if (isFile(blob.type)) return blob.type;
		const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
		const text = String.fromCharCode(...b);
		if (text.startsWith('%PDF')) return 'application/pdf';
		if (b[0] === 0x89 && text.slice(1, 4) === 'PNG') return 'image/png';
		if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
		if (text.slice(4, 8) === 'ftyp') return 'image/heic';
		if (/\.pdf$/i.test(blob.name ?? '')) return 'application/pdf';
		return '';
	}
	async function pasted(c, event) {
		event.preventDefault();
		const files = [...(event.clipboardData?.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
		let found = false;
		for (const f of files) {
			const type = await sniff(f);
			if (type) (addPasted(c, f, type), (found = true));
		}
		if (!found) return (error = `The clipboard has no image or PDF${files.length ? ` (it has: ${files.map((f) => f.type || 'no type').join(', ')})` : ''}.`);
	}
	const preview = (f) => ((shown = f), (previewOpen = true));
	let saving = $state(false);


	// Returns the costs for the data file, or an error message
	function parseCosts() {
		const parsed = [];
		for (const c of costs) {
			if (!c.entries.some((e) => e.who)) return `Add a payment to the ${label(c)}.`;
			parsed.push({
				kind: c.kind,
				...(c.note.trim() && { note: c.note.trim() }),
				entries: c.entries,
				...(c.files.length && { files: c.files })
			});
		}
		return parsed.sort((a, b) => (a.entries[0].date < b.entries[0].date ? -1 : 1));
	}

	async function submit(event) {
		event.preventDefault();
		if (saving) return;
		if (section === 'names') {
			const cyan = names.cyan.trim();
			const mint = names.mint.trim();
			if (!cyan || !mint) return (error = 'Enter both names.');
			data.names = { cyan, mint };
			data.animals = { ...animals };
			// The animals right after the names in the file: every other field moves after them
			for (const k of Object.keys(data)) {
				if (k === 'v' || k === 'names' || k === 'animals') continue;
				const v = data[k];
				delete data[k];
				data[k] = v;
			}
		}
		if (section === 'costs') {
			let parsed = parseCosts();
			if (typeof parsed === 'string') return (error = parsed);
			if (session.demo && costs.some((c) => c.files.some((f) => f.file))) return (error = 'Attachments are not kept in the demo.');
			// New attachments are uploaded first, then loan.json lists them; removed ones are deleted after
			saving = true;
			try {
				for (const c of costs) c.files = await Promise.all(c.files.map((f) => (f.file ? upload(f.file, f.name) : f)));
			} catch (e) {
				saving = false;
				return (error = `The attachments could not be saved: ${e.message}`);
			}
			saving = false;
			parsed = parseCosts();
			const kept = new Set(parsed.flatMap((c) => (c.files ?? []).map((f) => f.id)));
			const gone = (data.costs ?? []).flatMap((c) => c.files ?? []).filter((f) => !kept.has(f.id));
			data.costs = parsed; // always there, empty when there are none
			for (const f of gone) remove(f.id).catch(() => {}); // a file left behind is only unused space
		}
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
			<fieldset class="cost">
				<legend>
					{#if c.kind === 'maintenance'}<Wrench size={18} />{:else if c.kind === 'object'}<Sofa size={18} />{:else}<Paintbrush size={18} />{/if}
					{label(c)}
					<button type="button" class="icon-button remove" onclick={() => costs.splice(i, 1)} aria-label="remove {label(c)}">
						<Trash size={18} />
					</button>
				</legend>
				<!-- Payments to the store or provider, and transfers between the two: tap one to change it -->
				{#if c.entries.length}
					{@const split = costSplit(c.entries)}
					<p class="split">
						total {formatKr(split.total)} kr
						{#each PEOPLE as p (p)}
							<span>· {data.names[p]} {formatKr(split[p])} ({formatPercent(split.total ? (split[p] / split.total) * 100 : 0)}<Pct />)</span>
						{/each}
					</p>
					<ul class="entries">
						{#each c.entries as e, j (j)}
							<li>
								<button type="button" class="entry" onclick={() => editEntry(c, {}, j)}>
									<span class="date">{e.date}</span>
									<span class="what">
										{#if e.who}<Wallet size={15} />{:else if e.from === 'cyan'}<BanknoteArrowDown size={15} class="turn" />{:else}<BanknoteArrowUp size={15} class="turn" />{/if}
										{#if e.who}<Face person={e.who} size={16} />{data.names[e.who]} paid
										{:else}<Face person={e.from} size={16} />{transfer(e)}{/if}
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
					<button type="button" class="attach" onclick={() => editEntry(c, { who: 'cyan' })}><Wallet size={16} />+ pay</button>
					<button type="button" class="attach" onclick={() => editEntry(c, { from: 'cyan', to: 'mint' })}><BanknoteArrowDown size={16} class="turn" />{data.names.cyan} → {data.names.mint}</button>
					<button type="button" class="attach" onclick={() => editEntry(c, { from: 'mint', to: 'cyan' })}><BanknoteArrowUp size={16} class="turn" />{data.names.cyan} ← {data.names.mint}</button>
				</div>
				<label>
					note
					<textarea
						class="note-field"
						rows="1"
						bind:value={c.note}
						placeholder={c.kind === 'object' ? 'washing machine, sofa…' : 'new kitchen, roof…'}
						onpaste={(e) => [...(e.clipboardData?.items ?? [])].some((i) => i.kind === 'file') && pasted(c, e)}
						use:grow={c.note}
					></textarea>
				</label>
				<!-- Receipts, invoices, photos: tap one to see it -->
				<div class="files">
					{#each c.files as f, j (f.id ?? f.name + j)}
						<span class="file">
							<button type="button" class="name" onclick={() => preview(f)}>{f.name}</button>
							<button type="button" class="icon-button" onclick={() => c.files.splice(j, 1)} aria-label="remove {f.name}">
								<X size={16} />
							</button>
						</span>
					{/each}
					<label class="attach">
						<Paperclip size={16} />+ attachment
						<input type="file" accept="application/pdf,image/*" multiple onchange={(e) => attach(c, e)} />
					</label>
					<!-- An empty field to paste a file into with the keyboard's Paste, as in a chat: the
					     system hands it the file. Nothing can be typed into it. -->
					<label class="attach paste">
						<ClipboardPaste size={16} />
						<input
							placeholder="+ paste"
							aria-label="paste an image or PDF"
							autocomplete="off"
							onpaste={(e) => pasted(c, e)}
							onbeforeinput={(e) => e.inputType !== 'insertFromPaste' && e.preventDefault()}
							oninput={(e) => (e.currentTarget.value = '')}
						/>
					</label>
				</div>
			</fieldset>
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

	<p class="actions">
		<button class="primary" type="submit" disabled={saving}><Check size={20} />{saving ? 'saving…' : 'save'}</button>
		<button type="button" onclick={onclose}>cancel</button>
	</p>
</form>

<Attachment file={shown} bind:open={previewOpen} />

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
					<input bind:value={entry.amount} inputmode="decimal" placeholder="0,00" use:selectAll />
				</label>
				{#if entryError}<p class="error" role="alert"><CircleAlert size={18} />{entryError}</p>{/if}
				<button class="primary" type="submit"><Check size={20} />ok</button>
			</form>
		{/key}
	{/if}
</Sheet>

<Sheet title="file name" bind:open={renameOpen}>
	{#if renaming}
		{#key renaming}
		<form class="rename" onsubmit={rename}>
			<span class="field-name">
				<input bind:value={renaming.base} aria-label="file name" autocomplete="off" use:selectAll />
				<span class="ext">{renaming.ext}</span>
			</span>
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
		padding: 0.25rem 1.5rem 1.5rem;
		overflow: auto;
		background: none;
		border-radius: 0;
		box-shadow: none;
	}
	/* Like the other fields, a bit smaller, growing with its text */
	.note-field {
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
	fieldset.cost {
		gap: 0.4rem;
		padding: 0.4rem 0.7rem 0.6rem;
		border-radius: 12px;
	}
	.cost legend {
		font-size: 0.8rem;
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
	.cost .file .name {
		font-size: 0.75rem;
	}
	form .cost .attach {
		padding: 0.15rem 0.5rem;
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
	.split {
		margin: 0;
		font-size: 0.72rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	/* The transfer icons on their side: the arrow points along the → */
	.chips :global(.turn),
	.entries :global(.turn) {
		transform: rotate(-90deg);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
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
	.files {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.file {
		display: inline-flex;
		align-items: center;
		min-width: 0;
		max-width: 100%;
		border: 1px solid var(--border);
		border-radius: 10px;
	}
	.file .name {
		overflow: hidden;
		padding: 0.3rem 0.2rem 0.3rem 0.6rem;
		border: 0;
		background: transparent;
		font-size: 0.82rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file .icon-button {
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
