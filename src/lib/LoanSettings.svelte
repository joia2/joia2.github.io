<script>
	import Pct from '#lib/Pct.svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import House from '@lucide/svelte/icons/house';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import Sofa from '@lucide/svelte/icons/sofa';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import X from '@lucide/svelte/icons/x';
	import Attachment from '#lib/Attachment.svelte';
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
	import { addMonths, currentMonth, formatAmount, formatPercent, parseAmount, setValue, toOre, PEOPLE, TERM } from '#lib/loan.js';

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

	// Maintenance and improvement costs, as text while editing. A total splits 50/50; changing one
	// person's part instead keeps the other and updates the total.
	const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
	const asFields = (c) => ({
		kind: c.kind,
		month: c.month,
		note: c.note ?? '',
		total: formatAmount((c.cyan || 0) + (c.mint || 0)),
		cyan: formatAmount(c.cyan || 0),
		mint: formatAmount(c.mint || 0),
		files: [...(c.files ?? [])] // saved ones { id, name, type }; new ones { name, type, file } until saved
	});
	let costs = $state((data.costs ?? []).map(asFields));
	const addCost = (kind) => costs.push({ kind, month: currentMonth(), note: '', total: '', cyan: '', mint: '', files: [] });

	// Attachments: picked files wait here, and are uploaded (encrypted) when the page is saved
	let shown = $state(null); // the attachment in the preview
	let previewOpen = $state(false);
	function add(c, file) {
		if (file.size > MAX_SIZE) error = `${file.name} is larger than ${MAX_SIZE / 1024 / 1024} MB.`;
		else c.files.push({ name: file.name, type: file.type, file });
	}
	function attach(c, event) {
		for (const file of event.currentTarget.files) add(c, file);
		event.currentTarget.value = '';
	}
	// An image or PDF copied to the clipboard, named by when it was pasted: pasted 2026-11-14 18.05.png
	const isFile = (type) => type.startsWith('image/') || type === 'application/pdf';
	// Keeps the file's own name when it has one (a PDF from Mail), else names it by the time
	function addPasted(c, blob, type) {
		const stamp = new Date().toLocaleString('sv').slice(0, 16).replace(':', '.');
		const ext = type === 'application/pdf' ? 'pdf' : type.split('/')[1].replace('jpeg', 'jpg');
		const own = blob.name && !/^image\.\w+$/.test(blob.name) ? blob.name : '';
		add(c, new File([blob], own || `pasted ${stamp}.${ext}`, { type }));
	}
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
	// The paste box: the way that also works where the button can't read the clipboard (an iPhone
	// photo, say): the system's own Paste puts the photo in as a file
	let pasteBox = $state(null); // the cost whose paste box shows
	async function paste(c) {
		error = '';
		try {
			let found = false;
			for (const item of await navigator.clipboard.read()) {
				const type = item.types.find(isFile);
				if (!type) continue;
				addPasted(c, await item.getType(type), type);
				found = true;
			}
			if (found) return (pasteBox = null);
		} catch {
			// Not allowed, or not offered: the paste box below
		}
		pasteBox = c;
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
		pasteBox = null;
	}
	// What one person paid of a cost, in percent of what both paid
	const paidShare = (c, p) => {
		const [cyan, mint] = PEOPLE.map((q) => parseAmount(c[q]) ?? 0);
		const sum = (cyan ?? 0) + (mint ?? 0);
		return formatPercent(sum ? ((p === 'cyan' ? cyan : mint) / sum) * 100 : 0);
	};
	const preview = (f) => ((shown = f), (previewOpen = true));
	let saving = $state(false);

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
			if (cyan === undefined || mint === undefined || !(cyan || mint)) return `Enter what each paid for the ${c.kind === 'object' ? 'object' : `${c.kind} cost`}.`;
			if (!MONTH.test(c.month)) return `Enter the month of the ${c.kind === 'object' ? 'object' : `${c.kind} cost`} as YYYY-MM.`;
			parsed.push({
				kind: c.kind,
				month: c.month,
				cyan: cyan ?? 0,
				mint: mint ?? 0,
				...(c.note.trim() && { note: c.note.trim() }),
				...(c.files.length && { files: c.files })
			});
		}
		return parsed.sort((a, b) => (a.month < b.month ? -1 : 1));
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
				for (const c of costs) c.files = await Promise.all(c.files.map((f) => (f.file ? upload(f.file) : f)));
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

<form onsubmit={submit}>
	<h1>{section === 'costs' ? 'costs/ownership' : section}</h1>

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
			<fieldset>
				<legend>
					{#if c.kind === 'maintenance'}<Wrench size={18} />{:else if c.kind === 'object'}<Sofa size={18} />{:else}<Paintbrush size={18} />{/if}
					{c.kind === 'object' ? 'object' : `${c.kind} cost`}
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
							<span>{data.names[p]} (kr) <span class="share">{paidShare(c, p)}<Pct /></span></span>
							<span class="field">
								<Face person={p} size={18} />
								<input bind:value={c[p]} oninput={() => partChanged(c)} inputmode="decimal" placeholder="0,00" />
							</span>
						</label>
					{/each}
				</div>
				<label>
					note
					<input
						bind:value={c.note}
						placeholder={c.kind === 'object' ? 'washing machine, sofa…' : 'new kitchen, roof…'}
						autocomplete="off"
						onpaste={(e) => [...(e.clipboardData?.items ?? [])].some((i) => i.kind === 'file') && pasted(c, e)}
					/>
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
					<button type="button" class="attach" onclick={() => paste(c)}><ClipboardPaste size={16} />+ paste</button>
					{#if pasteBox === c}
						<!-- A plain text field, like a chat's: the system's Paste hands it files too. Typed text is dropped. -->
						<textarea
							class="paste-box"
							rows="2"
							placeholder="tap and hold here, then Paste"
							aria-label="paste here"
							onpaste={(e) => pasted(c, e)}
							oninput={(e) => (e.currentTarget.value = '')}
						></textarea>
					{/if}
				</div>
			</fieldset>
		{/each}
		<div class="add">
			<div class="add-row">
				<button type="button" onclick={() => addCost('maintenance')}><Wrench size={18} />+ maintenance</button>
				<button type="button" onclick={() => addCost('improvement')}><Paintbrush size={18} />+ improvement</button>
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
	.share {
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
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
	.paste-box {
		flex-basis: 100%;
		resize: none;
		font: inherit;
		padding: 0.8rem;
		border: 1px dashed var(--accent);
		border-radius: 10px;
		font-size: 0.82rem;
		color: var(--muted);
		text-align: center;
		-webkit-user-select: text;
		user-select: text;
	}
	.attach input {
		display: none;
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
