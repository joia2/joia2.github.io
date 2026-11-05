// Loan math for joia2. Two people own an apartment 50/50 and share one bank loan, paid on the 1st
// of every month. The data file holds kroner; everything here works in øre (whole numbers), so
// amounts round the way the bank's do.
//
// Each person has their own internal part of the loan: their half of the apartment minus their
// egenkapital. Like the bank's, each person's monthly payment stays fixed; interest for the actual
// days of the month only changes how much of it is principal. The payment is worked out again every
// January, when the rate changes, or when a month's payment differs from it (extra, or short and not
// covered).
//
// When one pays less than their minimum and the other covers it, the covered amount moves
// ownership to the one who covered: first as the unpaid principal, then (for covered interest
// and fees) from the paid-in equity of the one who fell short. Once that equity is used up, the
// rest becomes a personal debt with the bank's interest, repaid from the debtor's later principal
// or in money (`debt: { cyan, mint }` in a month's entry).
//
// Maintenance and improvement costs (data.costs) raise the apartment's value: from their month on,
// what each person paid for them is added to what that person owns.

export const PEOPLE = ['cyan', 'mint'];
export const TERM = 360; // 30 years
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

// A payment on the 1st settles the interest for every day of the month before; the first one only
// from the take-over day ('YYYY-MM-DD'), when the loan was paid out
function interestDays(month, from) {
	const [y, m] = month.split('-').map(Number);
	const days = from ? Math.round((Date.UTC(y, m - 1, 1) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) : 0;
	return days > 0 ? days : new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
}

// Interest on an amount for some days, at a yearly rate in percent
const interestFor = (amount, rate, days) => Math.round((amount * rate * days) / 36500);

// The bank's monthly payment (annuity) that repays a balance in some months
function annuity(balance, rate, months) {
	const r = rate / 1200;
	if (r === 0) return Math.ceil(balance / months);
	return Math.round((balance * r) / (1 - (1 + r) ** -months));
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
export function compute(data, today = currentMonth()) {
	const payments = data?.payments ?? {};
	const months = Object.keys(payments).sort();
	const total = toOre(data?.total ?? 0);
	if (!months.length || !(total > 0)) return null;

	const half = { cyan: Math.floor(total / 2), mint: total - Math.floor(total / 2) };
	const own = { ...half }; // each person's share of the apartment
	const equity = { cyan: toOre(data.egenkapital?.cyan ?? 0), mint: toOre(data.egenkapital?.mint ?? 0) };
	const end = { cyan: TERM - 1, mint: TERM - 1 }; // index of each person's last scheduled month
	const payment = { cyan: null, mint: null }; // each person's fixed monthly payment; null: work it out
	let debt = 0; // between the two: above 0, cyan owes mint; below 0, mint owes cyan
	const interestPaid = {}; // per year: the interest and fees each person paid, for the tax return
	const yearEnd = {}; // per year: what each person owes on 31 December, for the tax return's wealth part
	let rate = 0;
	let fee = 0;

	const balance = (p) => Math.max(0, own[p] - equity[p]);

	// Costs paid in cash count as owned, from their month on (earlier ones from the first month)
	const costs = [...(data.costs ?? [])].sort((a, b) => (a.month < b.month ? -1 : 1));
	let costsApplied = 0;
	const covered = { cyan: 0, mint: 0 }; // paid-in money moved between the two by covering
	const costsPaid = { cyan: { maintenance: 0, improvement: 0 }, mint: { maintenance: 0, improvement: 0 } };
	function applyCosts(month) {
		for (; costsApplied < costs.length && !(costs[costsApplied].month > month); costsApplied++) {
			for (const p of PEOPLE) {
				const paid = toOre(costs[costsApplied][p] || 0);
				own[p] += paid;
				equity[p] += paid;
				costsPaid[p][costs[costsApplied].kind] += paid;
			}
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

	// Moves `amount` of ownership from one person to the other, paid in as the receiver's equity.
	// `fromEquity` says whether it also leaves the giver's equity (paid-in money changing hands)
	// or only their share (principal the receiver paid on the giver's behalf).
	function transfer(from, amount, fromEquity) {
		if (amount <= 0) return;
		own[from] -= amount;
		if (fromEquity) equity[from] -= amount;
		covered[from] -= amount;
		own[other(from)] += amount;
		equity[other(from)] += amount;
		covered[other(from)] += amount;
	}

	function loanMonth(k, month, entry, days) {
		const active = PEOPLE.filter((p) => balance(p) > 0);
		const people = {};

		for (const p of PEOPLE) {
			const b = balance(p);
			const i = active.indexOf(p);
			const feeShare = i < 0 ? 0 : i === 0 ? Math.ceil(fee / active.length) : Math.floor(fee / active.length);
			const interest = b ? interestFor(b, rate, days) : 0;
			const monthsLeft = Math.max(1, end[p] - k + 1);
			if (b && payment[p] === null) payment[p] = annuity(b, rate, monthsLeft);
			// The last payment settles whatever is left, so the part ends at exactly 0
			const due = !b ? 0 : monthsLeft === 1 ? b + interest : Math.min(payment[p], b + interest);
			const min = due + feeShare;
			const typed = isEntered(entry[p]);
			const paid = typed ? toOre(entry[p]) : min;
			people[p] = {
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
				surplus: 0, // paid beyond everything this person owed: not applied anywhere
				monthsSaved: 0, // months an extra takes off the end when the payments are kept
				time: Boolean(entry.time?.[p])
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

		for (const p of PEOPLE) {
			const s = people[p];
			const expected = balance(p) - s.principalDue; // where the part would be after the minimum
			let rest = s.paid - Math.max(0, s.covered); // what this person paid for their own part
			const feePaid = Math.min(rest, s.feeDue);
			s.feePaid = feePaid;
			rest -= feePaid;
			s.interest = Math.min(rest, s.interestDue);
			rest -= s.interest;
			s.principal = Math.min(rest, balance(p));
			s.surplus = rest - s.principal;

			// A debtor's principal goes to the other person until the debt is repaid
			const debtor = debt > 0 ? 'cyan' : debt < 0 ? 'mint' : null;
			const repaid = p === debtor ? Math.min(s.principal, Math.abs(debt)) : 0;
			debt -= Math.sign(debt) * repaid;
			equity[p] += s.principal;
			transfer(p, repaid, true); // paid by the debtor, owned by the other

			const feeLeft = s.feeDue - feePaid;
			let costLeft = feeLeft + (s.interestDue - s.interest);
			if (s.covered < 0) {
				let covered = -s.covered;
				// First as this month's unpaid principal...
				const asPrincipal = Math.min(covered, Math.max(0, s.principalDue - s.principal), balance(p));
				transfer(p, asPrincipal, false);
				covered -= asPrincipal;
				// ...then the covered interest and fee are taken from paid-in equity, and beyond that owed
				const asCost = Math.min(covered, costLeft);
				people[other(p)].costCovered = asCost; // interest and fee the coverer paid for the other
				const fromEquity = Math.min(asCost, Math.max(0, equity[p]));
				transfer(p, fromEquity, true);
				debt += (p === 'cyan' ? 1 : -1) * (asCost - fromEquity);
				costLeft -= asCost;
			}
			s.uncovered = s.short + Math.min(0, s.covered);
			equity[p] -= costLeft; // unpaid interest and fees are added to what this person owes

			// Off schedule: an extra either lowers the next payments (the default) or keeps them and ends
			// sooner; anything else (short and not covered) works the payment out again
			if (balance(p) > 0 && balance(p) !== expected) {
				// How many months the extra takes off the end if the payments are kept: shown either way
				const sooner = k + monthsFor(balance(p), rate, payment[p]);
				if (s.extra > 0) s.monthsSaved = Math.max(0, end[p] - sooner);
				if (s.extra > 0 && s.time) end[p] = sooner;
				else payment[p] = null;
			}
		}

		// Interest counts in the year it built up (påløpt), as the tax return wants: a payment on
		// 1 January is December's, so it belongs to the year before. Fees are deductible as well.
		const year = addMonths(month, -1).slice(0, 4);
		const paid = (interestPaid[year] ??= { cyan: 0, mint: 0, estimate: false });
		for (const p of PEOPLE) {
			paid[p] += people[p].interest + people[p].feePaid + (people[p].costCovered ?? 0);
			// Not entered yet, so counted at the minimum: the year's numbers are an estimate
			if (!people[p].typed && people[p].min > 0) paid.estimate = true;
		}

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
		if (isEntered(entry.interest) && Number(entry.interest) !== rate) {
			rate = Number(entry.interest);
			payment.cyan = payment.mint = null; // a new rate means new payments, same end
		}
		if (isEntered(entry.fee)) fee = toOre(entry.fee);
		// Like the bank, the payments are worked out again every January (same end), so the small
		// differences from months of uneven length don't pile up on the last payment
		if (k > 0 && month.endsWith('-01')) payment.cyan = payment.mint = null;
		const days = interestDays(month, k === 0 && data.takeover);
		const loan = balance('cyan') + balance('mint') > 0;
		if (!loan && (debt === 0 || month > until)) break;

		// The debt between the two grows with the bank's interest, compounding monthly
		const debtInterest = interestFor(Math.abs(debt), rate, days);
		debt += Math.sign(debt) * debtInterest;

		// The debtor may also repay the debt in money, outside the loan (samboerkontrakt 3.4.5): it
		// lowers the debt only, and moves no ownership
		const owing = debt > 0 ? 'cyan' : debt < 0 ? 'mint' : null;
		const cash = (p) => (isEntered(entry.debt?.[p]) ? toOre(entry.debt[p]) : 0);
		const debtRepaid = owing ? Math.min(cash(owing), Math.abs(debt)) : 0;
		debt -= Math.sign(debt) * debtRepaid;
		// What each typed beyond the debt they owed (all of it, for the one who owed nothing)
		const debtSurplus = { cyan: cash('cyan'), mint: cash('mint') };
		if (owing) debtSurplus[owing] -= debtRepaid;

		const row = {
			month,
			rate,
			fee,
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

// What each person gets if the apartment is sold (samboerkontrakt 7.8 and 7.9), from compute()'s
// state, all in øre. The net proceeds (sale price less costs of sale and the loan left) are divided by
// ownership share: what each has paid in, of what both have. A loss is borne in proportion to each
// person's loan left. The debt between the two is then settled from the proceeds.
export function saleSplit(state, price, costs) {
	const loanLeft = state.balance.cyan + state.balance.mint;
	const net = price - costs - loanLeft;
	const paid = { cyan: Math.max(0, state.equity.cyan), mint: Math.max(0, state.equity.mint) };
	const both = paid.cyan + paid.mint;
	const share = both ? { cyan: paid.cyan / both, mint: paid.mint / both } : { cyan: 0.5, mint: 0.5 };
	// A gain by ownership share; a loss by loan left
	const weight = net >= 0 || !loanLeft ? share.cyan : state.balance.cyan / loanLeft;
	const proceeds = { cyan: Math.round(net * weight) };
	proceeds.mint = net - proceeds.cyan;
	// Above 0, cyan owes mint
	const settled = { cyan: -state.debt, mint: state.debt };
	const gets = { cyan: proceeds.cyan + settled.cyan, mint: proceeds.mint + settled.mint };
	return { loanLeft, net, share, proceeds, settled, gets };
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
// typed; `interest` and `fee` carry forward to the following months.
export function setValue(data, month, key, value, person) {
	const payments = (data.payments ??= {});
	const entry = { ...payments[month] };
	if (key === 'time' || key === 'debt') {
		// Kept per person: `time` as true, `debt` (repaid in money) as an amount
		const values = { ...entry[key] };
		if (key === 'time' ? value : value !== null) values[person] = key === 'time' ? true : value;
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
			if (entry.time) delete entry.time[p];
			dropped = true;
		}
		if (entry.time && !Object.keys(entry.time).length) delete entry.time;
		if (!Object.keys(entry).length && month !== first) delete payments[month];
	}
	return dropped;
}

// A "time" choice only means something while that month shows the −pay/−time toggle: a typed
// payment with an extra that goes into the loan. Removes the others. Returns whether anything changed.
export function dropStaleTime(data, result = compute(data)) {
	const rows = new Map((result?.rows ?? []).map((r) => [r.month, r]));
	let dropped = false;
	for (const [month, entry] of Object.entries(data?.payments ?? {})) {
		for (const p of Object.keys(entry.time ?? {})) {
			const s = rows.get(month)?.people?.[p];
			if (s && s.typed && s.extra > s.surplus) continue;
			setValue(data, month, 'time', false, p);
			dropped = true;
		}
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
