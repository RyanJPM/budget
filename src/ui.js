const E = window.BudgetEngine;

const state = {
  page: "now",
  data: null,
  focus: null,
  timer: null,
  draft: { label: "", amount: null, end: "" },
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

function signed(n) {
  const value = Number(n) || 0;
  const abs = E.eur(Math.abs(value));
  if (value > 0.001) return { text: "+" + abs, cls: "pos" };
  if (value < -0.001) return { text: "−" + abs.replace(/^[−-]/, ""), cls: "neg" };
  return { text: E.eur(0), cls: "" };
}

function allRows() {
  return E.forecast(state.data, new Date());
}

function emptyBudget() {
  const data = state.data || {};
  return !(Number(data.salary))
    && !(data.charges || []).length
    && !(data.expenses || []).length
    && !(data.sales || []).length
    && !(data.debts || []).length;
}

function shown(rows) {
  if (!state.focus) return E.currentRow(rows);
  return rows.find((row) => row.id === state.focus) || E.currentRow(rows);
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
  cur[parts[parts.length - 1]] = value;
}

function persist() {
  clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    try {
      const profile = activeProfile();
      profile.data = state.data;
      state.store.activeId = profile.id;
      if (window.budgetAPI) await window.budgetAPI.save(state.store);
      else localStorage.setItem("budget-local", JSON.stringify(state.store));
      const el = document.getElementById("save-state");
      if (el) {
        el.textContent = "Enregistré sur cet ordinateur";
        el.classList.add("on");
      }
    } catch (err) {
      const el = document.getElementById("save-state");
      if (el) el.textContent = "Pas enregistré";
    }
  }, 160);
}

function refreshSide(rows) {
  const current = E.currentRow(rows);
  document.getElementById("side-month").textContent = current.label;
  const resteEl = document.getElementById("side-reste");
  resteEl.textContent = E.eur(current.reste);
  resteEl.classList.toggle("low", current.reste < current.floor - 0.001);
  const select = document.getElementById("profile-select");
  if (select && state.store) {
    const signature = state.store.profiles.map((profile) => profile.id + ":" + profile.name).join("|") + "#" + state.store.activeId;
    if (select.dataset.signature !== signature) {
      select.dataset.signature = signature;
      select.innerHTML = state.store.profiles.map((profile) => `<option value="${esc(profile.id)}" ${profile.id === state.store.activeId ? "selected" : ""}>${esc(profile.name)}</option>`).join("");
    }
  }
  document.querySelectorAll("nav [data-page], .profile-dock [data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === state.page);
  });
  const live = document.getElementById("live-reste");
  if (live) live.innerHTML = "Reste maintenant, " + esc(current.label) + " : <strong>" + esc(E.eur(current.reste)) + "</strong>";
}

function ledger(row) {
  const lines = [
    ["Déjà en poche", row.report, row.report ? "Reste du mois d'avant." : "Rien à reporter."],
    [row.payLabel, row.salary, "Touchée ce mois, gagnée le mois d'avant."],
  ];
  for (const sale of row.salesDetail || []) {
    lines.push(["Vente : " + sale.label, sale.amount, "Encaissé à part, pas mélangé à la paye."]);
  }
  if (row.recu) lines.push(["On te rembourse", row.recu, row.receivedFrom.join(", ")]);
  if (row.extra) lines.push([row.extraLabel || "Extra", -row.extra, ""]);
  lines.push(["Charges", -row.charges, "Factures."]);
  if (row.expenses) lines.push(["Dépenses", -row.expenses, "Courses, achats, prélèvements."]);
  if (row.cashPaid) lines.push(["Remboursements", -row.cashPaid, "Argent qui sort vraiment."]);
  let run = 0;
  return lines.map(([label, amount, note]) => {
    run = E.round2(run + amount);
    return { label, amount, run, note };
  });
}

function addForm() {
  const draft = state.draft;
  return `<div class="add-spend">
      ${text("draft.label", draft.label, "Courses, Uber, casque…")}
      ${num("draft.amount", draft.amount)}
      ${month("draft.end", draft.end)}
      <button type="button" class="primary" data-action="add-expense">Ajouter</button>
    </div>
    <p class="help">Dernier mois vide = une seule fois. Rempli = le même montant chaque mois, comme le bureau.</p>`;
}

function expenseCard(row) {
  const lines = row.expensesDetail || [];
  return `<article class="card">
    <h2>Dépenses</h2>
    ${lines.map((item) => `<div class="spend">
      <span>${esc(item.label)} <em>${esc(item.note)}</em></span>
      ${num(expenseAmountBind(item, row.id), item.amount)}
      <button type="button" class="text-btn danger" data-action="remove-expense" data-index="${item.index}">Retirer</button>
    </div>`).join("") || '<p class="empty">Rien pour l’instant. Courses et repas dehors s’ajoutent ici, le mois n’est pas fini.</p>'}
    <div class="line total"><span>Total</span><span></span><strong class="num">${esc(E.eur(row.expenses || 0))}</strong></div>
    ${addForm()}
  </article>`;
}

