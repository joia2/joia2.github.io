import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, compute, monthsLeft, dropMin, dropTime, instalmentFor, saleSplit, taxShares, setValue, toOre, PEOPLE, TERM } from '#lib/loan.js';

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
const sumPrincipal = (r, p, from, to) => loanRows(r).filter((x) => x.month >= from && x.month <= to).reduce((s, x) => s + x.people[p].principal, 0);

// Checks that must hold for every scenario
function invariants(r, label) {
	// The interest table is exactly the interest each row says was paid, year by year
	for (const p of PEOPLE) {
		const fromRows = {};
		for (const x of loanRows(r)) {
			const y = addMonths(x.month, -1).slice(0, 4); // the year the interest built up
			fromRows[y] = (fromRows[y] ?? 0) + x.people[p].interest + x.people[p].feePaid;
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
	const due = rows.reduce((s, x) => s + x.people.cyan.interestDue + x.people.mint.interestDue + x.people.cyan.feeDue + x.people.mint.feeDue, 0);
	assert.equal(totalInterest(r), due);
	assert.equal(owned(r), toOre(8700000));
	// Every year is an estimate when nothing is typed
	assert.ok(Object.values(r.interestPaid).every((y) => y.estimate));
});

test('payment fixed for the whole term, like the bank; the last one settles the rest', () => {
	const r = compute(base(), '2056-12');
	const rows = loanRows(r);
	for (const p of PEOPLE) {
		const mins = new Set(rows.slice(1, -1).map((x) => x.people[p].min));
		assert.equal(mins.size, 1, `${p}: one payment`);
		assert.ok(rows.at(-1).people[p].min <= rows.at(-2).people[p].min, `${p}: last not larger`);
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

test('an extra lowers the next minimums, same end, less interest', () => {
	const plain = compute(base(), '2056-12');
	const minJan = row(plain, '2027-01').people.cyan.min;
	const r = compute(base({ '2027-01': { cyan: minJan / 100 + 500000 } }), '2056-12');
	invariants(r, 'extra');
	assert.equal(row(r, '2027-01').people.cyan.principal, row(plain, '2027-01').people.cyan.principalDue + toOre(500000));
	assert.ok(sumYears(r, 'cyan') < sumYears(plain, 'cyan'));
	assert.ok(row(r, '2027-02').people.cyan.min < row(plain, '2027-02').people.cyan.min);
	assert.equal(row(r, '2027-02').people.mint.min, row(plain, '2027-02').people.mint.min);
	assert.equal(loanRows(r).length, TERM);
	assert.equal(r.state.balance.cyan, 0);
	// The time left still counts the first instalment, so the extra shortens it
	assert.ok(monthsLeft(base({ '2027-01': { cyan: minJan / 100 + 500000 } }), r, '2026-11', 'cyan') < TERM - 12);
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
	const d = base({ '2027-02': { cyan: 'min' }, '2027-03': { cyan: 'min', mint: 20000 } });
	d.payments[START].cyan = 'min';
	assert.equal(dropMin(d), true);
	assert.equal(d.payments['2027-02'], undefined);
	assert.deepEqual(d.payments['2027-03'], { mint: 20000 });
	assert.deepEqual(d.payments[START], { interest: 4.78, fee: 50 });
	assert.equal(dropMin(d), false);
});

test('short covered by the other: counts as paid by the one short, and becomes their debt (3.4)', () => {
	const plain = run();
	const jan = row(plain, '2027-01');
	const cMin = jan.people.cyan.min / 100;
	const mMin = jan.people.mint.min / 100;
	const r = run({ '2027-01': { cyan: 0, mint: cMin + mMin } }, {}, '2027-01');
	invariants(r, 'covered');
	const x = row(r, '2027-01');
	assert.equal(x.people.cyan.covered, -x.people.cyan.short);
	assert.equal(x.people.cyan.uncovered, 0);
	// Cyan's part goes down as if cyan had paid, and cyan owes mint the whole amount
	assert.deepEqual(r.state.balance, compute(base(), '2027-01').state.balance);
	assert.equal(x.debt, jan.people.cyan.min);
	// Ownership stays 50/50, and the interest counts for cyan, whose part it is (3.6)
	assert.deepEqual(r.state.own, r.half);
	assert.equal(x.people.cyan.interest, x.people.cyan.interestDue);
	assert.equal(r.state.covered.mint, jan.people.cyan.min);
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

test('a covered amount repaid in money with the next month is free of interest (40 days)', () => {
	const jan = row(run(), '2027-01').people.cyan.min / 100;
	const both = (row(run(), '2027-01').people.mint.min / 100) + jan;
	// Repaid in full in February: no interest, no debt left
	const repaid = run({ '2027-01': { cyan: 0, mint: both }, '2027-02': { debt: { cyan: jan } } }, {}, '2027-02');
	assert.equal(row(repaid, '2027-02').debtInterest, 0);
	assert.equal(repaid.state.debt, 0);
	// Not repaid: forsinkelsesrente from the payment, at 12.25 % unless set
	const kept = run({ '2027-01': { cyan: 0, mint: both } }, {}, '2027-02');
	const feb = row(kept, '2027-02');
	assert.equal(feb.debtInterest, Math.round((toOre(jan) * 12.25 * 31) / 36500));
	assert.equal(row(run({ '2027-01': { cyan: 0, mint: both } }, { debtRate: 10 }, '2027-02'), '2027-02').debtInterest, Math.round((toOre(jan) * 10 * 31) / 36500));
	// The debt is never taken from later principal: it stays until repaid in money
	const later = compute(base({ '2027-01': { cyan: 0, mint: both } }), '2028-01');
	assert.ok(later.state.debt > toOre(jan));
});

test('debt repaid in money: lowers the debt only, moves no ownership', () => {
	const shortMonth = { '2027-01': { cyan: 0, mint: 200000 } };
	const noEquity = { egenkapital: { cyan: 0, mint: 0 } };
	const before = compute(base(shortMonth, noEquity), '2027-02');
	const owed = row(before, '2027-01').debt;
	assert.ok(owed > 0, 'cyan owes mint');
	assert.equal(row(before, '2027-02').owing, 'cyan');

	// Paid off in money in February, with a bit too much
	const cash = owed / 100 + 1000;
	const r = compute(base({ ...shortMonth, '2027-02': { debt: { cyan: cash } } }, noEquity), '2027-02');
	invariants(r, 'debt in money');
	const feb = row(r, '2027-02');
	assert.equal(feb.debt, 0, 'debt settled');
	assert.equal(feb.debtRepaid + feb.debtSurplus.cyan, toOre(cash));
	assert.ok(feb.debtSurplus.cyan > 0, 'the extra is shown, not applied');
	// Ownership is the same as without the money payment: only principal moves ownership
	assert.deepEqual(row(r, '2027-02').people.cyan.principal, row(before, '2027-02').people.cyan.principal);
	assert.ok(r.state.equity.cyan >= before.state.equity.cyan, 'no later principal went to the other');
	assert.equal(r.state.own.cyan + r.state.own.mint, before.state.own.cyan + before.state.own.mint);
});

test('debt typed without a debt: kept, shown as surplus, applied to nothing', () => {
	const r = run({ '2027-01': { debt: { mint: 1000 } } }, {}, '2027-01');
	const jan = row(r, '2027-01');
	assert.equal(jan.owing, null);
	assert.equal(jan.debtRepaid, 0);
	assert.equal(jan.debtSurplus.mint, toOre(1000));
	assert.equal(jan.debt, 0);
});

test('setValue: debt kept per person, removed when emptied', () => {
	const data = base();
	setValue(data, '2027-02', 'debt', 500, 'cyan');
	assert.deepEqual(data.payments['2027-02'], { debt: { cyan: 500 } });
	setValue(data, '2027-02', 'debt', null, 'cyan');
	assert.equal(data.payments['2027-02'], undefined);
});

test('year end: loan left on 31 December, after the December payment', () => {
	const r = run({}, {}, '2027-12');
	const dec = row(r, '2027-12');
	const jan = row(r, '2028-01');
	for (const p of PEOPLE) {
		// What is left after December is what January's principal then lowers
		assert.ok(r.yearEnd['2027'].loan[p] > 0);
		assert.equal(r.yearEnd['2027'].loan[p] - jan.people[p].principal, r.yearEnd['2028'] ? r.yearEnd['2028'].loan[p] + sumPrincipal(r, p, '2028-02', '2028-12') : r.yearEnd['2027'].loan[p] - jan.people[p].principal);
	}
	assert.equal(r.yearEnd['2027'].debt, dec.debt);
});

test('sale: half the price less costs, less own loan left, debt set off (4.2, 7.9)', () => {
	const state = { balance: { cyan: 300, mint: 100 }, debt: 10 };
	// 1000 − 100 costs = 900: 450 each; cyan 450 − 300, mint 450 − 100; cyan owes mint 10
	const sale = saleSplit(state, 1000, 100);
	assert.equal(sale.net, 500);
	assert.deepEqual(sale.proceeds, { cyan: 150, mint: 350 });
	assert.deepEqual(sale.gets, { cyan: 140, mint: 360 });
	// A negative Settlement Amount: paid in by that person
	const low = saleSplit(state, 500, 0);
	assert.deepEqual(low.proceeds, { cyan: -50, mint: 150 });
	for (const x of [sale, low]) assert.equal(x.gets.cyan + x.gets.mint, x.net);
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
	pay['2028-01'] = { cyan: 20000, mint: 25000 }; // December 2027's interest, paid 1 January
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

test('dropTime: "time" removed from older files, with months left empty', () => {
	const d = base({
		'2027-01': { cyan: 200000, time: { cyan: true } },
		'2027-03': { time: { mint: true } }
	});
	assert.equal(dropTime(d), true);
	assert.deepEqual(d.payments['2027-01'], { cyan: 200000 });
	assert.equal(d.payments['2027-03'], undefined);
	assert.equal(dropTime(d), false);
});

test('mortgage length: shorter from a month on, payments rise, ends at the new length', () => {
	const plain = compute(base(), '2056-12');
	const d = base({ '2027-01': { cyan: 50000 } });
	setValue(d, '2028-01', 'term', 120);
	const r = compute(d, '2056-12');
	invariants(r, 'term');
	assert.equal(row(r, '2027-06').people.cyan.min, compute(base({ '2027-01': { cyan: 50000 } }), '2056-12').rows.find((x) => x.month === '2027-06').people.cyan.min);
	assert.ok(row(r, '2028-01').people.mint.min > row(plain, '2028-01').people.mint.min);
	assert.equal(loanRows(r).length, 120);
	assert.equal(r.state.balance.cyan + r.state.balance.mint, 0);
	// Shorter than the months already gone: the rest is due at once
	setValue(d, '2028-01', 'term', 3);
	const now = compute(d, '2056-12');
	assert.equal(loanRows(now).at(-1).month, '2028-01');
	assert.equal(now.state.balance.cyan + now.state.balance.mint, 0);
});

test('take-over day: first interest only from that day; January interest in the year before', () => {
	const r = compute(base({}, { takeover: '2026-11-15' }), '2027-02');
	const plain = compute(base(), '2027-02');
	const first = (x) => x.rows[0].people.cyan.interestDue;
	const b = toOre(8700000 / 2 - 500000);
	assert.equal(first(r), Math.round((b * 4.78 * 16) / 36500)); // 15 Nov → 1 Dec: 16 days
	assert.equal(first(plain), Math.round((b * 4.78 * 30) / 36500)); // no take-over day: all of November
	// 2026: the payments of 1 Dec (November) and 1 Jan (December), with their fees
	const [dec, jan] = r.rows;
	const sum = (x) => x.people.cyan.interest + x.people.cyan.feePaid;
	assert.equal(r.interestPaid['2026'].cyan, sum(dec) + sum(jan));
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
			}
			if (rand() < 0.05) e.interest = 3 + Math.round(rand() * 300) / 100;
			if (rand() < 0.03) e.term = 1 + Math.floor(rand() * TERM);
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
		assert.ok(end.rows.length < 1560, `run ${n}: rows stop`);
	}
});

test('instalment calculator: unchanged gives the row, a paid-off part takes no fee', () => {
	const r = compute(base(), '2027-03');
	const mar = row(r, '2027-03');
	const balance = { cyan: mar.people.cyan.balance, mint: mar.people.mint.balance };
	const same = instalmentFor(mar, { balance, rate: mar.rate, fee: mar.fee });
	for (const p of PEOPLE) assert.equal(same.people[p].total, mar.people[p].min);
	const alone = instalmentFor(mar, { balance: { ...balance, mint: 0 }, rate: mar.rate, fee: 5000 });
	assert.equal(alone.people.mint.total, 0);
	assert.equal(alone.people.cyan.fee, 5000);
	const higher = instalmentFor(mar, { balance, rate: mar.rate + 1, fee: mar.fee });
	assert.ok(higher.total > same.total);
});

test("the bank's plan (LOFavør Førstehjemslån, 06.11.2026): instalments, interest and balances", () => {
	const data = { total: 8771000, egenkapital: { cyan: 0, mint: 945000 }, takeover: '2026-12-08', payments: { '2027-01': { interest: 5.03, fee: 60 } } };
	const r = compute(data, '2027-01');
	const kr = (x, f) => Math.round((f(x.people.cyan) + f(x.people.mint)) / 100);
	// [month, payment with fee, interest, balance after] from the bank's plan
	const plan = [
		['2027-02', 42216, 33396, 7808517],
		['2027-03', 42216, 30130, 7796491],
		['2028-02', 42216, 32813, 7692580], // January 2028 in a leap year
		['2029-01', 42216, 32338, 7580658]
	];
	for (const [m, pay, interest, left] of plan) {
		const x = row(r, m);
		assert.equal(kr(x, (s) => s.min), pay, `${m} payment`);
		assert.equal(kr(x, (s) => s.interestDue), interest, `${m} interest`);
		assert.ok(Math.abs(kr(x, (s) => s.balance - s.principalDue) - left) <= 2, `${m} balance`);
	}
	// The first payment: interest for 24 days only, principal as for a whole month
	assert.ok(Math.abs(kr(row(r, '2027-01'), (s) => s.min) - 34666) <= 1);
	assert.equal(r.rows.at(-1).month, '2056-12');
});

test("time left: at the first instalment; one's extra never changes the other's", () => {
	const plain = base();
	const r0 = compute(plain, '2026-11');
	assert.ok(Math.abs(monthsLeft(plain, r0, '2026-11', 'cyan') - TERM) <= 1);
	const d = base({ '2027-06': { cyan: 2000000 } });
	const r = compute(d, '2026-11');
	assert.ok(monthsLeft(d, r, '2026-11', 'cyan') < TERM - 12);
	assert.equal(monthsLeft(d, r, '2026-11', 'mint'), monthsLeft(plain, r0, '2026-11', 'mint'));
	// Ticking the first month, shorter with a take-over day, changes nothing
	const late = { takeover: '2026-11-15' };
	const lateRun = compute(base({}, late), '2026-11');
	const tick = base({ '2026-12': { interest: 4.78, fee: 50, mint: row(lateRun, '2026-12').people.mint.min / 100 } }, late);
	assert.equal(monthsLeft(tick, compute(tick, '2026-11'), '2026-11', 'mint'), monthsLeft(base({}, late), lateRun, '2026-11', 'mint'));
	// Paid off by the other, who then pays the whole fee: a ticked month counts the same for this one
	const ticked = { '2027-01': { mint: row(r0, '2027-01').people.mint.min / 100 } };
	const t0 = base(ticked);
	const t1 = base({ '2027-01': { ...ticked['2027-01'] }, '2026-12': { interest: 4.78, fee: 50, cyan: 9000000 } });
	assert.equal(monthsLeft(t1, compute(t1, '2026-11'), '2026-11', 'mint'), monthsLeft(t0, compute(t0, '2026-11'), '2026-11', 'mint'));
	// A shorter mortgage raises the minimum but not the time left at the first instalment
	const short = base({ '2026-12': { interest: 4.78, fee: 50, term: 120 } });
	assert.equal(monthsLeft(short, compute(short, '2026-11'), '2026-11', 'mint'), monthsLeft(plain, r0, '2026-11', 'mint'));
});

// Except when one is short and the other's extra covers it: that counts as paid by the one short, as
// their debt to the other (3.4), so neither is short here
test("time left (200 runs): one's payments never change the other's", () => {
	let seed = 7;
	const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	for (let n = 0; n < 200; n++) {
		const mint = {}; // mint's own ticks and extras, kept
		const cyan = {}; // cyan's, varied
		for (let i = 0, m = START; i < 48; i++, m = addMonths(m, 1)) {
			if (rand() < 0.4) mint[m] = 21000 + Math.round(rand() * 60000); // never short
			if (rand() < 0.4) cyan[m] = rand() < 0.1 ? 3000000 : 25000 + Math.round(rand() * 80000);
		}
		const payments = (withCyan) => {
			const p = {};
			for (const m of new Set([...Object.keys(mint), ...Object.keys(cyan)]))
				p[m] = { ...(m in mint && { mint: mint[m] }), ...(withCyan && m in cyan && { cyan: cyan[m] }) };
			p[START] = { ...p[START], interest: 4.78, fee: 50 };
			return p;
		};
		const a = { ...base(), payments: payments(false) };
		const b = { ...base(), payments: payments(true) };
		assert.equal(monthsLeft(b, compute(b, '2026-11'), '2026-11', 'mint'), monthsLeft(a, compute(a, '2026-11'), '2026-11', 'mint'), `run ${n}`);
	}
});
