// Loan math for joia2. Two people own an apartment 50/50 and share one bank loan, paid on the 1st
// of every month. The data file holds kroner; everything here works in øre (whole numbers), so
// amounts round the way the bank's do.
//
// Each person has their own internal part of the loan: their half of the apartment minus their
// egenkapital. Like the bank's, each person's monthly payment stays fixed, rounded up to whole
// kroner; interest for the actual days of the month only changes how much of it is principal, and the
// last payment settles what is left. The payment is worked out again when the rate or the mortgage's
// length changes, or when a month's payment differs from it (extra, or short and not covered).
//
// The mortgage's length (`term` in a month's entry: months from the first payment, 360 until set)
// carries forward like the rate. An extra lowers the next payments; with `time` (a view option, not
// saved) the payments are kept instead and the loan ends sooner.
//
// Each owns 50 % whatever is paid (samboerkontrakt 4.1). When one pays less than their instalment
// and the other covers it (a Substitute Payment, 3.4), it counts as paid by the one who fell short,
// and the amount becomes their personal debt to the other. The debt bears interest at the rate for
// overdue payments (forsinkelsesrente, `data.debtRate`) from the payment, unless repaid in full
// within 40 days, that is with the next month's entry. It is repaid in money (`debt: { cyan, mint }`
// in a month's entry), or settled from the sale (7.9).
//
// Maintenance and improvement costs (data.costs) are a record of what each paid: they change
// neither ownership nor the loan (4.3).

export const PEOPLE = ['cyan', 'mint'];
export const TERM = 360; // 30 years
export const DEBT_RATE = 12.25; // forsinkelsesrente from 1 July 2026, until data.debtRate says otherwise
const LIMIT = TERM + 1200; // stops a debt that is never repaid from producing rows forever

export const other = (person) => (person === 'cyan' ? 'mint' : 'cyan');
export const toOre = (kr) => Math.round(Number(kr) * 100);

// Kroner always with øre, Norwegian style: 1 000,00
const amountFormat = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatKr = (ore) => amountFormat.format(ore / 100);
// The same for an amount in kroner as the data file holds it; empty stays empty
export const formatAmount = (kr) => (kr === undefined || kr === null || kr === '' ? '' : amountFormat.format(Number(kr)));
// A percentage the same way: 43,87
export const formatPercent = (value) => amountFormat.format(value);

