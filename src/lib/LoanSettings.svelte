<script>
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import House from '@lucide/svelte/icons/house';
	import Calendar from '@lucide/svelte/icons/calendar';
	import Face from '#lib/Face.svelte';
	import { loan, changed } from '#lib/loan.svelte.js';
	import { addMonths, currentMonth, parseAmount, PEOPLE } from '#lib/loan.js';

	// section: 'names' | 'apartment' | 'egenkapital'
	let { section, onclose } = $props();

	const data = loan.data;
	const months = Object.keys(data.payments).sort();
	// The first month can only move while no payments are entered
	const startLocked = months.some((m) => PEOPLE.some((p) => data.payments[m][p] != null));

	let names = $state({ ...data.names });
	let total = $state(data.total ? String(data.total) : '');
	let start = $state(months[0] ?? addMonths(currentMonth(), 1));
	let egenkapital = $state({ cyan: String(data.egenkapital.cyan || ''), mint: String(data.egenkapital.mint || '') });
	let error = $state('');

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
			if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) return (error = 'Enter the first payment month as YYYY-MM.');
			if (price / 2 < Math.max(data.egenkapital.cyan, data.egenkapital.mint)) {
				return (error = "Egenkapital can't be more than half the price.");
			}
			data.total = price;
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
				<input bind:value={total} inputmode="decimal" placeholder="8 700 000" />
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
	{:else}
		{#each PEOPLE as p (p)}
			<label>
				{data.names[p]} (kr)
				<span class="field">
					<Face person={p} size={20} />
					<input bind:value={egenkapital[p]} inputmode="decimal" placeholder="0" />
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
