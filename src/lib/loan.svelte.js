// The loan data file (loan.json in joia2data): loaded after login, saved shortly after each edit,
// and dropped from memory when the app locks
import { read, write } from '#lib/session.svelte.js';

const FILE = 'loan.json';
const SAVE_DELAY = 800; // ms after the last edit, so typing in several fields saves once

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

// Saves a pending edit now, e.g. before locking
export async function flush() {
	if (loan.status === 'pending') {
		clearTimeout(timer);
		await save();
	} else {
		await saving;
	}
}

async function save() {
	await saving; // one save at a time, each building on the previous one's version
	const data = $state.snapshot(loan.data);
	data.payments = Object.fromEntries(Object.entries(data.payments).sort(([a], [b]) => (a < b ? -1 : 1)));
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

export const hasUnsavedChanges = () => loan.status === 'pending' || loan.status === 'saving';
