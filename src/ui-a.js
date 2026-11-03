const E = window.BudgetEngine;

const THEMES = [
  { id: "default", name: "Défaut", font: "Segoe UI", note: "Indigo. Clair ou sombre." },
  { id: "papier", name: "Papier", font: "Georgia", note: "Crème et brun." },
  { id: "foret", name: "Forêt", font: "Verdana", note: "Vert profond." },
  { id: "ocean", name: "Océan", font: "Calibri", note: "Bleu d’eau." },
  { id: "atelier", name: "Atelier", font: "Palatino", note: "Terracotta." },
];

const state = {
  page: "now",
  data: null,
  focus: null,
  timer: null,
  editing: null,
  draft: { label: "", amount: null, end: "" },
};

function readLook() {
  let look = {};
  try { look = JSON.parse(localStorage.getItem("budget-look") || "{}") || {}; } catch (err) { look = {}; }
  const allowed = { default: 1, papier: 1, foret: 1, ocean: 1, atelier: 1 };
  if (!allowed[look.theme]) look.theme = "default";
  look.mode = look.mode === "dark" ? "dark" : "light";
  return look;
}

function writeLook(look) {
  localStorage.setItem("budget-look", JSON.stringify({ theme: look.theme, mode: look.mode }));
  applyLook();
}

function applyLook() {
  const look = readLook();
  document.documentElement.dataset.theme = look.theme;
  document.documentElement.dataset.mode = look.theme === "default" ? look.mode : "light";
  const btn = document.getElementById("mode-toggle");
  if (btn) {
    btn.hidden = look.theme !== "default";
    btn.textContent = look.mode === "dark" ? "Clair" : "Sombre";
  }
}

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
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null) return false;
    const next = cur[parts[i]];
    if (next == null || typeof next !== "object") return false;
    cur = next;
  }
  if (cur == null) return false;
  cur[parts[parts.length - 1]] = value;
  return true;
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
  applyLook();
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
      <span class="spend-actions">
        <button type="button" class="text-btn" data-action="skip-month" data-index="${item.index}" data-month="${esc(row.id)}">Sauter ${esc(monthWord(row.id))}</button>
        <button type="button" class="text-btn danger" data-action="remove-expense" data-index="${item.index}">Retirer</button>
      </span>
    </div>`).join("") || '<p class="empty">Rien pour l’instant. Courses et repas dehors s’ajoutent ici, le mois n’est pas fini.</p>'}
    <div class="line total"><span>Total</span><span></span><strong class="num">${esc(E.eur(row.expenses || 0))}</strong></div>
    <p class="help">Sauter un prélèvement le décale : novembre passe en décembre, décembre en janvier. Une dépense répétée saute seulement ce mois. Une dépense unique passe au mois suivant.</p>
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
        ${skipEditor(expense, i)}
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

function formatAmount(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}

function cleanAmount(raw) {
  let text = String(raw).replace(/[^\d,.\-]/g, "").replace(/\./g, ",");
  const neg = text.startsWith("-");
  text = text.replace(/-/g, "");
  const bits = text.split(",");
  text = bits[0] + (bits.length > 1 ? "," + bits.slice(1).join("") : "");
  return (neg ? "-" : "") + text;
}

function parseAmount(raw) {
  const text = String(raw).replace(/\s/g, "").replace(",", ".");
  if (text === "") return { empty: true, value: null };
  if (!/^-?\d*\.?\d*$/.test(text)) return { invalid: true, value: null };
  if (text === "-" || text === "." || text === "-.") return { partial: true, value: null };
  if (text.endsWith(".")) {
    const n = Number(text.slice(0, -1));
    return { partial: true, value: Number.isFinite(n) ? n : null };
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return { invalid: true, value: null };
  return { value: n };
}

function num(bind, value, placeholder) {
  const editing = state.editing && state.editing.bind === bind;
  const shownValue = editing ? state.editing.raw : formatAmount(value);
  return `<input data-bind="${bind}" data-type="number" type="text" inputmode="decimal" autocomplete="off" placeholder="${esc(placeholder || "")}" value="${esc(shownValue)}">`;
}
function text(bind, value, placeholder) {
  return `<input data-bind="${bind}" data-type="text" type="text" value="${esc(value || "")}" placeholder="${esc(placeholder || "")}">`;
}
function monthWord(id) {
  const parsed = E.parseMonth(id);
  if (!parsed) return "ce mois";
  return E.monthTitle(parsed).split(" ")[0].toLowerCase();
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
      <p class="help">Le salaire habituel est touché le mois d’après. Un mois particulier se règle plus bas, dans « Un mois différent ». Minimum vide = 150 €. Écris 0 pour ne rien garder de côté.</p>
      <div class="fields">
        <label class="field">Salaire habituel ${num("salary", data.salary)}</label>
        <label class="field">Minimum à garder ${num("floor", data.floor, "150")}</label>
        <label class="field">Premier mois ${month("start", data.start)}</label>
      </div>
    </section>
    <section class="section">
      <h2>Charges</h2>
      <p class="help">N’importe quelle facture, pas seulement le loyer. La ligne vide reste le temps de la remplir. Courses, achats et prélèvements : page Dépenses. Un loyer différent pour un mois se met dans « Un mois différent ».</p>
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