function renderSpend(rows) {
  const row = shown(rows);
  const all = state.data.expenses || [];
  return `
    <div class="page-head">
      <h1 class="page">Dépenses</h1>
      <p class="sub">${esc(row.label)} : ${esc(E.eur(row.expenses || 0))}. Une fois, ou plusieurs fois jusqu’au dernier mois. Courses et repas dehors peuvent encore augmenter.</p>
    </div>
    <article class="card">${addForm()}</article>
    <section class="section">
      <h2>Toutes</h2>
      ${all.map((expense, i) => `<article class="ex-card">
        <div class="fields">
          <label class="field">Nom ${text("expenses." + i + ".label", expense.label, "Courses")}</label>
          ${expense.kind === "installment"
            ? `<label class="field">Premier prélèvement ${num("expenses." + i + ".first", expense.first)}</label>
               <label class="field">Prélèvements suivants ${num("expenses." + i + ".next", expense.next)}</label>`
            : `<label class="field">${expense.kind === "repeat" ? "Montant à chaque fois" : "Montant"} ${num("expenses." + i + ".amount", expense.amount)}</label>`}
          <label class="field">Type <select data-bind="expenses.${i}.kind" data-type="text">
            <option value="once" ${expense.kind === "repeat" || expense.kind === "installment" ? "" : "selected"}>Une fois</option>
            <option value="repeat" ${expense.kind === "repeat" ? "selected" : ""}>Plusieurs fois</option>
            <option value="installment" ${expense.kind === "installment" ? "selected" : ""}>Prélèvement</option>
          </select></label>
          ${expense.kind === "installment"
            ? `<label class="field">À partir de ${month("expenses." + i + ".start", expense.start)}</label>
               <label class="field">Nombre de suivants ${num("expenses." + i + ".count", expense.count)}</label>`
            : expense.kind === "repeat"
            ? `<label class="field">À partir de ${month("expenses." + i + ".start", expense.start)}</label>
               <label class="field">Dernier mois ${month("expenses." + i + ".end", expense.end)}</label>`
            : `<label class="field">Mois ${month("expenses." + i + ".month", expense.month)}</label>`}
        </div>
        <div class="actions"><button type="button" class="text-btn danger" data-action="remove-expense" data-index="${i}">Retirer</button></div>
      </article>`).join("") || '<p class="empty">Aucune dépense.</p>'}
      <div class="actions">
        <button type="button" class="text-btn" data-action="add-installment">Ajouter un prélèvement</button>
      </div>
    </section>`;
}

function renderNow(rows) {
  const row = shown(rows);
  const index = rows.findIndex((item) => item.id === row.id);
  const next = rows[index + 1];
  const lines = ledger(row);
  const low = row.reste < row.floor - 0.001;
  const chip = row.status === "current" ? "Maintenant" : row.status === "past" ? "Passé" : "À venir";
  return `
    <section class="hero">
      <div>
        <p class="kicker">RESTE</p>
        <div class="month-switch">
          <button type="button" class="icon-btn" data-action="month" data-dir="-1" aria-label="Mois précédent">‹</button>
          <h1>${esc(row.label)}</h1>
          <button type="button" class="icon-btn" data-action="month" data-dir="1" aria-label="Mois suivant">›</button>
          <span class="chip ${esc(row.status)}">${chip}</span>
          ${row.status === "current" ? "" : '<button type="button" class="text-btn" data-action="month" data-dir="0">Aujourd’hui</button>'}
        </div>
        <p class="reste ${low ? "low" : ""}">${esc(E.eur(row.reste))}</p>
        <p class="sub">${esc(row.payLabel)}, ${esc(E.eur(row.salary))}. Le plan s’arrête avant de descendre sous ${esc(E.eur(row.floor))}. Ce minimum reste à toi.</p>
      </div>
      <div class="encore">
        <span>Encore dû</span>
        <strong>${esc(E.eur(row.encore))}</strong>
      </div>
    </section>
    ${row.status === "future" ? `<div class="banner">Mois à venir. Aujourd’hui, en ${esc(E.currentRow(rows).label)}, il te reste ${esc(E.eur(E.currentRow(rows).reste))}.</div>` : ""}
    ${emptyBudget() ? `<div class="banner">Ce profil est vide. Importe un fichier .budget depuis Profil, ou remplis les réglages.</div>` : ""}
    <div class="grid">
      <article class="card">
        <h2>Mouvements</h2>
        ${lines.map((line) => {
          const amount = signed(line.amount);
          return `<div class="line">
            <span>${esc(line.label)}</span>
            <strong class="num ${amount.cls}">${esc(amount.text)}</strong>
            <strong class="num">${esc(E.eur(line.run))}</strong>
            ${line.note ? `<span class="note">${esc(line.note)}</span>` : ""}
          </div>`;
        }).join("")}
        <div class="line total"><span>Reste</span><span></span><strong class="num">${esc(E.eur(row.reste))}</strong></div>
      </article>
      <div>
        <article class="card">
          <h2>Charges</h2>
          ${row.chargesDetail.map((item) => `<div class="charge">
            <span>${esc(item.name)}</span>
            <strong class="num">${esc(E.eur(item.amount))}</strong>
            <span class="note" style="grid-column:auto;margin:0">${item.shared ? "moitié partagée" : esc(item.note)}</span>
          </div>`).join("")}
          <div class="line total"><span>Total</span><span></span><strong class="num">${esc(E.eur(row.charges))}</strong></div>
        </article>
        ${expenseCard(row)}
        ${next ? `<article class="card next">En ${esc(next.label)}, avec la ${esc(next.payLabel.charAt(0).toLowerCase() + next.payLabel.slice(1))}, reste ${esc(E.eur(next.reste))}.</article>` : ""}
      </div>
      <article class="card" style="grid-column: 1 / -1">
        <h2>Dettes</h2>
        ${row.debts.map((debt) => {
          const paid = E.round2(debt.pay + debt.credit);
          const pct = debt.amount > 0 ? Math.max(0, Math.min(100, Math.round((1 - debt.close / debt.amount) * 100))) : 0;
          return `<div class="debt">
            <div>
              <div class="who">${esc(debt.person)}</div>
              <div class="bar"><i style="width:${pct}%"></i></div>
              ${debt.note ? `<div class="note">${esc(debt.note)}</div>` : ""}
            </div>
            <strong class="num ${paid ? "neg" : ""}">${paid ? "−" + esc(E.eur(paid)) : esc(E.eur(0))}</strong>
            <strong class="num">${esc(E.eur(debt.close))}</strong>
          </div>`;
        }).join("") || '<p class="empty">Aucune dette.</p>'}
      </article>
    </div>`;
}

