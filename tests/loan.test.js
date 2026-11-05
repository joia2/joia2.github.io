import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, dropMin, dropStaleTime, taxShares, setValue, toOre, PEOPLE, TERM } from '#lib/loan.js';

const START = '2026-12';
const base = (payments = {}, extra = {}) => ({
	names: { cyan: 'A', mint: 'B' },
	total: 8700000,
	egenkapital: { cyan: 500000, mint: 300000 },
	payments: { [START]: { interest: 4.78, fee: 50 }, ...payments },
	...extra
});
const run = (payments, extra, today = '2026-11') => compute(base(payments, extra), today);
const sumYears = (r, p) => Object.values(r.interestPaid).reduce((s, y) => s + y[p], 0);
const totalInterest = (r) => sumYears(r, 'cyan') + sumYears(r, 'mint');
const loanRows = (r) => r.rows.filter((x) => x.loan);
const row = (r, m) => r.rows.find((x) => x.month === m);
const owned = (r) => r.state.own.cyan + r.state.own.mint;

// Checks that must hold for every scenario
function invariants(r, label) {
	// The interest table is exactly the interest each row says was paid, year by year
	for (const p of PEOPLE) {
		const fromRows = {};
		for (const x of loanRows(r)) {
			const y = x.month.slice(0, 4);
			fromRows[y] = (fromRows[y] ?? 0) + x.people[p].interest + (x.people[p].interestCovered ?? 0);
		}
		for (const [y, v] of Object.entries(r.interestPaid)) assert.equal(v[p], fromRows[y] ?? 0, `${label}: ${p} ${y}`);
	}
	// Every row's balances never go below 0, and interest is never more than what was due
	for (const x of loanRows(r))
		for (const p of PEOPLE) {
			const s = x.people[p];
			assert.ok(s.interest <= s.interestDue, `${label}: ${x.month} ${p} interest over due`);
			assert.ok(s.principal >= 0 && s.interest >= 0, `${label}: ${x.month} ${p} negative`);
		}
}

test('no entries: 360 months, ends at 0, table = interest due', () => {
	const r = compute(base(), '2056-12');
	invariants(r, 'plain');
	const rows = loanRows(r);
	assert.equal(rows.length, TERM);
	assert.equal(r.state.balance.cyan + r.state.balance.mint, 0);
	const due = rows.reduce((s, x) => s + x.people.cyan.interestDue + x.people.mint.interestDue, 0);
	assert.equal(totalInterest(r), due);
	assert.equal(owned(r), toOre(8700000));
	// Every year is an estimate when nothing is typed
	assert.ok(Object.values(r.interestPaid).every((y) => y.estimate));
});

test('last payment close to the others (yearly recalculation)', () => {
	const r = compute(base(), '2056-12');
	const rows = loanRows(r);
	for (const p of PEOPLE) {
		const last = rows.at(-1).people[p].min;
		const before = rows.at(-2).people[p].min;
		assert.ok(Math.abs(last - before) < 10000, `${p}: ${before} → ${last}`); // under 100 kr
	}
});

test('payment stays fixed; interest uses real days of the previous month', () => {
	const r = run();
	const [dec, jan, feb, mar] = loanRows(r);
	assert.equal(jan.people.cyan.due, feb.people.cyan.due);
	assert.equal(jan.people.cyan.due, mar.people.cyan.due);
	// Worked out again in January: only a few kroner from December
	assert.ok(Math.abs(jan.people.cyan.due - dec.people.cyan.due) < 1000);
	// Mar 1 pays February (28 days), Feb 1 pays January (31): less interest, more principal
	assert.ok(mar.people.cyan.interestDue < feb.people.cyan.interestDue);
	// Dec 1 2026 pays November: 30 days
	const b = toOre(8700000 / 2 - 500000);
	assert.equal(dec.people.cyan.interestDue, Math.round((b * 4.78 * 30) / 36500));
});

test('one extra lowers next payments, same end, less interest', () => {
	const plain = compute(base(), '2056-12');
	const minJan = row(plain, '2027-01').people.cyan.min;
	const r = compute(base({ '2027-01': { cyan: minJan / 100 + 100000 } }), '2056-12');
	invariants(r, 'extra');
	const jan = row(r, '2027-01').people.cyan;
	assert.equal(jan.extra, toOre(100000));
	assert.equal(jan.principal, jan.principalDue + toOre(100000));
	// Balance right after is exactly 100 000 lower than without the extra
	const after = (res) => row(res, '2027-02').people.cyan.interestDue;
	assert.ok(after(r) < after(plain));
	assert.ok(row(r, '2027-02').people.cyan.min < row(plain, '2027-02').people.cyan.min);
	assert.equal(loanRows(r).length, TERM);
	assert.ok(sumYears(r, 'cyan') < sumYears(plain, 'cyan'));
	assert.equal(sumYears(r, 'mint'), sumYears(plain, 'mint')); // mint unaffected
	assert.equal(owned(r), toOre(8700000));
});

