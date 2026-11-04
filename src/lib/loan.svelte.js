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
let queue = Promise.resolve(); // saves run one after another, each on top of the previous version

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
	later();
}

// Call on every keystroke: while someone is still typing, a waiting save waits 3 seconds more
export function typing() {
	if (loan.status === 'pending') later();
}

function later() {
	clearTimeout(timer);
	timer = setTimeout(save, SAVE_DELAY);
}

// Saves now and resolves when done: for "not saved" (try again), and before locking or changing
// the password so a waiting or failed edit isn't lost
export function save() {
	clearTimeout(timer);
	queue = queue.then(saveNow);
	return queue;
}

// The loan data as a plain object, months in order: exactly what is encrypted into loan.json
export function plain() {
	const data = $state.snapshot(loan.data);
	data.payments = Object.fromEntries(Object.entries(data.payments).sort(([a], [b]) => (a < b ? -1 : 1)));
	return data;
}

async function saveNow() {
	// Nothing loaded or nothing new (an earlier save in the queue already wrote this edit)
	if (!loan.data || !['pending', 'error'].includes(loan.status)) return;
	loan.status = 'saving';
	try {
		loan.sha = await write(FILE, plain(), loan.sha);
		if (loan.status === 'saving') loan.status = 'saved'; // unless edited again meanwhile
	} catch (e) {
		loan.status = 'error';
		loan.error = e.message;
	}
}

export const hasUnsavedChanges = () => ['pending', 'saving', 'error'].includes(loan.status);
