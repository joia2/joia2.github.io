// The loan data file (data.json in joia2data): loaded after login, saved shortly after each edit,
// and dropped from memory when the app locks
import { read, write, session } from '#lib/session.svelte.js';
import { encryptJSON, decryptJSON } from '#lib/crypto.js';
import { DecryptError } from '#lib/errors.js';
import { cleanUp, keepExisting } from '#lib/cleanup.js';
import { getFile } from '#lib/github.js';

const FILE = 'data.json';
const SAVE_DELAY = 3000; // ms after the last edit or keystroke, so a burst of edits saves once

// An edit not saved yet is also kept on this device, encrypted, with the version of data.json it
// was made on: if the app closes before the save, it is saved on the next opening
const DRAFT = 'joia2.draft';
const storage = () => {
	try {
		return localStorage;
	} catch {
		return null;
	}
};
async function keepDraft() {
	if (session.demo || !loan.data) return;
	const text = await encryptJSON(session.key, plain());
	storage()?.setItem(DRAFT, JSON.stringify({ sha: loan.sha, text }));
}
const dropDraft = () => storage()?.removeItem(DRAFT);

const empty = () => ({
	v: 1,
	names: { cyan: 'Person A', mint: 'Person B' },
	takeover: undefined, // set in the apartment form; kept here so it is written before the total
	setupCosts: undefined, // the loan's set-up costs, paid on the take-over day
	total: 0,
	egenkapital: { cyan: 0, mint: 0 },
	costs: [],
	payments: {}
});

// The demo: 10 M kr, 1 M kr egenkapital each, first payment December 2026. Nothing is saved.
const demo = () => ({
	...empty(),
	total: 10_000_000,
	egenkapital: { cyan: 1_000_000, mint: 1_000_000 },
	payments: { '2026-12': { interest: 4.78 } }
});

// status: 'idle' | 'loading' | 'pending' (edited, not saved yet) | 'saving' | 'saved' | 'error'
export const loan = $state({ data: null, sha: null, status: 'idle', error: '' });

let timer;
// Every version of data.json this device has read or saved: GitHub can answer with one of them for a
// moment after a save, which is never a change made elsewhere
const seen = new Set();
let cleaned = false;
let queue = Promise.resolve(); // saves run one after another, each on top of the previous version

export async function loadLoan() {
	if (session.demo) {
		Object.assign(loan, { data: demo(), sha: null, status: 'idle', error: '' });
		return;
	}
	loan.status = 'loading';
	try {
		// Before data.json, the file was loan.json: read while data.json isn't there yet, and saved
		// as data.json from the first edit on
		const file = (await read(FILE)) ?? (await read('loan.json').then((old) => old && { ...old, sha: null }));
		// The file keeps its fields in this order: the animals right after the names
		const { v, names, animals, ...rest } = { ...empty(), ...file?.value };
		loan.data = { v, names, ...(animals && { animals }), ...rest };
		loan.sha = file?.sha ?? null;
		seen.add(loan.sha);
		loan.status = 'idle';
		// An edit left from a closing before its save: saved now, if made on this same version
		const draft = JSON.parse(storage()?.getItem(DRAFT) ?? 'null');
		if (draft && draft.sha === loan.sha) {
			// Listing only files still there: one removed meanwhile is dropped, never left pointing nowhere
			loan.data = await keepExisting(session.token, await decryptJSON(session.key, draft.text));
			changed();
		} else if (draft) {
			dropDraft();
			loan.status = 'error';
			loan.error = 'An edit from before could not be saved: the data was changed elsewhere meanwhile.';
		}
		// No longer used: the debt between the two bears the mortgage's rate; LO is entered each month
		delete loan.data.debtRate;
		delete loan.data.member;
		for (const entry of Object.values(loan.data.payments ?? {})) delete entry.lofavor;
		// Unused attachment files left by an upload or removal that stopped halfway: removed in the
		// background (failing quietly: it tries again on the next opening)
		if (!cleaned) cleanUp(session.token, $state.snapshot(loan.data)).catch(() => {});
		cleaned = true; // once per opening of the app
	} catch (e) {
		loan.status = 'error';
		// A key that no longer opens the data: the password was most likely changed on another device
		loan.error = e instanceof DecryptError ? `${e.message} If the password was changed, lock and log in with the new one.` : e.message;
	}
}

// Whether data.json changed in the repo since it was read here (saved from another device)
export async function changedElsewhere() {
	const file = await getFile(session.token, FILE);
	return Boolean(file) && !seen.has(file.sha);
}

export function unloadLoan() {
	clearTimeout(timer);
	dropDraft(); // locked on purpose: an edit that failed to save was given up
	Object.assign(loan, { data: null, sha: null, status: 'idle', error: '' });
}

// Call after changing loan.data
export function changed() {
	loan.status = 'pending';
	keepDraft();
	later();
}

// Leaving the app (switching away, closing): saves at once instead of after the delay
if (typeof document !== 'undefined') {
	document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && loan.status === 'pending' && save());
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

// The loan data as a plain object, months in order: exactly what is encrypted into data.json
export function plain() {
	const data = $state.snapshot(loan.data);
	data.payments = Object.fromEntries(Object.entries(data.payments).sort(([a], [b]) => (a < b ? -1 : 1)));
	return data;
}

async function saveNow() {
	// Nothing loaded or nothing new (an earlier save in the queue already wrote this edit)
	if (!loan.data || !['pending', 'error'].includes(loan.status)) return;
	if (session.demo) return void (loan.status = 'saved'); // the demo stays in memory
	loan.status = 'saving';
	try {
		loan.sha = await write(FILE, plain(), loan.sha);
		seen.add(loan.sha);
		if (loan.status === 'saving') (loan.status = 'saved'), dropDraft();
		else keepDraft(); // edited again meanwhile: that edit is kept on the new version
	} catch (e) {
		loan.status = 'error';
		loan.error = e.message;
	}
}

export const hasUnsavedChanges = () => !session.demo && ['pending', 'saving', 'error'].includes(loan.status);