test('extra with "time": same payment, ends sooner', () => {
	const plain = compute(base(), '2056-12');
	const minJan = row(plain, '2027-01').people.cyan.min;
	const r = compute(base({ '2027-01': { cyan: minJan / 100 + 500000, time: { cyan: true } } }), '2056-12');
	invariants(r, 'time');
	assert.equal(row(r, '2027-02').people.cyan.min, row(plain, '2027-02').people.cyan.min);
	const last = loanRows(r).filter((x) => x.people.cyan.due > 0).pop();
	assert.ok(last.month < '2056-11', `cyan ends ${last.month}`);
	assert.equal(r.state.balance.cyan, 0);
});

test('several extras across years keep the table consistent', () => {
	const plain = compute(base(), '2056-12');
	const pay = {};
	for (const m of ['2027-03', '2027-09', '2028-01', '2029-06'])
		pay[m] = { cyan: row(plain, m).people.cyan.min / 100 + 20000, mint: row(plain, m).people.mint.min / 100 + 5000 };
	const r = compute(base(pay), '2056-12');
	invariants(r, 'several');
	assert.ok(totalInterest(r) < totalInterest(plain));
	assert.equal(r.state.balance.cyan + r.state.balance.mint, 0);
});

test('extra larger than the part: part paid off, surplus kept, no more minimum', () => {
	const r = compute(base({ '2027-01': { cyan: 9000000 } }), '2056-12');
	invariants(r, 'payoff');
	const jan = row(r, '2027-01').people.cyan;
	assert.ok(jan.surplus > 0);
	assert.equal(row(r, '2027-02').people.cyan.min, 0);
	assert.equal(row(r, '2027-02').people.cyan.feeDue, 0); // mint now pays the whole fee
	assert.equal(row(r, '2027-02').people.mint.feeDue, 5000);
});

test('"min" is not a payment: ignored, and removed by dropMin', () => {
	const r = compute(base({ '2027-02': { cyan: 'min', mint: 20000 } }), '2027-03');
	assert.equal(row(r, '2027-02').people.cyan.typed, false);
	const d = base({ '2027-02': { cyan: 'min', time: { cyan: true } }, '2027-03': { cyan: 'min', mint: 20000 } });
	d.payments[START].cyan = 'min';
	assert.equal(dropMin(d), true);
	assert.equal(d.payments['2027-02'], undefined);
	assert.deepEqual(d.payments['2027-03'], { mint: 20000 });
	assert.deepEqual(d.payments[START], { interest: 4.78, fee: 50 });
	assert.equal(dropMin(d), false);
});

test('short covered by the other: ownership moves, interest counts for the coverer', () => {
	const plain = run();
	const jan = row(plain, '2027-01');
	const cMin = jan.people.cyan.min / 100;
	const mMin = jan.people.mint.min / 100;
	const r = run({ '2027-01': { cyan: 0, mint: cMin + mMin } }, {}, '2027-01');
	invariants(r, 'covered');
	const x = row(r, '2027-01');
	assert.equal(x.people.cyan.covered, -x.people.cyan.short);
	assert.equal(x.people.cyan.uncovered, 0);
	assert.equal(x.people.mint.interestCovered, x.people.cyan.interestDue);
	// Mint now owns more than half
	assert.ok(r.state.own.mint > r.half.mint);
	assert.equal(owned(r), toOre(8700000));
	// January's interest counts for mint only
	assert.equal(x.people.cyan.interest, 0);
});

test('short and not covered: interest added to what that person owes', () => {
	const r = run({ '2027-01': { cyan: 0 } }, {}, '2027-01');
	invariants(r, 'uncovered');
	const x = row(r, '2027-01').people.cyan;
	assert.equal(x.uncovered, x.short);
	assert.equal(x.interest, 0);
	// Balance grew by the unpaid interest + fee
	assert.equal(r.state.balance.cyan, row(r, '2027-01').people.cyan.interestDue + x.feeDue + toOre(8700000 / 2 - 500000) - row(r, '2026-12').people.cyan.principal);
});

test('covered with no equity left: becomes a debt, repaid later', () => {
	const r = compute(base({ '2027-01': { cyan: 0, mint: 200000 } }, { egenkapital: { cyan: 0, mint: 0 } }), '2056-12');
	invariants(r, 'debt');
	assert.ok(row(r, '2027-01').debt > 0, 'cyan owes mint');
	const repaid = r.rows.find((x) => x.month > '2027-01' && x.debt === 0);
	assert.ok(repaid, 'debt repaid from later principal');
});