function chart(rows) {
  const values = rows.map((row) => row.reste);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const w = 720;
  const h = 150;
  const pad = 12;
  const coords = values.map((value, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const y = pad + (1 - (value - min) / (max - min)) * (h - pad * 2);
    return [x, y, rows[i].status === "current"];
  });
  const poly = coords.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" ");
  const now = coords.find((point) => point[2]);
  const dot = now ? `<circle class="now" cx="${now[0].toFixed(1)}" cy="${now[1].toFixed(1)}" r="4"/>` : "";
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution du reste"><polyline points="${poly}"/>${dot}</svg>`;
}

function moneyRows(rows) {
  return rows.map((row) => `<tr class="${row.status === "current" ? "current" : ""}" data-action="open" data-id="${esc(row.id)}">
    <td>${esc(row.label)}</td>
    <td>${esc(row.payLabel)}</td>
    <td>${esc(E.eur(row.salary))}</td>
    <td>${esc(E.eur(row.sales || 0))}</td>
    <td>${esc(E.eur(row.report))}</td>
    <td>${esc(E.eur(row.charges))}</td>
    <td>${esc(E.eur(row.expenses || 0))}</td>
    <td>${esc(E.eur(row.repaid))}</td>
    <td><strong>${esc(E.eur(row.reste))}</strong></td>
    <td>${esc(E.eur(row.encore))}</td>
  </tr>`).join("");
}

const HEAD = `<tr><th>Mois</th><th>Paye</th><th>Montant</th><th>Ventes</th><th>Reporté</th><th>Charges</th><th>Dépenses</th><th>Remboursé</th><th>Reste</th><th>Encore dû</th></tr>`;

function renderForecast(rows) {
  return `
    <div class="page-head">
      <h1 class="page">Prévision</h1>
      <p class="sub">La paye d’un mois est touchée le mois suivant. Le reste est reporté. Clique un mois pour le détail.</p>
    </div>
    <article class="card chart-card">${chart(rows)}</article>
    <div class="table-wrap"><table><thead>${HEAD}</thead><tbody>${moneyRows(rows)}</tbody></table></div>`;
}

function renderHistory(rows) {
  const past = rows.filter((row) => row.status === "past");
  const current = E.currentRow(rows);
  if (!past.length) {
    return `<div class="page-head"><h1 class="page">Historique</h1><p class="empty">${esc(current.label)} s’ajoutera ici le mois prochain.</p></div>`;
  }
  return `
    <div class="page-head">
      <h1 class="page">Historique</h1>
      <p class="sub">${past.length} mois passé${past.length > 1 ? "s" : ""}. On est en ${esc(current.label)}.</p>
    </div>
    <div class="table-wrap"><table><thead>${HEAD}</thead><tbody>${moneyRows(past)}</tbody></table></div>`;
}

