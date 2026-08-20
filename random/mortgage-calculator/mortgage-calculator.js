const MortgageCalculator = (() => {
  'use strict';

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = 'mortgage-calculator:v1';
  const THEME_KEY = 'mortgage-calculator:theme';
  const CURRENCY = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  const YEAR_FORMAT = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });
  let state;
  let storageAvailable = false;
  let saveTimer;
  let scheduleTimer;
  let showAllSchedule = false;
  let storageWriteBlocked = false;
  let storageRecoveryNotice = '';

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthDate(month) {
    const [year, value] = String(month).split('-').map(Number);
    return new Date(Date.UTC(year, value - 1, 1));
  }

  function formatMonth(month) {
    return MONTH_FORMAT.format(monthDate(month));
  }

  function addMonths(month, amount) {
    const date = monthDate(month);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function monthsBetween(first, second) {
    const firstDate = monthDate(first);
    const secondDate = monthDate(second);
    return (secondDate.getUTCFullYear() - firstDate.getUTCFullYear()) * 12 + secondDate.getUTCMonth() - firstDate.getUTCMonth();
  }

  function isValidMonth(value) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    return Number.isInteger(year) && year >= 1 && Number.isInteger(month) && month >= 1 && month <= 12;
  }

  function asNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function money(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    return Number.isFinite(value) ? CURRENCY.format(value) : '—';
  }

  function formatNumberInput(value) {
    return Number.isFinite(value) ? String(money(value)) : '';
  }


  function formatRateInput(value) {
    if (!Number.isFinite(value)) return '';
    return String(Math.round((value + Number.EPSILON) * 1000) / 1000);
  }
  function uniqueId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function defaultLoan() {
    return {
      principal: 200000,
      annualRate: 5,
      termYears: 25,
      firstPaymentMonth: currentMonth(),
      statementBalance: null
    };
  }

  function normalizeRecurringExtra(value) {
    const amount = asNumber(value && value.amount);
    return {
      amount: amount === null ? 0 : Math.max(0, amount),
      start: value && value.start === 'origin' ? 'origin' : 'projected'
    };
  }

  function recurringExtraForMonth(recurringExtra, month, referenceMonth = currentMonth()) {
    const recurring = normalizeRecurringExtra(recurringExtra);
    if (recurring.amount === 0) return 0;
    return recurring.start === 'origin' || month >= referenceMonth ? recurring.amount : 0;
  }

  function defaultScenario(name = 'My mortgage') {
    const scenario = {
      id: uniqueId(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loan: defaultLoan(),
      recurringExtra: normalizeRecurringExtra(),
      payments: []
    };
    ensurePaymentSchedule(scenario);
    return scenario;
  }

  function hasValidLoan(loan) {
    return Number.isFinite(loan.principal) && loan.principal > 0 &&
      Number.isFinite(loan.annualRate) && loan.annualRate >= 0 && loan.annualRate <= 100 &&
      Number.isInteger(loan.termYears) && loan.termYears >= 1 && loan.termYears <= 50 &&
      isValidMonth(loan.firstPaymentMonth) &&
      (loan.statementBalance === null || (Number.isFinite(loan.statementBalance) && loan.statementBalance >= 0));
  }

  function validateLoan(loan) {
    if (!Number.isFinite(loan.principal) || loan.principal <= 0) return 'Enter an original principal greater than zero.';
    if (!Number.isFinite(loan.annualRate) || loan.annualRate < 0 || loan.annualRate > 100) return 'Enter an annual interest rate from 0% through 100%.';
    if (!Number.isInteger(loan.termYears) || loan.termYears < 1 || loan.termYears > 50) return 'Enter an original term from 1 through 50 whole years.';
    if (!isValidMonth(loan.firstPaymentMonth)) return 'Choose a valid first payment month.';
    if (loan.statementBalance !== null && (!Number.isFinite(loan.statementBalance) || loan.statementBalance < 0)) return 'Statement balance cannot be negative.';
    return '';
  }

  function calculateContractualPayment(principal, annualRate, termYears) {
    const months = termYears * 12;
    const monthlyRate = annualRate / 1200;
    if (monthlyRate === 0) return money(principal / months);
    return money(principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
  }

  function ensurePaymentSchedule(scenario) {
    if (!hasValidLoan(scenario.loan)) {
      scenario.payments = Array.isArray(scenario.payments) ? scenario.payments : [];
      return;
    }

    const contractualPayment = calculateContractualPayment(scenario.loan.principal, scenario.loan.annualRate, scenario.loan.termYears);
    const existing = new Map((scenario.payments || []).map((payment) => [payment.month, payment]));
    const paymentCount = scenario.loan.termYears * 12;
    scenario.payments = Array.from({ length: paymentCount }, (_, index) => {
      const month = addMonths(scenario.loan.firstPaymentMonth, index);
      const old = existing.get(month);
      const extraPrincipal = asNumber(old && old.extraPrincipal) || 0;
      const isRegularOverride = Boolean(old && old.isRegularOverride);
      return {
        month,
        regularPayment: isRegularOverride ? Math.max(0, asNumber(old.regularPayment) || 0) : contractualPayment,
        isRegularOverride,
        extraPrincipal
      };
    });
  }

  function calculateSchedule(loan, payments, baseline = false, recurringExtra = {}) {
    const loanError = validateLoan(loan);
    if (loanError) return { rows: [], error: loanError, contractualPayment: null };

    const contractualPayment = calculateContractualPayment(loan.principal, loan.annualRate, loan.termYears);
    const monthlyRate = loan.annualRate / 1200;
    const limit = loan.termYears * 12;
    const records = new Map((payments || []).map((payment) => [payment.month, payment]));
    const rows = [];
    let balance = money(loan.principal);

    for (let index = 0; index < limit && balance > 0; index += 1) {
      const month = addMonths(loan.firstPaymentMonth, index);
      const record = records.get(month) || {};
      const configuredRegular = baseline ? contractualPayment : asNumber(record.regularPayment);
      const regularPayment = configuredRegular === null ? contractualPayment : Math.max(0, configuredRegular);
      const configuredExtra = baseline ? 0 : asNumber(record.extraPrincipal);
      const extraAdjustment = configuredExtra === null ? 0 : configuredExtra;
      const recurringExtraPrincipal = baseline ? 0 : recurringExtraForMonth(recurringExtra, month);
      const oneTimeExtraPrincipal = Math.max(0, extraAdjustment);
      const extraPrincipal = money(Math.max(0, extraAdjustment + recurringExtraPrincipal));
      const openingBalance = balance;
      const interest = money(openingBalance * monthlyRate);
      const requestedTotal = money(regularPayment + extraPrincipal);

      if (requestedTotal + 0.005 < interest) {
        return {
          rows,
          error: `The payment for ${formatMonth(month)} (${formatMoney(requestedTotal)}) does not cover that month's accrued interest (${formatMoney(interest)}).`,
          contractualPayment
        };
      }

      const amountDue = money(openingBalance + interest);
      const finalRoundingDifference = money(amountDue - requestedTotal);
      const usesContractualPayment = baseline ||
        (!record.isRegularOverride && Math.abs(regularPayment - contractualPayment) < 0.005);
      const canCorrectFinalRounding = index === limit - 1 &&
        finalRoundingDifference > 0 && usesContractualPayment;
      let regularPaid;
      let extraPaid;
      if (canCorrectFinalRounding) {
        // Monthly cent rounding can leave a residual in the final contractual
        // period. Adjust that final contractual payment, but never replace an
        // explicitly overridden or non-contractual payment with a balloon.
        extraPaid = money(Math.min(extraPrincipal, amountDue));
        regularPaid = money(amountDue - extraPaid);
      } else {
        regularPaid = money(Math.min(regularPayment, amountDue));
        extraPaid = money(Math.min(extraPrincipal, Math.max(0, amountDue - regularPaid)));
      }
      const totalPayment = money(regularPaid + extraPaid);
      const recurringExtraPaid = money(Math.min(recurringExtraPrincipal, extraPaid));
      const oneTimeExtraPaid = money(Math.min(oneTimeExtraPrincipal, Math.max(0, extraPaid - recurringExtraPaid)));
      const principalPaid = money(Math.max(0, totalPayment - interest));
      balance = money(Math.max(0, openingBalance - principalPaid));

      rows.push({
        month,
        index,
        status: month < currentMonth() ? 'actual' : 'projected',
        openingBalance,
        regularPayment,
        regularPaid,
        extraPrincipal: extraPaid,
        recurringExtraPrincipal: recurringExtraPaid,
        oneTimeExtraPrincipal: oneTimeExtraPaid,
        requestedExtraPrincipal: extraPrincipal,
        totalPayment,
        interest,
        principalPaid,
        endingBalance: balance,
        isRegularOverride: baseline ? false : Boolean(record.isRegularOverride)
      });
    }

    if (balance > 0) {
      return {
        rows,
        error: 'The entered payments do not pay off the loan within the original term. Increase a future payment or extend the original term.',
        contractualPayment
      };
    }

    return { rows, error: '', contractualPayment };
  }

  function totals(rows) {
    return rows.reduce((summary, row) => ({
      totalPaid: money(summary.totalPaid + row.totalPayment),
      interest: money(summary.interest + row.interest),
      principal: money(summary.principal + row.principalPaid),
      extraPrincipal: money(summary.extraPrincipal + row.extraPrincipal)
    }), { totalPaid: 0, interest: 0, principal: 0, extraPrincipal: 0 });
  }

  function annualSummary(rows) {
    const byYear = new Map();
    rows.forEach((row) => {
      const year = YEAR_FORMAT.format(monthDate(row.month));
      const existing = byYear.get(year) || {
        year,
        statuses: new Set(),
        beginningBalance: row.openingBalance,
        regularPaid: 0,
        interest: 0,
        principal: 0,
        extraPrincipal: 0,
        endingBalance: row.endingBalance
      };
      existing.statuses.add(row.status);
      existing.regularPaid = money(existing.regularPaid + row.regularPaid);
      existing.interest = money(existing.interest + row.interest);
      existing.principal = money(existing.principal + row.principalPaid);
      existing.extraPrincipal = money(existing.extraPrincipal + row.extraPrincipal);
      existing.endingBalance = row.endingBalance;
      byYear.set(year, existing);
    });
    return [...byYear.values()].map((year) => ({
      ...year,
      status: year.statuses.size > 1 ? 'Mixed' : (year.statuses.has('actual') ? 'Actual' : 'Projected')
    }));
  }

  function getSelectedScenario() {
    return state.scenarios.find((scenario) => scenario.id === state.selectedScenarioId) || state.scenarios[0];
  }

  function normalizeLoan(value) {
    if (!value || typeof value !== 'object') throw new Error('The imported scenario does not include loan details.');
    const loan = {
      principal: asNumber(value.principal),
      annualRate: asNumber(value.annualRate),
      termYears: asNumber(value.termYears),
      firstPaymentMonth: typeof value.firstPaymentMonth === 'string' ? value.firstPaymentMonth : '',
      statementBalance: value.statementBalance === '' || value.statementBalance === null || value.statementBalance === undefined ? null : asNumber(value.statementBalance)
    };
    if (!hasValidLoan(loan)) throw new Error('The imported scenario contains invalid loan details.');
    if (loan.statementBalance !== null && loan.statementBalance < 0) throw new Error('The imported statement balance cannot be negative.');
    return loan;
  }

  function normalizeScenario(value, preserveId = false) {
    if (!value || typeof value !== 'object') throw new Error('The imported data is not a scenario.');
    const loan = normalizeLoan(value.loan);
    const payments = Array.isArray(value.payments) ? value.payments : [];
    const seenMonths = new Set();
    const scenario = {
      id: preserveId && typeof value.id === 'string' && value.id ? value.id : uniqueId(),
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 80) : 'Imported mortgage',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      loan,
      recurringExtra: normalizeRecurringExtra(value.recurringExtra),
      payments: payments.map((payment) => {
        if (!payment || typeof payment !== 'object' || !isValidMonth(payment.month)) throw new Error('The imported schedule contains an invalid month.');
        if (seenMonths.has(payment.month)) throw new Error('The imported schedule contains the same month more than once.');
        seenMonths.add(payment.month);
        const regularPayment = asNumber(payment.regularPayment);
        const extraPrincipal = asNumber(payment.extraPrincipal);
        if (regularPayment !== null && regularPayment < 0) throw new Error('The imported schedule contains a negative payment.');
        return {
          month: payment.month,
          regularPayment: regularPayment === null ? 0 : regularPayment,
          isRegularOverride: Boolean(payment.isRegularOverride),
          extraPrincipal: extraPrincipal === null ? 0 : extraPrincipal
        };
      })
    };
    ensurePaymentSchedule(scenario);
    return scenario;
  }

  function encodeScenarioForUrl(scenario) {
    if (!hasValidLoan(scenario.loan)) throw new Error('Only valid scenarios can be shared.');
    const overrides = [];
    scenario.payments.forEach((payment, index) => {
      const regularOverride = payment.isRegularOverride ? money(payment.regularPayment) : null;
      const extraAdjustment = Math.abs(payment.extraPrincipal || 0) >= 0.005 ? money(payment.extraPrincipal) : null;
      if (regularOverride !== null || extraAdjustment !== null) overrides.push([index, regularOverride, extraAdjustment]);
    });
    const payload = {
      v: 1,
      n: scenario.name,
      l: {
        p: scenario.loan.principal,
        r: scenario.loan.annualRate,
        t: scenario.loan.termYears,
        f: scenario.loan.firstPaymentMonth,
        b: scenario.loan.statementBalance
      },
      x: {
        a: scenario.recurringExtra.amount,
        s: scenario.recurringExtra.start
      },
      o: overrides
    };
    if (typeof TextEncoder === 'undefined' || typeof btoa === 'undefined') throw new Error('This browser cannot encode share links.');
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function decodeScenarioFromUrl(encoded) {
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('The share link is malformed.');
    if (typeof TextDecoder === 'undefined' || typeof atob === 'undefined') throw new Error('This browser cannot decode share links.');
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4);
    let payload;
    try {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch (_) {
      throw new Error('The share link could not be decoded.');
    }
    if (!payload || payload.v !== 1 || !payload.l || !Array.isArray(payload.o)) throw new Error('The share link uses an unsupported scenario format.');

    const loan = {
      principal: asNumber(payload.l.p),
      annualRate: asNumber(payload.l.r),
      termYears: asNumber(payload.l.t),
      firstPaymentMonth: payload.l.f,
      statementBalance: payload.l.b === null || payload.l.b === undefined ? null : asNumber(payload.l.b)
    };
    if (!hasValidLoan(loan)) throw new Error('The share link contains invalid loan details.');

    const seenIndexes = new Set();
    const payments = payload.o.map((override) => {
      if (!Array.isArray(override) || override.length !== 3) throw new Error('The share link contains an invalid payment override.');
      const index = asNumber(override[0]);
      if (!Number.isInteger(index) || index < 0 || index >= loan.termYears * 12 || seenIndexes.has(index)) throw new Error('The share link contains an invalid payment override.');
      seenIndexes.add(index);
      const regularPayment = override[1] === null ? 0 : asNumber(override[1]);
      const extraPrincipal = override[2] === null ? 0 : asNumber(override[2]);
      if ((override[1] !== null && (!Number.isFinite(regularPayment) || regularPayment < 0)) || !Number.isFinite(extraPrincipal)) throw new Error('The share link contains an invalid payment override.');
      return {
        month: addMonths(loan.firstPaymentMonth, index),
        regularPayment,
        isRegularOverride: override[1] !== null,
        extraPrincipal
      };
    });

    return normalizeScenario({
      name: typeof payload.n === 'string' && payload.n.trim() ? payload.n : 'Shared Scenario',
      loan,
      recurringExtra: {
        amount: payload.x ? payload.x.a : 0,
        start: payload.x ? payload.x.s : 'projected'
      },
      payments
    });
  }

  function getShareUrl(scenario) {
    if (typeof window === 'undefined') throw new Error('Share links are available only in a browser.');
    const encoded = encodeScenarioForUrl(scenario);
    if (encoded.length > 8000) throw new Error('This scenario is too large to embed safely in a share link. Export it as JSON instead.');
    const url = new URL(window.location.href);
    url.hash = `scenario=${encoded}`;
    return url.toString();
  }

  function syncShareUrl(scenario) {
    if (typeof window === 'undefined' || !window.history) return null;
    try {
      const shareUrl = getShareUrl(scenario);
      if (shareUrl !== window.location.href) window.history.replaceState(null, '', shareUrl);
      return shareUrl;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The share link could not be updated.');
      return null;
    }
  }

  function loadSharedScenarioFromUrl() {
    if (typeof window === 'undefined' || !window.location.hash) return { scenario: null, error: '', encoded: '' };
    const params = new URLSearchParams(window.location.hash.slice(1));
    const encoded = params.get('scenario');
    if (!encoded) return { scenario: null, error: '', encoded: '' };
    try {
      return { scenario: decodeScenarioFromUrl(encoded), error: '', encoded };
    } catch (error) {
      return { scenario: null, error: error instanceof Error ? error.message : 'The share link could not be loaded.', encoded };
    }
  }

  function canUseStorage() {
    try {
      const probe = `${STORAGE_KEY}:probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadState() {
    const fallback = defaultScenario();
    if (!storageAvailable) return { schemaVersion: SCHEMA_VERSION, selectedScenarioId: fallback.id, scenarios: [fallback] };

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { schemaVersion: SCHEMA_VERSION, selectedScenarioId: fallback.id, scenarios: [fallback] };

    let stored;
    try {
      stored = JSON.parse(raw);
    } catch (_) {
      storageWriteBlocked = true;
      storageRecoveryNotice = 'Saved scenario data could not be read. It has not been overwritten; export any recovered scenarios before clearing browser storage.';
      return { schemaVersion: SCHEMA_VERSION, selectedScenarioId: fallback.id, scenarios: [fallback] };
    }

    if (!stored || stored.schemaVersion !== SCHEMA_VERSION || !Array.isArray(stored.scenarios)) {
      storageWriteBlocked = true;
      storageRecoveryNotice = 'Saved scenario data uses an unsupported format. It has not been overwritten.';
      return { schemaVersion: SCHEMA_VERSION, selectedScenarioId: fallback.id, scenarios: [fallback] };
    }

    const scenarios = [];
    let invalidScenarioCount = 0;
    stored.scenarios.forEach((savedScenario) => {
      try {
        scenarios.push(normalizeScenario(savedScenario, true));
      } catch (_) {
        invalidScenarioCount += 1;
      }
    });

    if (scenarios.length === 0) {
      storageWriteBlocked = true;
      storageRecoveryNotice = 'Saved scenarios could not be recovered. The browser copy has not been overwritten.';
      return { schemaVersion: SCHEMA_VERSION, selectedScenarioId: fallback.id, scenarios: [fallback] };
    }

    if (invalidScenarioCount > 0) {
      storageWriteBlocked = true;
      storageRecoveryNotice = `${invalidScenarioCount} saved scenario${invalidScenarioCount === 1 ? ' was' : 's were'} skipped because it was invalid. The browser copy has not been overwritten.`;
    }

    const selected = scenarios.some((scenario) => scenario.id === stored.selectedScenarioId) ? stored.selectedScenarioId : scenarios[0].id;
    return { schemaVersion: SCHEMA_VERSION, selectedScenarioId: selected, scenarios };
  }

  function saveNow() {
    if (!storageAvailable || storageWriteBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStatus('Saved locally.');
    } catch (_) {
      setStatus('Changes could not be saved locally.');
    }
  }

  function queueSave() {
    const scenario = getSelectedScenario();
    if (scenario) scenario.updatedAt = new Date().toISOString();
    if (!storageAvailable) return;
    if (storageWriteBlocked) {
      setStatus('Auto-save is paused to protect unrecovered browser data. Export scenarios before clearing storage.');
      return;
    }
    clearTimeout(saveTimer);
    setStatus('Saving locally…');
    saveTimer = setTimeout(saveNow, 250);
  }

  function setStatus(message) {
    const element = document.getElementById('calculator-status');
    if (element) element.textContent = message;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function renderRecurringControls(scenario) {
    scenario.recurringExtra = normalizeRecurringExtra(scenario.recurringExtra);
    const amount = document.getElementById('recurring-extra');
    const start = document.getElementById('recurring-start');
    if (document.activeElement !== amount) amount.value = formatNumberInput(scenario.recurringExtra.amount);
    if (document.activeElement !== start) start.value = scenario.recurringExtra.start;
  }

  function makeElement(tag, text) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function appendCell(row, text, tag = 'td') {
    const cell = makeElement(tag, text);
    row.appendChild(cell);
    return cell;
  }

  function appendCalculatedCell(row, field, value) {
    const cell = appendCell(row, value);
    cell.dataset.calculatedField = field;
    return cell;
  }

  function renderLoanForm(scenario) {
    const loan = scenario.loan;
    const values = {
      principal: formatNumberInput(loan.principal),
      annualRate: formatRateInput(loan.annualRate),
      termYears: Number.isFinite(loan.termYears) ? String(loan.termYears) : '',
      firstPaymentMonth: loan.firstPaymentMonth || '',
      statementBalance: loan.statementBalance === null ? '' : formatNumberInput(loan.statementBalance)
    };
    Object.entries(values).forEach(([name, value]) => {
      const input = document.querySelector(`[name="${name}"]`);
      if (input && document.activeElement !== input) input.value = value;
    });
  }

  function renderScenarioControls(scenario) {
    const tabs = document.getElementById('scenario-tabs');
    tabs.replaceChildren();
    state.scenarios.forEach((item) => {
      const tab = makeElement('button', item.name);
      tab.type = 'button';
      tab.className = 'scenario-tab';
      tab.dataset.scenarioId = item.id;
      tab.setAttribute('role', 'radio');
      tab.setAttribute('aria-checked', String(item.id === scenario.id));
      tab.tabIndex = item.id === scenario.id ? 0 : -1;
      tabs.appendChild(tab);
    });
    const name = document.getElementById('scenario-name');
    if (document.activeElement !== name) name.value = scenario.name;
  }

  function renderSummary(scenario, baseline, plan) {
    const planTotals = totals(plan.rows);
    const baselineTotals = totals(baseline.rows);
    const currentRows = plan.rows.filter((row) => row.status === 'actual');
    const currentBalance = currentRows.length ? currentRows[currentRows.length - 1].endingBalance : scenario.loan.principal;
    const historicalExtra = currentRows.reduce((sum, row) => money(sum + row.extraPrincipal), 0);
    const futureExtra = money(planTotals.extraPrincipal - historicalExtra);
    const payoff = plan.rows[plan.rows.length - 1];
    const monthsSaved = baseline.rows.length - plan.rows.length;
    const years = Math.floor(monthsSaved / 12);
    const months = monthsSaved % 12;
    const payoffText = payoff ? formatMonth(payoff.month) : '—';
    const timeSaved = monthsSaved > 0 ? `${years ? `${years} year${years === 1 ? '' : 's'} ` : ''}${months} month${months === 1 ? '' : 's'} sooner` : 'Same term as original schedule';

    setText('metric-payment', formatMoney(plan.contractualPayment));
    setText('metric-current-balance', formatMoney(currentBalance));
    setText('metric-current-balance-detail', currentRows.length ? `After ${formatMonth(currentRows[currentRows.length - 1].month)}` : 'Before the first payment');
    setText('metric-payoff', payoffText);
    setText('metric-time-saved', timeSaved);
    setText('metric-interest-saved', formatMoney(money(baselineTotals.interest - planTotals.interest)));
    setText('metric-interest-detail', `${formatMoney(planTotals.interest)} planned interest`);
    setText('metric-extra-principal', formatMoney(planTotals.extraPrincipal));
    setText('metric-extra-detail', `${formatMoney(historicalExtra)} actual · ${formatMoney(futureExtra)} projected`);

    const reconciliation = document.getElementById('reconciliation');
    const difference = scenario.loan.statementBalance === null ? null : money(scenario.loan.statementBalance - currentBalance);
    if (difference !== null && currentRows.length && Math.abs(difference) >= 0.005) {
      reconciliation.hidden = false;
      reconciliation.textContent = `Your statement balance is ${formatMoney(scenario.loan.statementBalance)}. The model differs by ${formatMoney(Math.abs(difference))} ${difference > 0 ? 'below' : 'above'} the statement. Payment timing, lender interest rules, or omitted transactions can cause a difference; the model has not been changed automatically.`;
    } else {
      reconciliation.hidden = true;
      reconciliation.textContent = '';
    }
  }

  function renderComparisonTable(baseline, plan) {
    const tbody = document.querySelector('#comparison-table tbody');
    tbody.replaceChildren();
    const baselineTotals = totals(baseline.rows);
    const planTotals = totals(plan.rows);
    const moneyDelta = (planned, original, extraIsBenefit = false) => {
      const difference = money(planned - original);
      if (Math.abs(difference) < 0.005) return { text: '—', className: '' };
      const savings = extraIsBenefit ? difference > 0 : difference < 0;
      return {
        text: difference > 0 ? `+${formatMoney(difference)}` : formatMoney(difference),
        className: savings ? 'amount-savings' : 'amount-debt'
      };
    };
    const monthDelta = plan.rows.length - baseline.rows.length;
    const durationDelta = monthDelta === 0 ? { text: '—', className: '' } : {
      text: `${Math.abs(monthDelta)} month${Math.abs(monthDelta) === 1 ? '' : 's'} ${monthDelta < 0 ? 'sooner' : 'longer'}`,
      className: monthDelta < 0 ? 'amount-savings' : 'amount-debt'
    };
    const values = [
      { label: 'Payoff Date', original: formatMonth(baseline.rows[baseline.rows.length - 1].month), planned: formatMonth(plan.rows[plan.rows.length - 1].month), delta: durationDelta },
      { label: 'Number of Payments', original: String(baseline.rows.length), planned: String(plan.rows.length), delta: monthDelta === 0 ? { text: '—', className: '' } : { text: String(monthDelta), className: monthDelta < 0 ? 'amount-savings' : 'amount-debt' } },
      { label: 'Total Paid', original: formatMoney(baselineTotals.totalPaid), planned: formatMoney(planTotals.totalPaid), delta: moneyDelta(planTotals.totalPaid, baselineTotals.totalPaid) },
      { label: 'Total Interest', original: formatMoney(baselineTotals.interest), planned: formatMoney(planTotals.interest), delta: moneyDelta(planTotals.interest, baselineTotals.interest), valueClass: 'amount-interest' },
      { label: 'Total Principal', original: formatMoney(baselineTotals.principal), planned: formatMoney(planTotals.principal), delta: { text: '—', className: '' }, valueClass: 'amount-principal' },
      { label: 'Extra Principal', original: formatMoney(0), planned: formatMoney(planTotals.extraPrincipal), delta: moneyDelta(planTotals.extraPrincipal, 0, true), valueClass: 'amount-savings' }
    ];
    values.forEach((value) => {
      const row = document.createElement('tr');
      appendCell(row, value.label, 'th').scope = 'row';
      const originalCell = appendCell(row, value.original);
      const planCell = appendCell(row, value.planned);
      const deltaCell = appendCell(row, value.delta.text);
      if (value.valueClass) {
        originalCell.classList.add(value.valueClass);
        planCell.classList.add(value.valueClass);
      }
      if (value.delta.className) deltaCell.classList.add(value.delta.className);
      tbody.appendChild(row);
    });
  }

  function renderAnnualTable(rows) {
    const tbody = document.querySelector('#annual-table tbody');
    const tfoot = document.querySelector('#annual-table tfoot');
    tbody.replaceChildren();
    tfoot.replaceChildren();
    const years = annualSummary(rows);
    years.forEach((year) => {
      const row = document.createElement('tr');
      if (year.status === 'Actual') row.classList.add('actual-row');
      if (year.status === 'Projected') row.classList.add('projected-row');
      if (year.status === 'Mixed') row.classList.add('transition-row');
      appendCell(row, year.year, 'th').scope = 'row';
      appendCell(row, year.status);
      appendCell(row, formatMoney(year.beginningBalance));
      appendCell(row, formatMoney(year.regularPaid));
      const interestCell = appendCell(row, formatMoney(year.interest));
      interestCell.classList.add('amount-interest');
      const principalCell = appendCell(row, formatMoney(year.principal));
      principalCell.classList.add('amount-principal');
      const extraCell = appendCell(row, formatMoney(year.extraPrincipal));
      extraCell.classList.add('amount-savings');
      appendCell(row, formatMoney(year.endingBalance));
      tbody.appendChild(row);
    });
    const summary = totals(rows);
    const total = document.createElement('tr');
    appendCell(total, 'Total', 'th').scope = 'row';
    appendCell(total, '');
    appendCell(total, '');
    appendCell(total, formatMoney(summary.totalPaid - summary.extraPrincipal));
    const totalInterestCell = appendCell(total, formatMoney(summary.interest));
    totalInterestCell.classList.add('amount-interest');
    const totalPrincipalCell = appendCell(total, formatMoney(summary.principal));
    totalPrincipalCell.classList.add('amount-principal');
    const totalExtraCell = appendCell(total, formatMoney(summary.extraPrincipal));
    totalExtraCell.classList.add('amount-savings');
    appendCell(total, '');
    tfoot.appendChild(total);
  }

  function editableInput(row, field, value, additionalClass = '') {
    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.pattern = '[0-9]*[.]?[0-9]*';
    input.dataset.month = row.month;
    input.dataset.field = field;
    input.value = formatNumberInput(value);
    input.setAttribute('aria-label', `${field === 'regularPayment' ? 'Principal and interest' : 'Extra Principal'} for ${formatMonth(row.month)}`);
    if (additionalClass) input.classList.add(additionalClass);
    return input;
  }

  function updateScheduleToggle(rows, displayedRowCount) {
    const button = document.getElementById('toggle-schedule');
    const canToggle = showAllSchedule || rows.length > displayedRowCount;
    button.hidden = !canToggle;
    button.textContent = showAllSchedule ? 'Show Nearby Months' : `Show All ${rows.length} Months`;
    button.setAttribute('aria-expanded', String(showAllSchedule));
  }

  function renderScheduleTable(scenario, rows, contractualPayment) {
    const tbody = document.querySelector('#schedule-table tbody');
    tbody.replaceChildren();
    const today = currentMonth();
    const actualCount = rows.filter((row) => row.status === 'actual').length;
    const visibleStart = Math.max(0, actualCount - 6);
    const visibleEnd = Math.min(rows.length, actualCount + 13);
    const visibleRows = showAllSchedule ? rows : rows.slice(visibleStart, visibleEnd);

    visibleRows.forEach((row) => {
      const scenarioPayment = scenario.payments.find((payment) => payment.month === row.month) || {};
      const tableRow = document.createElement('tr');
      tableRow.dataset.month = row.month;
      tableRow.classList.add(row.status === 'actual' ? 'actual-row' : 'projected-row');
      if (row.month === today || (row.index === actualCount && actualCount > 0)) tableRow.classList.add('transition-row');
      appendCell(tableRow, formatMonth(row.month), 'th').scope = 'row';
      appendCell(tableRow, row.status === 'actual' ? 'Actual' : 'Projected');
      const regularCell = document.createElement('td');
      const regularClass = scenarioPayment.isRegularOverride ? 'edited' : '';
      regularCell.appendChild(editableInput(row, 'regularPayment', scenarioPayment.regularPayment, regularClass));
      tableRow.appendChild(regularCell);
      const extraCell = document.createElement('td');
      const extraClass = Math.abs(scenarioPayment.extraPrincipal || 0) > 0.005 || row.recurringExtraPrincipal > 0 ? 'edited' : '';
      extraCell.appendChild(editableInput(row, 'extraPrincipal', row.requestedExtraPrincipal, extraClass));
      tableRow.appendChild(extraCell);
      appendCalculatedCell(tableRow, 'totalPayment', formatMoney(row.totalPayment));
      const interestCell = appendCalculatedCell(tableRow, 'interest', formatMoney(row.interest));
      interestCell.classList.add('amount-interest');
      const principalCell = appendCalculatedCell(tableRow, 'principalPaid', formatMoney(row.principalPaid));
      principalCell.classList.add('amount-principal');
      appendCalculatedCell(tableRow, 'endingBalance', formatMoney(row.endingBalance));
      tbody.appendChild(tableRow);
    });

    updateScheduleToggle(rows, visibleRows.length);
  }

  function refreshScheduleCalculations(rows) {
    const rowsByMonth = new Map(rows.map((row) => [row.month, row]));
    document.querySelectorAll('#schedule-table tbody tr[data-month]').forEach((tableRow) => {
      const calculatedRow = rowsByMonth.get(tableRow.dataset.month);
      tableRow.hidden = !calculatedRow;
      if (!calculatedRow) return;
      tableRow.querySelectorAll('[data-calculated-field]').forEach((cell) => {
        cell.textContent = formatMoney(calculatedRow[cell.dataset.calculatedField]);
      });
    });
    const displayedRowCount = [...document.querySelectorAll('#schedule-table tbody tr[data-month]')]
      .filter((tableRow) => !tableRow.hidden).length;
    updateScheduleToggle(rows, displayedRowCount);
  }

  function svgElement(tag, attributes = {}, text = '') {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    if (text) element.textContent = text;
    return element;
  }

  function renderChart(scenario, baseline, plan) {
    const svg = document.getElementById('balance-chart');
    const empty = document.getElementById('chart-empty');
    svg.replaceChildren();
    if (!plan.rows.length || !baseline.rows.length) {
      svg.hidden = true;
      empty.hidden = false;
      empty.textContent = 'Enter valid original loan details to draw the balance comparison.';
      return;
    }
    svg.hidden = false;
    empty.hidden = true;

    const width = 900;
    const height = 360;
    const margin = { top: 24, right: 22, bottom: 48, left: 86 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const firstPointMonth = addMonths(scenario.loan.firstPaymentMonth, -1);
    const baselinePoints = [{ month: firstPointMonth, balance: scenario.loan.principal }, ...baseline.rows.map((row) => ({ month: row.month, balance: row.endingBalance }))];
    const planPoints = [{ month: firstPointMonth, balance: scenario.loan.principal }, ...plan.rows.map((row) => ({ month: row.month, balance: row.endingBalance }))];
    const maximumIndex = Math.max(baselinePoints.length - 1, planPoints.length - 1, 1);
    const x = (index) => margin.left + innerWidth * index / maximumIndex;
    const y = (value) => margin.top + innerHeight * (1 - value / scenario.loan.principal);
    const path = (points) => points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(monthsBetween(scenario.loan.firstPaymentMonth, point.month) + 1).toFixed(2)},${y(point.balance).toFixed(2)}`).join(' ');

    for (let tick = 0; tick <= 4; tick += 1) {
      const value = money(scenario.loan.principal * tick / 4);
      const yPosition = y(value);
      svg.appendChild(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: yPosition, y2: yPosition, class: 'chart-grid' }));
      svg.appendChild(svgElement('text', { x: margin.left - 8, y: yPosition + 4, 'text-anchor': 'end', class: 'chart-axis' }, formatMoney(value)));
    }
    svg.appendChild(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom, class: 'chart-axis-line' }));
    for (let tick = 0; tick <= 5; tick += 1) {
      const index = Math.round(maximumIndex * tick / 5);
      const month = addMonths(scenario.loan.firstPaymentMonth, Math.max(-1, index - 1));
      const xPosition = x(index);
      svg.appendChild(svgElement('line', { x1: xPosition, x2: xPosition, y1: height - margin.bottom, y2: height - margin.bottom + 5, class: 'chart-axis-line' }));
      svg.appendChild(svgElement('text', { x: xPosition, y: height - margin.bottom + 21, 'text-anchor': 'middle', class: 'chart-axis' }, formatMonth(month)));
    }
    svg.appendChild(svgElement('path', { d: path(baselinePoints), class: 'chart-baseline' }));

    const actualCount = plan.rows.filter((row) => row.status === 'actual').length;
    const actualPoints = planPoints.slice(0, actualCount + 1);
    const projectedPoints = planPoints.slice(Math.max(0, actualCount), planPoints.length);
    if (actualPoints.length > 1) svg.appendChild(svgElement('path', { d: path(actualPoints), class: 'chart-actual' }));
    if (projectedPoints.length > 1) svg.appendChild(svgElement('path', { d: path(projectedPoints), class: 'chart-projected' }));

    const todayIndex = Math.max(0, Math.min(maximumIndex, actualCount));
    const todayX = x(todayIndex);
    svg.appendChild(svgElement('line', { x1: todayX, x2: todayX, y1: margin.top, y2: height - margin.bottom, class: 'chart-today' }));
    svg.appendChild(svgElement('text', { x: Math.min(todayX + 4, width - margin.right - 32), y: margin.top + 13, class: 'chart-marker-label' }, 'Today'));

    const hoverGuide = svgElement('line', {
      x1: margin.left,
      x2: margin.left,
      y1: margin.top,
      y2: height - margin.bottom,
      class: 'chart-hover-guide',
      visibility: 'hidden'
    });
    svg.appendChild(hoverGuide);

    const tooltipGroup = svgElement('g', { class: 'chart-tooltip', 'pointer-events': 'none', visibility: 'hidden' });
    const tooltipBackground = svgElement('rect', { rx: 5, ry: 5, class: 'chart-tooltip-background' });
    const tooltipDate = svgElement('text', { x: 9, y: 17, class: 'chart-tooltip-date' });
    const tooltipOriginal = svgElement('text', { x: 9, y: 34, class: 'chart-tooltip-line' });
    const tooltipPlan = svgElement('text', { x: 9, y: 50, class: 'chart-tooltip-line' });
    tooltipGroup.append(tooltipBackground, tooltipDate, tooltipOriginal, tooltipPlan);

    function updateTooltip(index, anchorX, anchorY) {
      const pointIndex = Math.max(0, Math.min(planPoints.length - 1, Math.round(index)));
      const point = planPoints[pointIndex];
      const baselinePoint = baselinePoints[Math.min(pointIndex, baselinePoints.length - 1)];
      const planLabel = point.month < currentMonth() ? 'Recorded' : 'Planned';
      const date = formatMonth(point.month);
      const original = `Original: ${formatMoney(baselinePoint.balance)}`;
      const planValue = `${planLabel}: ${formatMoney(point.balance)}`;
      const tooltipWidth = Math.max(date.length * 7, original.length * 6.2, planValue.length * 6.2) + 18;
      const tooltipHeight = 59;
      const tooltipX = Math.max(margin.left + 4, Math.min(width - margin.right - tooltipWidth, anchorX + 12));
      const tooltipY = Math.max(margin.top + 4, Math.min(height - margin.bottom - tooltipHeight, anchorY - tooltipHeight - 12));

      const guideX = Math.max(margin.left, Math.min(width - margin.right, anchorX));
      tooltipGroup.setAttribute('transform', `translate(${tooltipX.toFixed(1)} ${tooltipY.toFixed(1)})`);
      tooltipGroup.setAttribute('visibility', 'visible');
      hoverGuide.setAttribute('x1', guideX.toFixed(1));
      hoverGuide.setAttribute('x2', guideX.toFixed(1));
      hoverGuide.setAttribute('visibility', 'visible');
      tooltipBackground.setAttribute('width', tooltipWidth.toFixed(1));
      tooltipBackground.setAttribute('height', String(tooltipHeight));
      tooltipDate.textContent = date;
      tooltipOriginal.textContent = original;
      tooltipPlan.textContent = planValue;
      setText('chart-description', `${date}. ${original}. ${planValue}.`);
    }

    function hideChartHover() {
      tooltipGroup.setAttribute('visibility', 'hidden');
      hoverGuide.setAttribute('visibility', 'hidden');
    }

    const chartHitArea = svgElement('rect', {
      x: margin.left,
      y: margin.top,
      width: innerWidth,
      height: innerHeight,
      fill: 'transparent',
      class: 'chart-hit-area'
    });
    chartHitArea.addEventListener('mousemove', (event) => {
      const bounds = svg.getBoundingClientRect();
      const pointerX = (event.clientX - bounds.left) * width / bounds.width;
      const pointerY = (event.clientY - bounds.top) * height / bounds.height;
      const index = (pointerX - margin.left) * maximumIndex / innerWidth;
      updateTooltip(index, pointerX, pointerY);
    });
    chartHitArea.addEventListener('mouseleave', hideChartHover);
    svg.append(chartHitArea, tooltipGroup);

    planPoints.forEach((point, index) => {
      if (index !== 0 && index % 12 !== 0 && index !== planPoints.length - 1 && index !== actualCount) return;
      const baselinePoint = baselinePoints[Math.min(index, baselinePoints.length - 1)];
      const detail = `${formatMonth(point.month)}. Original balance ${formatMoney(baselinePoint.balance)}. Recorded or planned balance ${formatMoney(point.balance)}.`;
      const marker = svgElement('circle', { cx: x(index), cy: y(point.balance), r: 5, fill: '#0b6e69', stroke: '#ffffff', 'stroke-width': 2, tabindex: 0, role: 'img', 'aria-label': detail });
      marker.addEventListener('mouseenter', () => updateTooltip(index, x(index), y(point.balance)));
      marker.addEventListener('focus', () => updateTooltip(index, x(index), y(point.balance)));
      marker.addEventListener('blur', hideChartHover);
      svg.appendChild(marker);
    });
  }

  function render({ skipSchedule = false } = {}) {
    const scenario = getSelectedScenario();
    renderScenarioControls(scenario);
    renderLoanForm(scenario);
    renderRecurringControls(scenario);
    ensurePaymentSchedule(scenario);
    const plan = calculateSchedule(scenario.loan, scenario.payments, false, scenario.recurringExtra);
    const baseline = calculateSchedule(scenario.loan, [], true);
    const error = plan.error || baseline.error;
    setText('loan-error', error);
    const results = document.getElementById('results');
    results.hidden = Boolean(error);
    if (error) return;
    renderSummary(scenario, baseline, plan);
    renderChart(scenario, baseline, plan);
    renderComparisonTable(baseline, plan);
    renderAnnualTable(plan.rows);
    if (skipSchedule) refreshScheduleCalculations(plan.rows);
    else renderScheduleTable(scenario, plan.rows, plan.contractualPayment);
    syncShareUrl(scenario);
  }

  function updateLoanFromForm(event) {
    const scenario = getSelectedScenario();
    const { name, value } = event.target;
    if (!(name in scenario.loan)) return;
    if (name === 'firstPaymentMonth') scenario.loan[name] = value;
    else scenario.loan[name] = asNumber(value);
    ensurePaymentSchedule(scenario);
    queueSave();
    render();
  }

  function updateRecurringExtra(event) {
    const scenario = getSelectedScenario();
    const recurring = normalizeRecurringExtra(scenario.recurringExtra);
    if (event.target.name === 'recurringExtraAmount') {
      const amount = asNumber(event.target.value);
      recurring.amount = amount === null ? 0 : Math.max(0, amount);
    } else if (event.target.name === 'recurringExtraStart') {
      recurring.start = event.target.value === 'origin' ? 'origin' : 'projected';
    } else {
      return;
    }
    scenario.recurringExtra = recurring;
    queueSave();
    render();
  }

  function queueScheduleUpdate(event) {
    const input = event.target;
    const { month, field } = input.dataset;
    if (!month || !field) return;
    const scenario = getSelectedScenario();
    const payment = scenario.payments.find((item) => item.month === month);
    if (!payment) return;
    const value = asNumber(input.value);
    if (field === 'extraPrincipal') {
      const recurringAmount = recurringExtraForMonth(scenario.recurringExtra, month);
      payment.extraPrincipal = Math.max(-recurringAmount, (value === null ? 0 : Math.max(0, value)) - recurringAmount);
    } else {
      payment[field] = value === null ? 0 : Math.max(0, value);
    }
    if (field === 'regularPayment') {
      const contractual = calculateContractualPayment(scenario.loan.principal, scenario.loan.annualRate, scenario.loan.termYears);
      payment.isRegularOverride = Math.abs(payment.regularPayment - contractual) > 0.005;
    }
    queueSave();
    clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => render({ skipSchedule: true }), 125);
  }

  function updateScenarioName() {
    const scenario = getSelectedScenario();
    const input = document.getElementById('scenario-name');
    const name = input.value.trim();
    if (!name) {
      setStatus('Enter a scenario name before saving it.');
      input.focus();
      return;
    }
    scenario.name = name.slice(0, 80);
    queueSave();
    render();
  }

  function createScenario() {
    const scenario = defaultScenario('New scenario');
    state.scenarios.push(scenario);
    state.selectedScenarioId = scenario.id;
    showAllSchedule = false;
    queueSave();
    render();
  }

  function duplicateScenario() {
    const source = getSelectedScenario();
    const duplicate = normalizeScenario({ ...source, name: `${source.name} copy` });
    state.scenarios.push(duplicate);
    state.selectedScenarioId = duplicate.id;
    showAllSchedule = false;
    queueSave();
    render();
  }

  function deleteScenario() {
    const selected = getSelectedScenario();
    if (!window.confirm(`Delete “${selected.name}” from this browser? This cannot be undone.`)) return;
    state.scenarios = state.scenarios.filter((scenario) => scenario.id !== selected.id);
    if (state.scenarios.length === 0) state.scenarios.push(defaultScenario());
    state.selectedScenarioId = state.scenarios[0].id;
    showAllSchedule = false;
    queueSave();
    render();
  }

  function exportScenario() {
    const scenario = getSelectedScenario();
    const data = JSON.stringify({ schemaVersion: SCHEMA_VERSION, scenario }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const anchor = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    const safeName = scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'mortgage';
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${safeName}-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(anchor.href);
    setStatus('Scenario exported as JSON.');
  }

  async function copyShareLink() {
    const shareUrl = syncShareUrl(getSelectedScenario());
    if (!shareUrl) return;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(shareUrl);
      setStatus('Share Link Copied.');
    } catch (_) {
      window.prompt('Copy This Share Link', shareUrl);
    }
  }

  function importScenario(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported || imported.schemaVersion !== SCHEMA_VERSION) throw new Error('This file uses an unsupported scenario format.');
        const scenario = normalizeScenario(imported.scenario);
        state.scenarios.push(scenario);
        state.selectedScenarioId = scenario.id;
        showAllSchedule = false;
        queueSave();
        render();
        setStatus(`Imported “${scenario.name}” as a new local scenario.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'The selected file could not be imported.');
      }
    };
    reader.onerror = () => setStatus('The selected file could not be read.');
    reader.readAsText(file);
  }

  function activateScenario(scenarioId, restoreFocus = false) {
    if (!state.scenarios.some((scenario) => scenario.id === scenarioId)) return;
    state.selectedScenarioId = scenarioId;
    showAllSchedule = false;
    queueSave();
    render();
    if (restoreFocus) {
      const selectedControl = [...document.querySelectorAll('#scenario-tabs [data-scenario-id]')]
        .find((control) => control.dataset.scenarioId === scenarioId);
      if (selectedControl) selectedControl.focus();
    }
  }

  function bindEvents() {
    document.getElementById('loan-form').addEventListener('input', updateLoanFromForm);
    document.getElementById('recurring-extra').addEventListener('input', updateRecurringExtra);
    document.getElementById('recurring-start').addEventListener('change', updateRecurringExtra);
    document.querySelector('#schedule-table tbody').addEventListener('input', queueScheduleUpdate);
    const scenarioTabs = document.getElementById('scenario-tabs');
    scenarioTabs.addEventListener('click', (event) => {
      const control = event.target.closest('[data-scenario-id]');
      if (!control) return;
      activateScenario(control.dataset.scenarioId, true);
    });
    scenarioTabs.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const controls = [...scenarioTabs.querySelectorAll('[role="radio"]')];
      const currentIndex = controls.indexOf(document.activeElement);
      if (currentIndex < 0) return;
      let nextIndex = currentIndex;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + controls.length) % controls.length;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % controls.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = controls.length - 1;
      event.preventDefault();
      activateScenario(controls[nextIndex].dataset.scenarioId, true);
    });
    document.getElementById('rename-scenario').addEventListener('click', updateScenarioName);
    document.getElementById('new-scenario').addEventListener('click', createScenario);
    document.getElementById('duplicate-scenario').addEventListener('click', duplicateScenario);
    document.getElementById('delete-scenario').addEventListener('click', deleteScenario);
    document.getElementById('export-scenario').addEventListener('click', exportScenario);
    document.getElementById('copy-share-link').addEventListener('click', copyShareLink);
    document.getElementById('import-scenario-button').addEventListener('click', () => document.getElementById('import-scenario').click());
    document.getElementById('import-scenario').addEventListener('change', importScenario);
    document.getElementById('toggle-schedule').addEventListener('click', () => {
      showAllSchedule = !showAllSchedule;
      render();
    });
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const onSchemeChange = () => { if (!storedTheme()) syncThemeToggle(); };
      if (media.addEventListener) media.addEventListener('change', onSchemeChange);
      else if (media.addListener) media.addListener(onSchemeChange);
    }
  }

  function prefersDarkTheme() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function storedTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (_) {
      return null;
    }
  }

  function effectiveTheme() {
    return storedTheme() || (prefersDarkTheme() ? 'dark' : 'light');
  }

  function syncThemeToggle() {
    const button = document.getElementById('theme-toggle');
    const label = document.getElementById('theme-toggle-label');
    if (!button) return;
    const isDark = effectiveTheme() === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    if (label) label.textContent = isDark ? 'Light' : 'Dark';
  }

  function toggleTheme() {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {
      setStatus('Theme preference could not be saved in this browser.');
    }
    syncThemeToggle();
  }

  function init() {
    storageAvailable = canUseStorage();
    state = loadState();
    const shared = loadSharedScenarioFromUrl();
    if (shared.scenario) {
      const matchingScenario = state.scenarios.find((scenario) => {
        try {
          return encodeScenarioForUrl(scenario) === shared.encoded;
        } catch (_) {
          return false;
        }
      });
      if (matchingScenario) state.selectedScenarioId = matchingScenario.id;
      else {
        state.scenarios.push(shared.scenario);
        state.selectedScenarioId = shared.scenario.id;
      }
    }
    const notice = document.getElementById('storage-notice');
    if (!storageAvailable) {
      notice.hidden = false;
      notice.textContent = 'Local storage is unavailable. Scenarios cannot be saved in this browser.';
    } else if (storageRecoveryNotice) {
      notice.hidden = false;
      notice.textContent = storageRecoveryNotice;
    } else if (shared.error) {
      notice.hidden = false;
      notice.textContent = shared.error;
    }
    bindEvents();
    syncThemeToggle();
    render();
    if (storageAvailable && !storageWriteBlocked) saveNow();
  }

  return {
    calculateContractualPayment,
    formatRateInput,
    isValidMonth,
    validateLoan,
    calculateSchedule,
    recurringExtraForMonth,
    totals,
    annualSummary,
    ensurePaymentSchedule,
    normalizeScenario,
    encodeScenarioForUrl,
    decodeScenarioFromUrl,
    init
  };
})();

if (typeof window !== 'undefined') window.MortgageCalculator = MortgageCalculator;
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', MortgageCalculator.init);
