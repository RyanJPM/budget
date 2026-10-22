/* Budget mensuel. Le reste est l'argent vraiment disponible, reporté au mois suivant. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BudgetEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MONTHS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];

  /* Pas de budget personnel dans l'application. Les chiffres arrivent par un fichier de profil. */

  const BILL_NAMES = new Set([
    "loyer", "electricite", "google", "cursor", "assurance", "internet", "prime video", "trottinette",
  ]);

  function round2(n) {
    const x = Number(n) || 0;
    const sign = x < 0 ? -1 : 1;
    return (sign * Math.round((Math.abs(x) + 1e-8) * 100)) / 100;
  }

  function parseMonth(value) {
    if (!value) return null;
    if (typeof value === "object" && value.y && value.m) return { y: value.y | 0, m: value.m | 0 };
    const match = String(value).match(/^(\d{4})-(\d{2})/);
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]) };
  }

  function monthKey(ym) {
    return ym.y * 12 + (ym.m - 1);
  }

  function addMonths(ym, delta) {
    const index = monthKey(ym) + delta;
    return { y: Math.floor(index / 12), m: (index % 12) + 1 };
  }

  function cmpMonth(a, b) {
    return monthKey(a) - monthKey(b);
  }

  function monthTitle(ym) {
    const name = MONTHS[ym.m - 1] || "";
    return name.charAt(0).toUpperCase() + name.slice(1) + " " + ym.y;
  }

  function payLabel(ym) {
    const prev = addMonths(ym, -1);
    const name = MONTHS[prev.m - 1] || "";
    const elide = prev.m === 4 || prev.m === 8 || prev.m === 10;
    return elide ? "Paye d'" + name : "Paye de " + name;
  }

  function eur(n) {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n) || 0);
  }

  function defaultBudget() {
    return blankBudget();
  }

  function todayParts(date) {
    const d = date instanceof Date ? date : new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }

  function findException(data, ym) {
    return (data.exceptions || []).find((row) => {
      const month = parseMonth(row.month);
      return month && cmpMonth(month, ym) === 0;
    }) || null;
  }

  function fold(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function monthId(ym) {
    return ym.y + "-" + String(ym.m).padStart(2, "0");
  }

  function isBill(name) {
    const key = fold(name);
    return BILL_NAMES.has(key) || key.startsWith("loyer");
  }

  function chargeToExpense(charge, data) {
    const from = parseMonth(charge.start) || parseMonth(data.start) || { y: 2026, m: 10 };
    const to = parseMonth(charge.end);
    const amount = Number(charge.amount) || 0;
    const label = (charge.name || "").trim() || "Dépense";
    if (to && cmpMonth(to, from) > 0) {
      return { kind: "repeat", label, amount, start: monthId(from), end: monthId(to) };
    }
    return { kind: "once", label, amount, month: monthId(to || from) };
  }

  function normalize(data) {
    if (!data || typeof data !== "object") return 0;
    if (!Array.isArray(data.expenses)) data.expenses = [];
    if (!Array.isArray(data.charges)) data.charges = [];
    const keep = [];
    let moved = 0;
    for (const charge of data.charges) {
      if (!(charge.name || "").trim()) {
        if (Number(charge.amount)) data.expenses.push(chargeToExpense(charge, data));
        continue;
      }
      if (isBill(charge.name)) {
        keep.push(charge);
        continue;
      }
      data.expenses.push(chargeToExpense(charge, data));
      moved += 1;
    }
    data.charges = keep;
    migrateLegacy(data);
    return moved;
  }

  function migrateLegacy(data) {
    if (!Array.isArray(data.sales)) data.sales = [];
    if (!Array.isArray(data.expenses)) data.expenses = [];
    if (data.mac && data.mac.sold && Number(data.mac.price)) {
      const month = String(data.mac.month || data.start || "").slice(0, 7);
      const exists = data.sales.some((sale) => fold(sale.label) === "mac" && String(sale.month || "").slice(0, 7) === month);
      if (!exists && month) data.sales.push({ label: "Mac", month, amount: Number(data.mac.price) });
    }
    if (data.pc && (Number(data.pc.first) || Number(data.pc.next))) {
      const start = String((data.mac && data.mac.month) || data.start || "").slice(0, 7);
      const exists = data.expenses.some((expense) => expense.kind === "installment" && fold(expense.label) === "pc");
      if (!exists && start) {
        data.expenses.push({
          kind: "installment",
          label: "PC",
          start,
          first: Number(data.pc.first) || 0,
          next: Number(data.pc.next) || Number(data.pc.first) || 0,
          count: Number(data.pc.count) || 0,
        });
      }
    }
    delete data.mac;
    delete data.pc;
  }

  function blankBudget(date) {
    const now = todayParts(date);
    return {
      salary: 0,
      floor: 150,
      start: monthId(now),
      charges: [],
      sales: [],
      debts: [],
      receivables: [],
      exceptions: [],
      expenses: [],
    };
  }

  function openStore(raw) {
    if (raw && Array.isArray(raw.profiles)) {
      if (!raw.profiles.length) {
        const id = "p" + Date.now().toString(36);
        raw.profiles.push({ id, name: "Nouveau profil", data: blankBudget() });
        raw.activeId = id;
      }
      if (!raw.profiles.some((profile) => profile.id === raw.activeId)) raw.activeId = raw.profiles[0].id;
      raw.version = 2;
      raw.profiles.forEach((profile) => {
        if (!profile.data || typeof profile.data !== "object") profile.data = blankBudget();
        normalize(profile.data);
      });
      return raw;
    }
    const legacy = raw && typeof raw === "object" && (raw.salary != null || raw.charges || raw.mac);
    const data = legacy ? raw : blankBudget();
    normalize(data);
    const id = "profil";
    return { version: 2, activeId: id, profiles: [{ id, name: legacy ? "Profil" : "Nouveau profil", data }] };
  }

  function expenseHits(expense, ym) {
    if (!expense || !(expense.label || "").trim()) return null;
    if (expense.kind === "installment") {
      const start = parseMonth(expense.start);
      if (!start) return null;
      const delta = cmpMonth(ym, start);
      const count = Math.max(0, Number(expense.count) || 0);
      if (delta < 0 || delta > count) return null;
      const amount = delta === 0 ? Number(expense.first) : Number(expense.next);
      if (!amount) return null;
      return { amount: round2(amount), note: "prélèvement " + (delta + 1) + "/" + (count + 1) };
    }
    const amount = Number(expense.amount) || 0;
    if (!amount) return null;
    if (expense.kind === "repeat") {
      const start = parseMonth(expense.start);
      const end = parseMonth(expense.end) || start;
      if (!start || cmpMonth(ym, start) < 0) return null;
      if (end && cmpMonth(ym, end) > 0) return null;
      return { amount: round2(amount), note: "plusieurs fois" };
    }
    const month = parseMonth(expense.month);
    if (!month || cmpMonth(month, ym) !== 0) return null;
    return { amount: round2(amount), note: "une fois" };
  }

  function chargeActive(charge, ym) {
    if (!charge || !(charge.name || "").trim()) return false;
    const start = parseMonth(charge.start);
    const end = parseMonth(charge.end);
    if (start && cmpMonth(ym, start) < 0) return false;
    if (end && cmpMonth(ym, end) > 0) return false;
    return true;
  }

  function openingOf(debt) {
    if (debt.settled) return 0;
    return round2(Math.max(0, (Number(debt.amount) || 0) - (Number(debt.paid) || 0)));
  }

  function forecast(data, today, count) {
    normalize(data);
    const now = today && today.y ? today : todayParts(today);
    const start = parseMonth(data.start) || now;
    const span = Math.max(count || 24, monthKey(now) - monthKey(start) + 6, 1);
    const debts = data.debts || [];
    let carried = debts.map(openingOf);
    const floor = Number(data.floor);
    const keep = Number.isFinite(floor) ? floor : 150;
    const rows = [];

    for (let i = 0; i < span; i++) {
      const ym = addMonths(start, i);
      const ex = findException(data, ym);
      const openings = carried.slice();
      let halfSum = 0;
      let brut = 0;
      const chargesDetail = [];
      for (const charge of data.charges || []) {
        if (!chargeActive(charge, ym)) continue;
        let amount = Number(charge.amount) || 0;
        let note = "";
        if (ex && Number(ex.rent) > 0 && /^loyer/i.test(charge.name || "")) {
          amount = Number(ex.rent);
          note = "avant la CAF";
        }
        brut += amount;
        if (charge.shared) halfSum += amount;
        chargesDetail.push({
          name: charge.name,
          amount: round2(amount),
          shared: !!charge.shared,
          note,
        });
      }
      brut = round2(brut);
      const part = round2(halfSum / 2);
      const halfIdx = debts.findIndex((d) => d.halfBills && (d.person || "").trim());
      const halfOpen = halfIdx >= 0 ? openings[halfIdx] : 999999;
      const reduc = halfOpen < 0.01 ? part : 0;
      const charges = round2(brut - reduc);

      let salary = Number(data.salary) || 0;
      if (ex && ex.salary !== null && ex.salary !== undefined && ex.salary !== "") salary = Number(ex.salary) || 0;
      const salesDetail = [];
      let sales = 0;
      for (const sale of data.sales || []) {
        const when = parseMonth(sale.month);
        const price = Number(sale.amount) || 0;
        if (!(sale.label || "").trim() || !when || !price || cmpMonth(when, ym) !== 0) continue;
        sales += price;
        salesDetail.push({ label: sale.label, amount: round2(price) });
      }
      sales = round2(sales);
      let recu = 0;
      const receivedFrom = [];
      for (const row of data.receivables || []) {
        if (!row.received) continue;
        const amount = Number(row.amount) || 0;
        if (!amount) continue;
        const when = parseMonth(row.month);
        const hit = (when && cmpMonth(when, ym) === 0) || (!when && cmpMonth(ym, now) === 0);
        if (!hit) continue;
        recu += amount;
        receivedFrom.push(row.person || "Quelqu'un");
      }
      recu = round2(recu);
      const report = i === 0 ? 0 : rows[i - 1].reste;
      const extra = ex ? (Number(ex.extra) || 0) : 0;
      const income = round2(report + salary + sales + recu);
      const cash0 = round2(income - charges - extra);
      const expensesDetail = [];
      let spent = 0;
      let installments = 0;
      (data.expenses || []).forEach((expense, index) => {
        const hit = expenseHits(expense, ym);
        if (!hit) return;
        spent += hit.amount;
        if (expense.kind === "installment") installments += hit.amount;
        expensesDetail.push({ index, label: expense.label, amount: hit.amount, note: hit.note, kind: expense.kind || "once" });
      });
      spent = round2(spent);
      installments = round2(installments);
      let cash = round2(cash0 - spent);

      const closes = openings.slice();
      const debtRows = [];
      let cashPaid = 0;
      let creditPaid = 0;
      for (let d = 0; d < debts.length; d++) {
        const debt = debts[d];
        if (!(debt.person || "").trim()) {
          closes[d] = 0;
          continue;
        }
        const open = openings[d];
        const credit = !debt.settled && debt.halfBills ? round2(Math.min(part, open)) : 0;
        let blocked = false;
        const after = (debt.after || "").trim().toLowerCase();
        if (after) {
          const j = debts.findIndex((item) => (item.person || "").trim().toLowerCase() === after);
          if (j >= 0 && j < d) blocked = closes[j] > 0.009;
          else if (j > d) blocked = openings[j] > 0.009;
        }
        const startAt = parseMonth(debt.start);
        const notYet = !!(startAt && cmpMonth(ym, startAt) < 0);
        const capBlank = debt.cap === null || debt.cap === undefined || debt.cap === "" || Number(debt.cap) === 0;
        const cap = capBlank ? 999999999 : Number(debt.cap);
        const left = round2(Math.max(0, open - credit));
        const room = round2(Math.max(0, cash - keep));
        let pay = 0;
        if (!debt.pause && !blocked && !notYet && !debt.settled) {
          if (debt.mode === "Solde entier") {
            if (left > 0 && room + 0.001 >= left) pay = left;
          } else {
            pay = round2(Math.min(room, left, cap));
          }
        }
        const close = round2(Math.max(0, open - credit - pay));
        cash = round2(cash - pay);
        closes[d] = close;
        cashPaid = round2(cashPaid + pay);
        creditPaid = round2(creditPaid + credit);
        let note = "";
        if (credit > 0.009) note = eur(credit) + " de factures, retirés de la dette";
        else if (notYet && startAt) note = "à partir de " + monthTitle(startAt);
        else if (blocked && after) note = "quand " + debt.after.trim() + " est soldé";
        else if (close <= 0.009 && open > 0.009) note = "soldé";
        debtRows.push({
          person: debt.person,
          open,
          pay: round2(pay),
          credit,
          close,
          note,
          amount: Number(debt.amount) || 0,
        });
      }
      carried = closes;
      const cmp = cmpMonth(ym, now);
      rows.push({
        y: ym.y,
        m: ym.m,
        id: ym.y + "-" + String(ym.m).padStart(2, "0"),
        label: monthTitle(ym),
        status: cmp === 0 ? "current" : cmp < 0 ? "past" : "future",
        payLabel: payLabel(ym),
        salary: round2(salary),
        mac: sales,
        sales,
        salesDetail,
        report: round2(report),
        recu,
        receivedFrom,
        extra: round2(extra),
        extraLabel: extra ? ((ex && ex.extraLabel) || "Extra") : "",
        charges,
        chargesDetail,
        expenses: spent,
        expensesDetail,
        reduc: round2(reduc),
        pc: installments,
        cashPaid,
        creditPaid,
        repaid: round2(cashPaid + creditPaid),
        reste: cash,
        encore: round2(debtRows.reduce((sum, row) => sum + row.close, 0)),
        debts: debtRows,
        floor: keep,
      });
    }
    return rows;
  }

  function currentRow(rows) {
    return rows.find((row) => row.status === "current") || rows[0];
  }

  return {
    forecast,
    normalize,
    defaultBudget,
    blankBudget,
    openStore,
    monthTitle,
    payLabel,
    eur,
    round2,
    todayParts,
    currentRow,
    parseMonth,
  };
});