function num(bind, value) {
  const shownValue = value === null || value === undefined ? "" : value;
  return `<input data-bind="${bind}" data-type="number" type="number" step="0.01" value="${esc(shownValue)}">`;
}
function text(bind, value, placeholder) {
  return `<input data-bind="${bind}" data-type="text" type="text" value="${esc(value || "")}" placeholder="${esc(placeholder || "")}">`;
}
function month(bind, value) {
  return `<input data-bind="${bind}" data-type="month" type="month" value="${esc((value || "").slice(0, 7))}">`;
}
function check(bind, value, label) {
  return `<label class="check"><input data-bind="${bind}" data-type="check" type="checkbox" ${value ? "checked" : ""}>${esc(label)}</label>`;
}

function renderSettings() {
  const data = state.data;
  return `
    <div class="live">
      <div id="live-reste"></div>
      <span id="save-state">Les cases violettes se recalculent tout de suite</span>
    </div>
    <section class="section">
      <h2>Argent</h2>
      <p class="help">Le salaire habituel est touché le mois d’après. Un mois particulier se règle plus bas, dans « Un mois différent ».</p>
      <div class="fields">
        <label class="field">Salaire habituel ${num("salary", data.salary)}</label>
        <label class="field">Minimum à garder ${num("floor", data.floor)}</label>
        <label class="field">Premier mois ${month("start", data.start)}</label>
      </div>
    </section>
    <section class="section">
      <h2>Charges</h2>
      <p class="help">Factures seulement. Courses, achats et prélèvements : page Dépenses. Un loyer différent pour un mois se met dans « Un mois différent ».</p>
      <div class="table-wrap sheet-wrap"><table class="sheet"><thead><tr><th>Poste</th><th>Montant</th><th>Partagée</th><th>Dernier mois</th><th></th></tr></thead><tbody>
        ${data.charges.map((charge, i) => `<tr>
          <td>${text("charges." + i + ".name", charge.name, "Loyer")}</td>
          <td>${num("charges." + i + ".amount", charge.amount)}</td>
          <td>${check("charges." + i + ".shared", charge.shared, "Oui")}</td>
          <td>${month("charges." + i + ".end", charge.end)}</td>
          <td><button type="button" class="text-btn danger" data-action="remove" data-list="charges" data-index="${i}">Retirer</button></td>
        </tr>`).join("")}
      </tbody></table></div>
      <div class="actions"><button type="button" class="text-btn" data-action="add" data-list="charges">Ajouter une charge</button></div>
    </section>
    <section class="section">
      <h2>Objets vendus</h2>
      <p class="help">Chaque vente entre dans le mois choisi, à part de la paye. Un prélèvement, comme un ordinateur payé en plusieurs fois, se gère dans Dépenses.</p>
      ${(data.sales || []).map((sale, i) => `<article class="ex-card"><div class="fields">
        <label class="field">Objet ${text("sales." + i + ".label", sale.label, "Vélo, téléphone…")}</label>
        <label class="field">Mois ${month("sales." + i + ".month", sale.month)}</label>
        <label class="field">Prix encaissé ${num("sales." + i + ".amount", sale.amount)}</label>
      </div><div class="actions"><button type="button" class="text-btn danger" data-action="remove" data-list="sales" data-index="${i}">Retirer</button></div></article>`).join("")}
      <div class="actions"><button type="button" class="text-btn" data-action="add" data-list="sales">Ajouter un objet vendu</button></div>
    </section>
    <section class="section">
      <h2>Dettes</h2>
      <p class="help">L’ordre des cartes est l’ordre de paiement. Plafond vide : pas de limite. Solde entier : seulement si le reste suffit. Seulement après : la personne nommée doit être soldée. Pause arrête le versement. Réglé met la dette à zéro. Le minimum à garder reste dans la poche.</p>
      ${data.debts.map((debt, i) => `<article class="debt-card">
        <div class="fields">
          <label class="field">Personne ${text("debts." + i + ".person", debt.person, "Prénom")}</label>
          <label class="field">Dette ${num("debts." + i + ".amount", debt.amount)}</label>
          <label class="field">Déjà payé ${num("debts." + i + ".paid", debt.paid)}</label>
          <label class="field">Plafond / mois ${num("debts." + i + ".cap", debt.cap)}</label>
          <label class="field">Mode <select data-bind="debts.${i}.mode" data-type="text">
            <option ${debt.mode !== "Solde entier" ? "selected" : ""}>Progressif</option>
            <option ${debt.mode === "Solde entier" ? "selected" : ""}>Solde entier</option>
          </select></label>
          <label class="field">À partir de ${month("debts." + i + ".start", debt.start)}</label>
          <label class="field grow">Seulement après ${text("debts." + i + ".after", debt.after, "Nom de la personne au-dessus")}</label>
        </div>
        <div class="debt-top" style="margin-top:12px">
          <div class="checks">
            ${check("debts." + i + ".halfBills", debt.halfBills, "Moitié des factures")}
            ${check("debts." + i + ".pause", debt.pause, "Pause")}
            ${check("debts." + i + ".settled", debt.settled, "Réglé")}
          </div>
          <button type="button" class="text-btn danger" data-action="remove" data-list="debts" data-index="${i}">Retirer</button>
        </div>
      </article>`).join("")}
      <div class="actions"><button type="button" class="text-btn" data-action="add" data-list="debts">Ajouter une dette</button></div>
    </section>
    <section class="section">
      <h2>On me doit</h2>
      <p class="help">Coche « Reçu » le mois où l’argent arrive. Il entre dans le reste.</p>
      ${data.receivables.map((row, i) => `<article class="ex-card"><div class="fields">
        <label class="field">Personne ${text("receivables." + i + ".person", row.person)}</label>
        <label class="field">Montant ${num("receivables." + i + ".amount", row.amount)}</label>
        <label class="field">Mois ${month("receivables." + i + ".month", row.month)}</label>
      </div><div class="debt-top" style="margin-top:12px"><div class="checks">${check("receivables." + i + ".received", row.received, "Reçu")}</div>
        <button type="button" class="text-btn danger" data-action="remove" data-list="receivables" data-index="${i}">Retirer</button></div></article>`).join("")}
      <div class="actions"><button type="button" class="text-btn" data-action="add" data-list="receivables">Ajouter quelqu’un</button></div>
    </section>
    <section class="section">
      <h2>Un mois différent</h2>
      <p class="help">Salaire vide = salaire habituel. Loyer vide = loyer habituel. Extra positif = argent déjà sorti.</p>
      ${data.exceptions.map((row, i) => `<article class="ex-card"><div class="fields">
        <label class="field">Mois ${month("exceptions." + i + ".month", row.month)}</label>
        <label class="field">Salaire ${num("exceptions." + i + ".salary", row.salary)}</label>
        <label class="field">Extra ${num("exceptions." + i + ".extra", row.extra)}</label>
        <label class="field">Libellé de l’extra ${text("exceptions." + i + ".extraLabel", row.extraLabel, "Déjà sorti")}</label>
        <label class="field">Loyer de ce mois ${num("exceptions." + i + ".rent", row.rent)}</label>
      </div><div class="actions"><button type="button" class="text-btn danger" data-action="remove" data-list="exceptions" data-index="${i}">Retirer</button></div></article>`).join("")}
      <div class="actions"><button type="button" class="text-btn" data-action="add" data-list="exceptions">Ajouter un mois</button></div>
    </section>
    <section class="section danger-zone">
      <h2>Remise à zéro</h2>
      <p class="help">Efface les chiffres de ce profil seulement. Les autres profils restent.</p>
      <div class="actions"><button type="button" class="text-btn danger" data-action="reset">Revenir aux chiffres de départ</button></div>
    </section>`;
}