export function addMonths(month, n) {
	const [y, m] = month.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1 + n, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonth(date = new Date()) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// The days in the month before: what a payment on the 1st settles interest for
function monthDays(month) {
	const [y, m] = month.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
}

// A payment on the 1st settles the interest for every day of the month before; the first one only
// from the day the loan was paid out ('YYYY-MM-DD')
function interestDays(month, from) {
	const [y, m] = month.split('-').map(Number);
	const days = from ? Math.round((Date.UTC(y, m - 1, 1) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) : 0;
	return days > 0 ? days : monthDays(month);
}

// Interest on an amount for some days, at a yearly rate in percent; like the bank's, a day is a
// 366th of the year in a leap year
const interestFor = (amount, rate, days, yearDays = 365) => Math.round((amount * rate * days) / (yearDays * 100));

// The days in the year the interest for a payment on the 1st built up in (the month before)
function yearDays(month) {
	const y = Number(addMonths(month, -1).slice(0, 4));
	return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
}

// The bank's monthly payment (annuity) that repays a balance in some months
function annuity(balance, rate, months) {
	const r = rate / 1200;
	if (r === 0) return Math.ceil(balance / months);
	return Math.ceil((balance * r) / (1 - (1 + r) ** -months) / 100) * 100; // up to whole kroner, like the bank
}

// How many months a monthly payment needs to repay a balance
function monthsFor(balance, rate, payment) {
	const r = rate / 1200;
	if (r === 0) return Math.ceil(balance / payment);
	const x = 1 - (balance * r) / payment;
	return x <= 0 ? TERM : Math.max(1, Math.ceil(-Math.log(x) / Math.log(1 + r)));
}

const isEntered = (value) => value !== undefined && value !== null && value !== '' && value !== 'min';

// Works through every month from the first entry in data.payments until the loan, and any debt
// between the two, is repaid. Months without an entered payment count as paid at the minimum.
// Returns null until the apartment price and the first month are set. `today` ('YYYY-MM') is the
// month whose state the bar and the banner show; payments entered for later months count too.
export function compute(data, today = currentMonth(), { time = false } = {}) {
	const payments = data?.payments ?? {};
	const months = Object.keys(payments).sort();
	const total = toOre(data?.total ?? 0);
	if (!months.length || !(total > 0)) return null;

	const half = { cyan: Math.floor(total / 2), mint: total - Math.floor(total / 2) };
	const own = { ...half }; // each person's 50 % of the apartment's cost
	const debtRate = isEntered(data.debtRate) ? Number(data.debtRate) : DEBT_RATE;
	let fresh = 0; // debt created last month: free of interest if repaid in money this month (3.4.2)
	const equity = { cyan: toOre(data.egenkapital?.cyan ?? 0), mint: toOre(data.egenkapital?.mint ?? 0) };
	const end = { cyan: TERM - 1, mint: TERM - 1 }; // index of each person's last scheduled month
	const payment = { cyan: null, mint: null }; // each person's fixed monthly payment; null: work it out
	let debt = 0; // between the two: above 0, cyan owes mint; below 0, mint owes cyan
	const interestPaid = {}; // per year: the interest and fees each person paid, for the tax return
	const yearEnd = {}; // per year: what each person owes on 31 December, for the tax return's wealth part
	let rate = 0;
	let fee = 0;
	let term = TERM;

	const balance = (p) => Math.max(0, own[p] - equity[p]);

	// Costs are counted from their month on (earlier ones from the first month), as a record only
	const costs = [...(data.costs ?? [])].sort((a, b) => (a.month < b.month ? -1 : 1));
	let costsApplied = 0;
	const covered = { cyan: 0, mint: 0 }; // in total: above 0, paid for the other; below 0, paid by the other
	const costsPaid = { cyan: { maintenance: 0, improvement: 0 }, mint: { maintenance: 0, improvement: 0 } };
	function applyCosts(month) {
		for (; costsApplied < costs.length && !(costs[costsApplied].month > month); costsApplied++) {
			for (const p of PEOPLE) costsPaid[p][costs[costsApplied].kind] += toOre(costs[costsApplied][p] || 0);
		}
	}
	const lastEntered = months.filter((m) => PEOPLE.some((p) => isEntered(payments[m][p]))).pop();
	const until = lastEntered > today ? lastEntered : today;
	const snapshot = () => ({
		own: { ...own },
		equity: { ...equity },
		balance: { cyan: balance('cyan'), mint: balance('mint') },
		costs: { cyan: { ...costsPaid.cyan }, mint: { ...costsPaid.mint } },
		covered: { ...covered },
		debt
	});

	function loanMonth(k, month, entry, days) {
		const active = PEOPLE.filter((p) => balance(p) > 0);
		const people = {};

		for (const p of PEOPLE) {
			const b = balance(p);
			const i = active.indexOf(p);
			const feeShare = i < 0 ? 0 : i === 0 ? Math.ceil(fee / active.length) : Math.floor(fee / active.length);
			const interest = b ? interestFor(b, rate, days, yearDays(month)) : 0;
			const monthsLeft = Math.max(1, end[p] - k + 1);
			if (b && payment[p] === null) payment[p] = annuity(b, rate, monthsLeft);
			// The last payment settles whatever is left, so the part ends at exactly 0
			// A first month shorter than a whole one: the bank charges interest for the days only, and
			// takes the principal as if the month were whole, so the first payment is smaller
			const fewer = k === 0 && b ? interestFor(b, rate, monthDays(month), yearDays(month)) - interest : 0;
			const due = !b ? 0 : monthsLeft === 1 ? b + interest : Math.min(payment[p] - Math.max(0, fewer), b + interest);
			const min = due + feeShare;
			const typed = isEntered(entry[p]);
			const paid = typed ? toOre(entry[p]) : min;
			people[p] = {
				balance: b, // the part at the start of the month
				monthsLeft,
				min,
				paid,
				typed,
				due, // the bank's part of the minimum, without the fee
				feeDue: feeShare,
				interestDue: interest,
				principalDue: due - interest,
				short: Math.max(0, min - paid),
				extra: Math.max(0, paid - min),
				covered: 0, // below 0: covered by the other; above 0: covered for the other
				principal: 0,
				interest: 0,
				uncovered: 0,
				surplus: 0 // paid beyond everything this person owed: not applied anywhere
			};
		}

		// What one is short, the other's extra covers first
		for (const p of PEOPLE) {
			const s = people[p];
			const o = people[other(p)];
			const covered = Math.min(s.short, o.extra);
			if (!covered) continue;
			o.extra -= covered;
			s.covered = -covered;
			o.covered = covered;
		}

		let created = 0; // debt created this month, signed like `debt`
		for (const p of PEOPLE) {
			const s = people[p];
			const expected = balance(p) - s.principalDue; // where the part would be after the minimum
			// A covered amount counts as paid by the one it was paid for, in the usual order (3.4.1)
			let rest = s.paid - s.covered;
			const feePaid = Math.min(rest, s.feeDue);
			s.feePaid = feePaid;
			rest -= feePaid;
			s.interest = Math.min(rest, s.interestDue);
			rest -= s.interest;
			s.principal = Math.min(rest, balance(p));
			s.surplus = rest - s.principal;
			equity[p] += s.principal;

			// ...and becomes their personal debt to the one who paid it
			if (s.covered < 0) {
				covered[p] += s.covered;
				covered[other(p)] -= s.covered;
				created += (p === 'cyan' ? 1 : -1) * -s.covered;
			}
			s.uncovered = s.short + Math.min(0, s.covered);
			// Unpaid interest and fees are added to what this person owes the bank (3.5)
			equity[p] -= s.feeDue - feePaid + (s.interestDue - s.interest);

			// Off schedule: an extra either lowers the next payments (the default) or, with `time`, keeps
			// them and ends sooner; anything else (short and not covered) works the payment out again
			if (balance(p) > 0 && balance(p) !== expected) {
				if (s.extra > 0 && time) end[p] = Math.min(end[p], k + monthsFor(balance(p), rate, payment[p]));
				else payment[p] = null;
			}
		}

		// Interest counts in the year it built up (påløpt), as the tax return wants: a payment on
		// 1 January is December's, so it belongs to the year before. Fees are deductible as well.
		const year = addMonths(month, -1).slice(0, 4);
		const paid = (interestPaid[year] ??= { cyan: 0, mint: 0, estimate: false });
		for (const p of PEOPLE) {
			paid[p] += people[p].interest + people[p].feePaid;
			// Not entered yet, so counted at the minimum: the year's numbers are an estimate
			if (!people[p].typed && people[p].min > 0) paid.estimate = true;
		}

		debt += created;
		fresh = created;
		return { people };
	}

	function debtMonth(entry) {
		const debtor = debt > 0 ? 'cyan' : 'mint';
		const typed = isEntered(entry[debtor]);
		const paid = typed ? toOre(entry[debtor]) : 0;
		const repaid = Math.min(paid, Math.abs(debt));
		debt -= Math.sign(debt) * repaid;
		return { debtor, paid: typed ? paid : null, surplus: paid - repaid };
	}

	const rows = [];
	let state = snapshot();
	for (let k = 0, month = months[0]; k < LIMIT; k++, month = addMonths(month, 1)) {
		const entry = payments[month] ?? {};
		applyCosts(month);
		// Whether the rate or the fee differs from the month before (not in the first month)
		const rateChanged = k > 0 && isEntered(entry.interest) && Number(entry.interest) !== rate;
		const feeChanged = k > 0 && isEntered(entry.fee) && toOre(entry.fee) !== fee;
		if (isEntered(entry.interest) && Number(entry.interest) !== rate) {
			rate = Number(entry.interest);
			payment.cyan = payment.mint = null; // a new rate means new payments, same end
		}
		if (isEntered(entry.fee)) fee = toOre(entry.fee);
		if (isEntered(entry.term) && Number(entry.term) !== term) {
			term = Number(entry.term);
			end.cyan = end.mint = term - 1; // past the end already: the rest is due now
			payment.cyan = payment.mint = null;
		}
		const days = interestDays(month, k === 0 && data.takeover);
		const loan = balance('cyan') + balance('mint') > 0;
		if (!loan && (debt === 0 || month > until)) break;

		// The debt between the two bears forsinkelsesrente, compounding monthly (3.4.3). Last month's new
		// debt is free of it when repaid in full in money now, within 40 days of being paid (3.4.2).
		const owing = debt > 0 ? 'cyan' : debt < 0 ? 'mint' : null;
		const cash = (p) => (isEntered(entry.debt?.[p]) ? toOre(entry.debt[p]) : 0);
		const recent = Math.sign(fresh) === Math.sign(debt) ? Math.min(Math.abs(fresh), Math.abs(debt)) : 0;
		const free = owing && cash(owing) >= recent ? recent : 0;
		const debtInterest = interestFor(Math.abs(debt) - free, debtRate, days, yearDays(month));
		debt += Math.sign(debt) * debtInterest;
		fresh = 0;

		const debtRepaid = owing ? Math.min(cash(owing), Math.abs(debt)) : 0;
		debt -= Math.sign(debt) * debtRepaid;
		// What each typed beyond the debt they owed (all of it, for the one who owed nothing)
		const debtSurplus = { cyan: cash('cyan'), mint: cash('mint') };
		if (owing) debtSurplus[owing] -= debtRepaid;

		const row = {
			month,
			rate,
			rateChanged,
			feeChanged,
			debtRate,
			fee,
			days,
			yearDays: yearDays(month),
			loan,
			debtInterest,
			owing, // who owes the other at the start of the month, if anyone
			debtRepaid, // repaid in money this month
			debtSurplus, // per person, typed beyond the debt they owed: not applied anywhere
			...(loan ? loanMonth(k, month, entry, days) : debtMonth(entry))
		};
		row.debt = debt;
		rows.push(row);
		// After the December payment the balances stand until 1 January: they are the debt on 31 December
		if (month.endsWith('-12')) {
			yearEnd[month.slice(0, 4)] = { loan: { cyan: balance('cyan'), mint: balance('mint') }, debt };
		}
		if (month <= until) state = snapshot();
	}

	// Costs dated after the last row still count once their month has come
	if (costsApplied < costs.length) {
		applyCosts(until);
		state = snapshot();
	}

	return { half, rows, state, interestPaid, yearEnd };
}

// What each person gets if the apartment is sold or bought out (samboerkontrakt 4.2, 7.8 and 7.9),
// from compute()'s state, all in øre. Each gets half of the price less the costs of sale, less their
// own loan left (their Settlement Amount); the debt between the two is then set off against it.
export function saleSplit(state, price, costs) {
	const loanLeft = state.balance.cyan + state.balance.mint;
	const net = price - costs - loanLeft;
	const half = { cyan: Math.floor((price - costs) / 2) };
	half.mint = price - costs - half.cyan;
	const proceeds = { cyan: half.cyan - state.balance.cyan, mint: half.mint - state.balance.mint };
	// Above 0, cyan owes mint
	const settled = { cyan: -state.debt, mint: state.debt };
	const gets = { cyan: proceeds.cyan + settled.cyan, mint: proceeds.mint + settled.mint };
	return { loanLeft, net, half, proceeds, settled, gets };
}

// A month's instalment per person (samboerkontrakt 3.2), with the rate, fee or parts changed: what
// the calculator shows. Unchanged values give the row's own numbers. Amounts in øre.
export function instalmentFor(row, { balance, rate, fee }) {
	const active = PEOPLE.filter((p) => balance[p] > 0);
	const people = {};
	for (const p of PEOPLE) {
		const s = row.people[p];
		const b = balance[p];
		const i = active.indexOf(p);
		const feeShare = i < 0 ? 0 : i === 0 ? Math.ceil(fee / active.length) : Math.floor(fee / active.length);
		const same = b === s.balance && rate === row.rate;
		const interest = same ? s.interestDue : b ? interestFor(b, rate, row.days, row.yearDays) : 0;
		const payment = s.monthsLeft === 1 ? b + interest : Math.min(annuity(b, rate, s.monthsLeft), b + interest);
		const due = same ? s.due : b ? payment : 0;
		people[p] = { interest, principal: due - interest, fee: feeShare, total: due + feeShare };
	}
	return { people, total: people.cyan.total + people.mint.total };
}

// Each person's share of the bank interest paid in a year, in percent: what to enter in the
// skattemelding when splitting the joint loan's interest (rentefradrag). The year shown is the last
// finished one with payments, which is the one filed in spring; before that, the current year.
export function taxShares(result, today = currentMonth()) {
	const thisYear = Number(today.slice(0, 4));
	const years = Object.keys(result.interestPaid).map(Number);
	const year = years.includes(thisYear - 1) ? thisYear - 1 : years.includes(thisYear) ? thisYear : null;
	if (year === null) return null;
	const paid = result.interestPaid[year];
	const sum = paid.cyan + paid.mint;
	if (!sum) return null;
	return { year, cyan: (paid.cyan / sum) * 100, mint: (paid.mint / sum) * 100 };
}

// Changes one value in the data file. Empty values are removed, so the file only holds what was
// typed; `interest`, `fee` and `term` carry forward to the following months.
export function setValue(data, month, key, value, person) {
	const payments = (data.payments ??= {});
	const entry = { ...payments[month] };
	if (key === 'debt') {
		// Kept per person: the debt repaid in money
		const values = { ...entry.debt };
		if (value !== null) values[person] = value;
		else delete values[person];
		if (Object.keys(values).length) entry[key] = values;
		else delete entry[key];
	} else if (value === null) {
		delete entry[key];
	} else {
		entry[key] = value;
	}
	const first = Object.keys(payments).sort()[0];
	if (Object.keys(entry).length || month === first) payments[month] = entry;
	else delete payments[month];
}

// Payments must be amounts: an old "min" (paid at the minimum, whatever it was) is not valid and is
// removed, with the month itself when nothing else is left in it. Returns whether anything changed.
export function dropMin(data) {
	const payments = data?.payments ?? {};
	const first = Object.keys(payments).sort()[0];
	let dropped = false;
	for (const [month, entry] of Object.entries(payments)) {
		for (const p of PEOPLE) {
			if (entry[p] !== 'min') continue;
			delete entry[p];
			dropped = true;
		}
		if (!Object.keys(entry).length && month !== first) delete payments[month];
	}
	return dropped;
}

// "time" is a view option now, never saved: removes it from older files. Returns whether anything
// changed.
export function dropTime(data) {
	const payments = data?.payments ?? {};
	const first = Object.keys(payments).sort()[0];
	let dropped = false;
	for (const [month, entry] of Object.entries(payments)) {
		if (!entry.time) continue;
		delete entry.time;
		dropped = true;
		if (!Object.keys(entry).length && month !== first) delete payments[month];
	}
	return dropped;
}

// "12 345,50", "12.345,50" or "12345.5" → 12345.5; an empty field → null; anything else → undefined
export function parseAmount(text) {
	let clean = String(text).replace(/[\s\u00a0\u202f]/g, '');
	if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.'); // comma decimals, dots group
	if (clean === '') return null;
	const value = Number(clean);
	return Number.isFinite(value) && value >= 0 ? value : undefined;
}