test('rate change: payment worked out again, same end', () => {
	const r = compute(base({ '2027-06': { interest: 3.5 } }), '2056-12');
	invariants(r, 'rate');
	assert.ok(row(r, '2027-06').people.cyan.min < row(r, '2027-05').people.cyan.min);
	assert.equal(loanRows(r).length, TERM);
});

test('estimate flag: only years with untyped months', () => {
	const pay = {};
	for (let m = 1; m <= 12; m++) pay[`2027-${String(m).padStart(2, '0')}`] = { cyan: 20000, mint: 25000 };
	pay[START] = { interest: 4.78, fee: 50, cyan: 20000, mint: 25000 };
	const r = compute(base(pay), '2028-02');
	assert.equal(r.interestPaid['2026'].estimate, false);
	assert.equal(r.interestPaid['2027'].estimate, false);
	assert.equal(r.interestPaid['2028'].estimate, true);
});

test('tax shares: last finished year, split by interest actually paid', () => {
	const r = compute(base({ '2027-01': { cyan: 200000 } }), '2027-11');
	const t = taxShares(r, '2027-11');
	assert.equal(t.year, 2026);
	assert.ok(Math.abs(t.cyan + t.mint - 100) < 1e-9);
	// Equal parts would be 50/50; cyan has less loan (more egenkapital), so a lower share
	assert.ok(t.cyan < 50);
	assert.equal(taxShares(r, '2028-03').year, 2027);
	assert.equal(taxShares(r, '2026-11').year, 2026); // before the first payment: the coming year, as an estimate
});

test('dropStaleTime: "time" kept only while the toggle shows', () => {
	const d = base({
		'2027-01': { cyan: 200000, time: { cyan: true } }, // extra: kept
		'2027-02': { cyan: 1000, time: { cyan: true } }, // short, no extra: dropped with the month's time
		'2027-03': { time: { mint: true } }, // nothing typed: month removed
		'2027-04': { cyan: 200000, interest: 5, time: { cyan: true, mint: true } } // mint has no extra
	});
	assert.equal(dropStaleTime(d), true);
	assert.deepEqual(d.payments['2027-01'], { cyan: 200000, time: { cyan: true } });
	assert.deepEqual(d.payments['2027-02'], { cyan: 1000 });
	assert.equal(d.payments['2027-03'], undefined);
	assert.deepEqual(d.payments['2027-04'], { cyan: 200000, interest: 5, time: { cyan: true } });
	assert.equal(dropStaleTime(d), false);
});

test('setValue: empty values removed, first month kept', () => {
	const d = base();
	setValue(d, '2027-01', 'cyan', 1000);
	setValue(d, '2027-01', 'cyan', null);
	assert.equal(d.payments['2027-01'], undefined);
	setValue(d, START, 'fee', null);
	assert.ok(d.payments[START]);
});

test('random months of extras, shorts and ticks (500 runs)', () => {
	let seed = 1;
	const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const months = Array.from({ length: 60 }, (_, i) => {
		const d = new Date(Date.UTC(2026, 11 + i, 1));
		return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
	});
	for (let n = 0; n < 500; n++) {
		const pay = {};
		for (const m of months) {
			if (rand() < 0.5) continue;
			const e = {};
			for (const p of PEOPLE) {
				const x = rand();
				e[p] = x < 0.3 ? 18000 + Math.round(rand() * 6000) : x < 0.5 ? Math.round(rand() * 60000) : x < 0.6 ? 0 : 25000 + Math.round(rand() * 200000);
				if (rand() < 0.2) (e.time ??= {})[p] = true;
			}
			if (rand() < 0.05) e.interest = 3 + Math.round(rand() * 300) / 100;
			pay[m] = e;
		}
		pay[START] = { ...pay[START], interest: 4.78, fee: 50 };
		const r = compute(base(pay), '2031-12');
		invariants(r, `run ${n}`);
		const json = JSON.stringify(r);
		assert.ok(!/NaN|Infinity/.test(json), `run ${n}: NaN`);
		assert.equal(owned(r), toOre(8700000), `run ${n}: ownership`);
		for (const x of loanRows(r)) for (const p of PEOPLE) assert.ok(x.people[p].min >= 0, `run ${n}: ${x.month}`);
		// After the last row both parts and the debt are settled, or rows hit the limit
		const end = compute(base(pay), '2100-01');
		assert.equal(end.state.balance.cyan + end.state.balance.mint, 0, `run ${n}: loan left`);
		assert.equal(end.state.debt, 0, `run ${n}: debt left`);
	}
});