function render() {
  const rows = allRows();
  refreshSide(rows);
  const view = document.getElementById("view");
  if (state.page === "now") view.innerHTML = renderNow(rows);
  else if (state.page === "spend") view.innerHTML = renderSpend(rows);
  else if (state.page === "profile") view.innerHTML = renderProfile();
  else if (state.page === "forecast") view.innerHTML = renderForecast(rows);
  else if (state.page === "history") view.innerHTML = renderHistory(rows);
  else {
    view.innerHTML = renderSettings();
    refreshSide(rows);
  }
}

function expenseAmountBind(item, rowId) {
  const expense = state.data.expenses[item.index];
  if (!expense || expense.kind !== "installment") return "expenses." + item.index + ".amount";
  const start = String(expense.start || "").slice(0, 7);
  return "expenses." + item.index + "." + (start === rowId ? "first" : "next");
}

function shapeExpense(expense) {
  if (!expense) return;
  const fallback = (state.data && state.data.start) || "";
  if (expense.kind === "installment") {
    if (expense.first == null || expense.first === "") expense.first = Number(expense.amount) || 0;
    if (expense.next == null || expense.next === "") expense.next = Number(expense.first) || 0;
    if (expense.count == null || expense.count === "") expense.count = 1;
    if (!expense.start) expense.start = expense.month || fallback;
  } else if (expense.kind === "repeat") {
    if (expense.amount == null || expense.amount === "") expense.amount = Number(expense.first) || Number(expense.next) || 0;
    if (!expense.start) expense.start = expense.month || fallback;
    if (!expense.end) expense.end = expense.start;
  } else {
    expense.kind = "once";
    if (expense.amount == null || expense.amount === "") expense.amount = Number(expense.first) || Number(expense.next) || 0;
    if (!expense.month) expense.month = expense.start || fallback;
  }
}

function blank(list) {
  if (list === "charges") return { name: "", amount: 0, shared: false, end: "" };
  if (list === "sales") return { label: "", month: shown(allRows()).id, amount: 0 };
  if (list === "debts") return { person: "", amount: 0, paid: 0, cap: null, mode: "Progressif", settled: false, pause: false, halfBills: false, after: "", start: "" };
  if (list === "receivables") return { person: "", amount: 0, month: "", received: false };
  return { month: "", salary: null, extra: null, extraLabel: "", rent: null };
}

