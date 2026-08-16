/* Run with: node random/mortgage-calculator/mortgage-calculator.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(`${__dirname}/mortgage-calculator.js`, 'utf8');
const context = { console, Math, Date, Intl, Number, String, Array, Map, Set, JSON, Error, crypto: globalThis.crypto };
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.calculator = MortgageCalculator;`, context);
const calculator = context.calculator;

function closeTo(actual, expected, tolerance = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

const loan = {
  principal: 200000,
  annualRate: 5,
  termYears: 25,
  firstPaymentMonth: '2024-01',
  statementBalance: null
};

assert.equal(calculator.calculateContractualPayment(120000, 0, 10), 1000);
closeTo(calculator.calculateContractualPayment(200000, 5, 25), 1169.18);

assert.equal(calculator.formatRateInput(5.625), '5.625');
assert.equal(calculator.formatRateInput(5.62), '5.62');
const baseline = calculator.calculateSchedule(loan, [], true);
assert.equal(baseline.error, '');
assert.equal(baseline.rows.length, 300);
assert.equal(baseline.rows.at(-1).endingBalance, 0);
closeTo(calculator.totals(baseline.rows).principal, loan.principal);

const monthlyPayment = calculator.calculateContractualPayment(loan.principal, loan.annualRate, loan.termYears);
function monthFor(index) {
  const date = new Date(Date.UTC(2024, index, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const recurringExtra = Array.from({ length: loan.termYears * 12 }, (_, index) => ({
  month: monthFor(index),
  regularPayment: monthlyPayment,
  extraPrincipal: index >= 36 ? 200 : 0
}));
const withExtra = calculator.calculateSchedule(loan, recurringExtra);
assert.equal(withExtra.error, '');
assert.ok(withExtra.rows.length < baseline.rows.length, 'future overpayments should reduce the payoff term');
closeTo(withExtra.rows[35].endingBalance, baseline.rows[35].endingBalance);
assert.ok(calculator.totals(withExtra.rows).interest < calculator.totals(baseline.rows).interest, 'future overpayments should reduce interest');

const oneTime = calculator.calculateSchedule(loan, [{ month: '2024-02', regularPayment: monthlyPayment, extraPrincipal: 5000 }]);

const recurringFromOrigin = calculator.calculateSchedule(loan, [], false, { amount: 200, start: 'origin' });
assert.equal(recurringFromOrigin.error, '');
assert.equal(recurringFromOrigin.rows[0].recurringExtraPrincipal, 200);
assert.ok(recurringFromOrigin.rows.length < baseline.rows.length, 'recurring extras from origination should reduce the payoff term');

assert.equal(calculator.recurringExtraForMonth({ amount: 75, start: 'next' }, '2026-08', '2026-08'), 0);
assert.equal(calculator.recurringExtraForMonth({ amount: 75, start: 'next' }, '2026-09', '2026-08'), 75);

const recurringAndOneTime = calculator.calculateSchedule(loan, [{ month: '2024-01', regularPayment: monthlyPayment, extraPrincipal: 100 }], false, { amount: 200, start: 'origin' });
assert.equal(recurringAndOneTime.rows[0].extraPrincipal, 300);
assert.equal(recurringAndOneTime.rows[0].oneTimeExtraPrincipal, 100);
assert.equal(oneTime.error, '');
assert.equal(oneTime.rows[0].extraPrincipal, 0);
assert.equal(oneTime.rows[1].extraPrincipal, 5000);

const invalidPayment = calculator.calculateSchedule(loan, [{ month: '2024-01', regularPayment: 100, extraPrincipal: 0 }]);
assert.match(invalidPayment.error, /does not cover/);

const restoredScenario = calculator.normalizeScenario({
  id: 'persisted-scenario',
  name: 'Persisted',
  loan,
  payments: []
}, true);
assert.equal(restoredScenario.id, 'persisted-scenario');


assert.throws(() => calculator.normalizeScenario({
  name: 'Duplicate month',
  loan,
  payments: [
    { month: '2024-01', regularPayment: monthlyPayment, extraPrincipal: 0 },
    { month: '2024-01', regularPayment: monthlyPayment, extraPrincipal: 0 }
  ]
}), /more than once/);

assert.equal(calculator.isValidMonth('2024-01'), true);
assert.equal(calculator.isValidMonth('2024-00'), false);
assert.equal(calculator.isValidMonth('2024-13'), false);
assert.throws(() => calculator.normalizeScenario({
  name: 'Invalid first month',
  loan: { ...loan, firstPaymentMonth: '2024-13' },
  payments: []
}), /invalid loan details/);
assert.throws(() => calculator.normalizeScenario({
  name: 'Invalid payment month',
  loan,
  payments: [{ month: '2024-13', regularPayment: monthlyPayment, extraPrincipal: 0 }]
}), /invalid month/);
assert.match(calculator.validateLoan({ ...loan, termYears: 1.5 }), /whole years/);
assert.match(calculator.validateLoan({ ...loan, statementBalance: -1 }), /cannot be negative/);

const zeroPaymentLoan = { principal: 1200, annualRate: 0, termYears: 1, firstPaymentMonth: '2026-01', statementBalance: null };
const zeroPayments = Array.from({ length: 12 }, (_, index) => ({
  month: `2026-${String(index + 1).padStart(2, '0')}`,
  regularPayment: 0,
  extraPrincipal: 0,
  isRegularOverride: true
}));
const unpayablePlan = calculator.calculateSchedule(zeroPaymentLoan, zeroPayments);
assert.match(unpayablePlan.error, /do not pay off/);
assert.equal(unpayablePlan.rows.at(-1).totalPayment, 0);


const realisticLoan = { principal: 500000, annualRate: 7.125, termYears: 30, firstPaymentMonth: '2024-01', statementBalance: null };
const realisticSchedule = calculator.calculateSchedule(realisticLoan, [], true);
assert.equal(realisticSchedule.error, '');
assert.equal(realisticSchedule.rows.length, 360);
assert.equal(realisticSchedule.rows.at(-1).endingBalance, 0);
assert.ok(realisticSchedule.rows.at(-1).regularPaid > realisticSchedule.rows.at(-1).regularPayment);

const unmarkedZeroPayments = zeroPayments.map(({ isRegularOverride, ...payment }) => payment);
assert.match(calculator.calculateSchedule(zeroPaymentLoan, unmarkedZeroPayments).error, /do not pay off/);
console.log('Mortgage calculator tests passed.');
