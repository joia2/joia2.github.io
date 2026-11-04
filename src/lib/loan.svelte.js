// The loan data file (loan.json in joia2data): loaded after login, saved shortly after each edit,
// and dropped from memory when the app locks
import { read, write } from '#lib/session.svelte.js';

const FILE = 'loan.json';
const SAVE_DELAY = 3000; // ms after the last edit or keystroke, so a burst of edits saves once

const empty = () => ({
	v: 1,
	names: { cyan: 'Person A', mint: 'Person B' },
	total: 0,
	egenkapital: { cyan: 0, mint: 0 },
	payments: {}
});

// status: 'idle' | 'loading' | 'pending' (edited, not saved yet) | 'saving' | 'saved' | 'error'
export const loan = $state({ data: null, sha: null, status: 'idle', error: '' });

let timer;
let saving = Promise.resolve();

export async function loadLoan() {
	loan.status = 'loading';
	try {
		const file = await read(FILE);
		loan.data = { ...empty(), ...file?.value };
		loan.sha = file?.sha ?? null;
		loan.status = 'idle';
	} catch (e) {
		loan.status = 'error';
		loan.error = e.message;
	}
}

export function unloadLoan() {
	clearTimeout(timer);
	Object.assign(loan, { data: null, sha: null, status: 'idle', error: '' });
}

// Call after changing loan.data
export function changed() {
	loan.status = 'pending';
	clearTimeout(timer);
	timer = setTimeout(save, SAVE_DELAY);
}

// Call on every keystroke: while someone is still typing, a waiting save waits 3 seconds more
export function typing() {
	if (loan.status !== 'pending') return;
	clearTimeout(timer);
	timer = setTimeout(save, SAVE_DELAY);
}

// Saves now: after a failed save, or before locking so a pending or failed edit isn't lost
export function retry() {
	clearTimeout(timer);
	return save();
}

export async function flush() {
	if (loan.status === 'pending' || loan.status === 'error') {
		clearTimeout(timer);
		await save();
	} else {
		await saving;
	}
}

// The loan data as a plain object, months in order: exactly what is encrypted into loan.json
export function plain() {
	const data = $state.snapshot(loan.data);
	data.payments = Object.fromEntries(Object.entries(data.payments).sort(([a], [b]) => (a < b ? -1 : 1)));
	return data;
}

async function save() {
	await saving; // one save at a time, each building on the previous one's version
	if (!loan.data) return; // nothing loaded, so nothing to save
	const data = plain();
	loan.status = 'saving';
	saving = write(FILE, data, loan.sha);
	try {
		loan.sha = await saving;
		if (loan.status === 'saving') loan.status = 'saved';
	} catch (e) {
		loan.status = 'error';
		loan.error = e.message;
		saving = Promise.resolve();
	}
}

export const hasUnsavedChanges = () => ['pending', 'saving', 'error'].includes(loan.status);