function activeProfile() {
  return state.store.profiles.find((profile) => profile.id === state.store.activeId) || state.store.profiles[0];
}

function renderProfile() {
  const profile = activeProfile();
  return `
    <div class="page-head">
      <h1 class="page">Profil</h1>
      <p class="sub">Un profil garde tout son budget. Tu peux en créer, en changer, et l’emporter chiffré sur un autre ordinateur.</p>
    </div>
    <section class="section">
      <h2>Nom</h2>
      <div class="fields">
        <label class="field">Nom du profil ${text("profile.name", profile.name, "Prénom Nom")}</label>
      </div>
    </section>
    <section class="section">
      <h2>Fichier</h2>
      <p class="help">Exporter écrit un fichier chiffré. Importer le relit avec le même mot de passe, sur cet ordinateur ou un autre.</p>
      <div class="actions">
        <button type="button" class="primary" data-action="export-profile">Exporter chiffré</button>
        <button type="button" class="text-btn" data-action="import-profile">Importer</button>
        <button type="button" class="text-btn" data-action="new-profile">Nouveau profil</button>
      </div>
    </section>
    <section class="section danger-zone">
      <h2>Supprimer</h2>
      <p class="help">Trois confirmations. Une copie chiffrée est proposée avant.</p>
      <div class="actions">
        <button type="button" class="text-btn danger" data-action="delete-profile">Supprimer ce profil</button>
      </div>
    </section>`;
}

function onClick(event) {
  const page = event.target.closest("[data-page]");
  if (page) {
    state.page = page.dataset.page;
    render();
    return;
  }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const kind = action.dataset.action;
  if (kind === "month") {
    const rows = allRows();
    const dir = Number(action.dataset.dir);
    if (dir === 0) state.focus = null;
    else {
      const current = shown(rows);
      const index = rows.findIndex((row) => row.id === current.id);
      const next = rows[index + dir];
      if (next) state.focus = next.status === "current" ? null : next.id;
    }
    render();
    return;
  }
  if (kind === "open") {
    state.focus = action.dataset.id;
    state.page = "now";
    const rows = allRows();
    const row = rows.find((item) => item.id === state.focus);
    if (row && row.status === "current") state.focus = null;
    render();
    return;
  }
  if (kind === "add-installment") {
    const row = shown(allRows());
    state.data.expenses.push({ kind: "installment", label: "", start: row.id, first: 0, next: 0, count: 1 });
    persist();
    render();
    return;
  }
  if (kind === "new-profile") {
    openModal({ kind: "create" });
    return;
  }
  if (kind === "export-profile") {
    openModal({ kind: "password", purpose: "export" });
    return;
  }
  if (kind === "import-profile") {
    startImport();
    return;
  }
  if (kind === "delete-profile") {
    openModal({ kind: "delete", step: 1 });
    return;
  }
  if (kind === "close-modal") {
    closeModal();
    return;
  }
  if (kind === "delete-next") {
    state.modal.step += 1;
    paintModal();
    return;
  }
  if (kind === "delete-now") {
    closeModal();
    removeActiveProfile();
    return;
  }
  if (kind === "delete-export") {
    openModal({ kind: "password", purpose: "export", thenDelete: true });
    return;
  }
  if (kind === "password-ok") {
    submitPassword();
    return;
  }
  if (kind === "create-ok") {
    createProfile();
    return;
  }
  if (kind === "import-new" || kind === "import-replace") {
    applyImport(kind === "import-replace");
    return;
  }
  if (kind === "add-expense") {
    const row = shown(allRows());
    const label = (state.draft.label || "").trim();
    const amount = Number(state.draft.amount) || 0;
    if (!label || !amount) return;
    if (!Array.isArray(state.data.expenses)) state.data.expenses = [];
    if (state.draft.end) {
      state.data.expenses.push({ kind: "repeat", label, amount, start: row.id, end: state.draft.end });
    } else {
      state.data.expenses.push({ kind: "once", label, amount, month: row.id });
    }
    state.draft = { label: "", amount: null, end: "" };
    persist();
    render();
    return;
  }
  if (kind === "remove-expense") {
    state.data.expenses.splice(Number(action.dataset.index), 1);
    persist();
    render();
    return;
  }
  if (kind === "add") {
    state.data[action.dataset.list].push(blank(action.dataset.list));
    persist();
    render();
    return;
  }
  if (kind === "remove") {
    state.data[action.dataset.list].splice(Number(action.dataset.index), 1);
    persist();
    render();
    return;
  }
  if (kind === "reset") {
    if (!confirm("Revenir aux chiffres de départ de ce profil ?")) return;
    state.data = E.defaultBudget();
    state.focus = null;
    persist();
    render();
  }
}

function openModal(modal) {
  state.modal = modal;
  paintModal();
}

