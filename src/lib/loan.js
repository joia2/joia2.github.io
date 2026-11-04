// Loan math for joia2. Two people own an apartment 50/50 and share one bank loan, paid on the 1st
// of every month. The data file holds kroner; everything here works in øre (whole numbers), so
// amounts round the way the bank's do.
//
// Each person has their own internal part of the loan: their half of the apartment minus their
// egenkapital. Their payments pay that part down, with interest on it for the actual days of the
// month. When one pays less than their minimum and the other covers it, the covered amount moves
// ownership to the one who covered: first as the unpaid principal, then (for covered interest
// and fees) from the paid-in equity of the one who fell short. Once that equity is used up, the
// rest becomes a personal debt with the bank's interest, repaid from the debtor's later principal.

export const PEOPLE = ['cyan', 'mint'];
export const TERM = 360; // 30 years
const LIMIT = TERM + 1200; // stops a debt that is never repaid from producing rows forever

export const other = (person) => (person === 'cyan' ? 'mint' : 'cyan');
export const toOre = (kr) => Math.round(Number(kr) * 100);

const amountFormat = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
export const formatKr = (ore) => amountFormat.format(Math.round(ore / 100));

export function addMonths(month, n) {
	const [y, m] = month.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1 + n, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonth(date = new Date()) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// A payment on the 1st settles the interest for every day of the month before
function interestDays(month) {
	const [y, m] = month.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
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

const isEntered = (value) => value !== undefined && value !== null && value !== '';

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
	let debt = 0; // between the two: above 0, cyan owes mint; below 0, mint owes cyan
	let rate = 0;
	let fee = 0;

	const balance = (p) => Math.max(0, own[p] - equity[p]);
	const lastEntered = months.filter((m) => PEOPLE.some((p) => isEntered(payments[m][p]))).pop();
	const until = lastEntered > today ? lastEntered : today;
	const snapshot = () => ({
		own: { ...own },
		equity: { ...equity },
		balance: { cyan: balance('cyan'), mint: balance('mint') },
		debt
	});

	// Moves `amount` of ownership from one person to the other, paid in as the receiver's equity.
	// `fromEquity` says whether it also leaves the giver's equity (paid-in money changing hands)
	// or only their share (principal the receiver paid on the giver's behalf).
	function transfer(from, amount, fromEquity) {
		if (amount <= 0) return;
		own[from] -= amount;
		if (fromEquity) equity[from] -= amount;
		own[other(from)] += amount;
		equity[other(from)] += amount;
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
			const due = !b ? 0 : monthsLeft === 1 ? b + interest : Math.min(annuity(b, rate, monthsLeft), b + interest);
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
				surplus: 0,
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
			let rest = s.paid - Math.max(0, s.covered); // what this person paid for their own part
			const feePaid = Math.min(rest, s.feeDue);
			rest -= feePaid;
			s.interest = Math.min(rest, s.interestDue);
			rest -= s.interest;
			s.principal = Math.min(rest, balance(p));
			s.surplus = rest - s.principal;

			// A debtor's principal goes to the other person until the debt is repaid
			const debtor = debt > 0 ? 'cyan' : debt < 0 ? 'mint' : null;
			const repaid = p === debtor ? Math.min(s.principal, Math.abs(debt)) : 0;
			debt -= Math.sign(debt) * repaid;
			transfer(p, repaid, false);
			equity[p] += s.principal - repaid;

			let costLeft = s.feeDue - feePaid + (s.interestDue - s.interest);
			if (s.covered < 0) {
				let covered = -s.covered;
				// First as this month's unpaid principal...
				const asPrincipal = Math.min(covered, Math.max(0, s.principalDue - s.principal), balance(p));
				transfer(p, asPrincipal, false);
				covered -= asPrincipal;
				// ...then the covered interest and fee are taken from paid-in equity, and beyond that owed
				const asCost = Math.min(covered, costLeft);
				const fromEquity = Math.min(asCost, Math.max(0, equity[p]));
				transfer(p, fromEquity, true);
				debt += (p === 'cyan' ? 1 : -1) * (asCost - fromEquity);
				costLeft -= asCost;
			}
			s.uncovered = s.short + Math.min(0, s.covered);
			equity[p] -= costLeft; // unpaid interest and fees are added to what this person owes

			// Extra paid either lowers the next payments (the default) or keeps them and ends sooner
			if (s.extra > 0 && s.time && balance(p) > 0) end[p] = k + monthsFor(balance(p), rate, s.due);
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
		if (isEntered(entry.interest)) rate = Number(entry.interest);
		if (isEntered(entry.fee)) fee = toOre(entry.fee);
		const days = interestDays(month);
		const loan = balance('cyan') + balance('mint') > 0;
		if (!loan && (debt === 0 || month > until)) break;

		// The debt between the two grows with the bank's interest, compounding monthly
		const debtInterest = interestFor(Math.abs(debt), rate, days);
		debt += Math.sign(debt) * debtInterest;

		const row = {
			month,
			rate,
			fee,
			rateSet: isEntered(entry.interest),
			feeSet: isEntered(entry.fee),
			loan,
			debtInterest,
			...(loan ? loanMonth(k, month, entry, days) : debtMonth(entry))
		};
		row.debt = debt;
		rows.push(row);
		if (month <= until) state = snapshot();
	}

	return { half, rows, state };
}

// Changes one value in the data file. Empty values are removed, so the file only holds what was
// typed; `interest` and `fee` carry forward to the following months.
export function setValue(data, month, key, value, person) {
	const payments = (data.payments ??= {});
	const entry = { ...payments[month] };
	if (key === 'time') {
		const time = { ...entry.time };
		if (value) time[person] = true;
		else delete time[person];
		if (Object.keys(time).length) entry.time = time;
		else delete entry.time;
	} else if (value === null) {
		delete entry[key];
	} else {
		entry[key] = value;
	}
	const first = Object.keys(payments).sort()[0];
	if (Object.keys(entry).length || month === first) payments[month] = entry;
	else delete payments[month];
}

// "12 345,50" or "12345.5" → 12345.5; an empty field → null; anything else → undefined
export function parseAmount(text) {
	const clean = String(text).replace(/[\s ]/g, '').replace(',', '.');
	if (clean === '') return null;
	const value = Number(clean);
	return Number.isFinite(value) && value >= 0 ? value : undefined;
}