function closeModal() {
  state.modal = null;
  paintModal();
}

function paintModal() {
  const root = document.getElementById("modal");
  if (!root) return;
  const modal = state.modal;
  if (!modal) {
    root.className = "";
    root.innerHTML = "";
    return;
  }
  root.className = "open";
  const name = state.store ? activeProfile().name : "";
  let body = "";
  let actions = "";
  if (modal.kind === "delete" && modal.step === 1) {
    body = `<h2>Supprimer ce profil ?</h2><p>Première confirmation. Tu veux supprimer « ${esc(name)} » ?</p>`;
    actions = modalButtons([["close-modal", "Annuler", "text-btn"], ["delete-next", "Continuer", "primary"]]);
  } else if (modal.kind === "delete" && modal.step === 2) {
    body = `<h2>Deuxième confirmation</h2><p>Le budget de « ${esc(name)} » disparaît de cet ordinateur. Les autres profils restent.</p>`;
    actions = modalButtons([["close-modal", "Annuler", "text-btn"], ["delete-next", "Continuer", "primary"]]);
  } else if (modal.kind === "delete") {
    body = `<h2>Troisième confirmation</h2><p>Avant de supprimer « ${esc(name)} », tu peux enregistrer une copie chiffrée pour un autre ordinateur.</p>`;
    actions = modalButtons([["close-modal", "Annuler", "text-btn"], ["delete-export", "Exporter puis supprimer", "primary"], ["delete-now", "Supprimer sans copie", "text-btn danger"]]);
  } else if (modal.kind === "password") {
    body = `<h2>${modal.purpose === "export" ? "Chiffrer l’export" : "Mot de passe du fichier"}</h2>
      <p>${modal.purpose === "export" ? "Choisis un mot de passe. Il faudra le même pour importer ce profil." : "Le fichier est chiffré. Entre le mot de passe choisi à l’export."}</p>
      <div class="fields">
        <label class="field">Mot de passe <input id="modal-password" type="password" autocomplete="off"></label>
        ${modal.purpose === "export" ? '<label class="field">Encore le mot de passe <input id="modal-password-2" type="password" autocomplete="off"></label>' : ""}
      </div>
      <div class="modal-error">${esc(modal.error || "")}</div>`;
    actions = modalButtons([["close-modal", "Annuler", "text-btn"], ["password-ok", "Valider", "primary"]]);
  } else if (modal.kind === "create") {
    body = `<h2>Nouveau profil</h2><p>Il commence vide, au mois en cours. Tu remplis les charges et les dépenses ensuite.</p>
      <label class="field">Nom <input id="modal-name" type="text" placeholder="Prénom Nom"></label>`;
    actions = modalButtons([["close-modal", "Annuler", "text-btn"], ["create-ok", "Créer", "primary"]]);
  } else if (modal.kind === "import-choice") {
    body = `<h2>Importer « ${esc(modal.name)} »</h2><p>Nouveau profil, ou remplacer « ${esc(name)} ».</p>`;
    actions = modalButtons([["close-modal", "Annuler", "text-btn"], ["import-new", "Nouveau profil", "primary"], ["import-replace", "Remplacer celui-ci", "text-btn"]]);
  }
  root.innerHTML = `<div class="modal-card">${body}<div class="modal-actions">${actions}</div></div>`;
  const field = root.querySelector("input");
  if (field) field.focus();
}

function modalButtons(list) {
  return list.map(([action, label, cls]) => `<button type="button" class="${cls}" data-action="${action}">${esc(label)}</button>`).join("");
}

function removeActiveProfile() {
  const id = state.store.activeId;
  state.store.profiles = state.store.profiles.filter((profile) => profile.id !== id);
  if (!state.store.profiles.length) {
    state.store.profiles.push({ id: "p" + Date.now().toString(36), name: "Nouveau profil", data: E.blankBudget() });
  }
  state.store.activeId = state.store.profiles[0].id;
  state.data = activeProfile().data;
  state.focus = null;
  state.page = "now";
  persist();
  render();
}

async function finishExport(password) {
  if (!window.budgetAPI) return false;
  const payload = { name: activeProfile().name, data: state.data, exportedAt: new Date().toISOString() };
  const result = await window.budgetAPI.exportProfile({
    password,
    payload,
    suggestedName: activeProfile().name + ".budget",
  });
  return result && !result.canceled;
}

async function submitPassword() {
  const password = (document.getElementById("modal-password") || {}).value || "";
  const modal = state.modal;
  if (modal.purpose === "export") {
    const again = (document.getElementById("modal-password-2") || {}).value || "";
    if (password.length < 4) {
      modal.error = "Quatre caractères minimum.";
      paintModal();
      return;
    }
    if (password !== again) {
      modal.error = "Les deux mots de passe sont différents.";
      paintModal();
      return;
    }
    const thenDelete = modal.thenDelete;
    const ok = await finishExport(password);
    closeModal();
    if (ok && thenDelete) removeActiveProfile();
    return;
  }
  try {
    const payload = await window.budgetAPI.decrypt({ packed: state.pendingImport, password });
    state.pendingPayload = payload;
    openModal({ kind: "import-choice", name: (payload && payload.name) || "Profil importé" });
  } catch (err) {
    modal.error = "Mot de passe incorrect, ou fichier illisible.";
    paintModal();
  }
}

async function startImport() {
  if (!window.budgetAPI) return;
  const packed = await window.budgetAPI.pickImport();
  if (!packed) return;
  state.pendingImport = packed;
  openModal({ kind: "password", purpose: "import" });
}

function createProfile() {
  const name = ((document.getElementById("modal-name") || {}).value || "").trim();
  if (!name) return;
  activeProfile().data = state.data;
  const profile = { id: "p" + Date.now().toString(36), name, data: E.blankBudget() };
  state.store.profiles.push(profile);
  state.store.activeId = profile.id;
  state.data = profile.data;
  state.focus = null;
  state.page = "settings";
  closeModal();
  persist();
  render();
}

function applyImport(replace) {
  const payload = state.pendingPayload || {};
  const data = payload.data && typeof payload.data === "object" ? payload.data : E.blankBudget();
  E.normalize(data);
  const name = (payload.name || "Profil importé").trim() || "Profil importé";
  if (replace) {
    activeProfile().name = name;
    activeProfile().data = data;
    state.data = data;
  } else {
    let unique = name;
    let n = 2;
    while (state.store.profiles.some((profile) => profile.name === unique)) {
      unique = name + " " + n;
      n += 1;
    }
    const profile = { id: "p" + Date.now().toString(36), name: unique, data };
    state.store.profiles.push(profile);
    state.store.activeId = profile.id;
    state.data = data;
  }
  state.focus = null;
  state.page = "now";
  state.pendingImport = null;
  state.pendingPayload = null;
  closeModal();
  persist();
  render();
}

function renderKeepingFocus() {
  const active = document.activeElement;
  const bind = active && active.dataset ? active.dataset.bind : null;
  const caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
  render();
  if (!bind) return;
  const next = document.querySelector('[data-bind="' + CSS.escape(bind) + '"]');
  if (!next) return;
  next.focus();
  if (caret != null && next.setSelectionRange) {
    try { next.setSelectionRange(caret, caret); } catch (err) { /* number input */ }
  }
}

function onField(event) {
  const el = event.target.closest("[data-bind]");
  if (!el) return;
  const type = el.dataset.type || "text";
  let value = el.value;
  if (type === "check") value = el.checked;
  else if (type === "number") {
    if (el.value === "") value = null;
    else {
      const parsed = Number(String(el.value).replace(",", "."));
      value = Number.isFinite(parsed) ? parsed : null;
    }
  }
  else if (type === "text" && el.tagName === "SELECT") value = el.value;
  const bind = el.dataset.bind;
  if (bind === "profile.name") {
    activeProfile().name = value == null ? "" : String(value);
    persist();
    refreshSide(allRows());
    return;
  }
  if (/^expenses\.\d+\.kind$/.test(bind)) shapeExpense(state.data.expenses[Number(bind.split(".")[1])]);
  if (bind.startsWith("draft.")) setByPath(state, bind, value);
  else {
    setByPath(state.data, bind, value);
    persist();
  }
  if (state.page === "settings" && !bind.startsWith("draft.")) {
    refreshSide(allRows());
    return;
  }
  renderKeepingFocus();
}

async function boot() {
  let loaded = null;
  try {
    if (window.budgetAPI) loaded = await window.budgetAPI.load();
    else {
      const raw = localStorage.getItem("budget-local");
      if (raw) loaded = JSON.parse(raw);
    }
  } catch (err) {
    loaded = null;
  }
  state.store = E.openStore(loaded);
  state.data = activeProfile().data;
  for (const key of ["charges", "debts", "receivables", "exceptions", "expenses", "sales"]) {
    if (!Array.isArray(state.data[key])) state.data[key] = [];
  }
  E.normalize(state.data);
  persist();
  document.getElementById("profile-select").addEventListener("change", (event) => {
    if (event.target.value === state.store.activeId) return;
    activeProfile().data = state.data;
    state.store.activeId = event.target.value;
    state.data = activeProfile().data;
    state.focus = null;
    state.page = "now";
    persist();
    render();
  });
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("input", onField);
  document.body.addEventListener("change", onField);
  document.body.addEventListener("wheel", (event) => {
    if (event.target && event.target.type === "number") event.target.blur();
  }, { passive: true });
  document.body.addEventListener("keydown", (event) => {
    if (!state.modal) return;
    if (event.key === "Escape") closeModal();
    if (event.key === "Enter") {
      const primary = document.querySelector("#modal .primary");
      if (primary) primary.click();
    }
  });
  render();
}

boot();
