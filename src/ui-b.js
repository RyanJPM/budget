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
  const scroll = view.scrollTop;
  if (state.page === "now") view.innerHTML = renderNow(rows);
  else if (state.page === "spend") view.innerHTML = renderSpend(rows);
  else if (state.page === "profile") view.innerHTML = renderProfile();
  else if (state.page === "forecast") view.innerHTML = renderForecast(rows);
  else if (state.page === "history") view.innerHTML = renderHistory(rows);
  else {
    view.innerHTML = renderSettings();
    refreshSide(rows);
  }
  view.scrollTop = scroll;
}

function expenseAmountBind(item, rowId) {
  const expense = state.data.expenses[item.index];
  if (!expense || expense.kind !== "installment") return "expenses." + item.index + ".amount";
  const hit = E.installmentAt(expense, rowId);
  return "expenses." + item.index + "." + (hit && hit.index === 1 ? "first" : "next");
}

function skipEditor(expense, i) {
  if (expense.kind !== "installment" && expense.kind !== "repeat") return "";
  const skips = Array.isArray(expense.skip) ? expense.skip : [];
  const chips = skips.map((id) => {
    const parsed = E.parseMonth(id);
    const label = parsed ? E.monthTitle(parsed) : id;
    return `<button type="button" class="text-btn skip-chip" data-action="unskip" data-index="${i}" data-month="${esc(String(id).slice(0, 7))}">${esc(label)} ×</button>`;
  }).join("");
  const hint = expense.kind === "installment"
    ? "Mois sauté : les prélèvements suivants se décalent d’un mois."
    : "Mois sauté : pause ce mois-là. La date de fin ne bouge pas.";
  return `<div class="skip-row">
    <p class="help">${hint}</p>
    <div class="skip-chips">${chips}</div>
    <label class="field">Mois à sauter <input type="month" data-skip-for="${i}"></label>
    <button type="button" class="text-btn" data-action="skip-add" data-index="${i}">Sauter ce mois</button>
  </div>`;
}

function addSkip(expense, month) {
  const id = String(month || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(id)) return;
  if (!Array.isArray(expense.skip)) expense.skip = [];
  if (expense.skip.indexOf(id) < 0) expense.skip.push(id);
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
  if (list === "charges") return { name: "", amount: null, shared: false, end: "" };
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

function commitEditing() {
  if (!state.editing) return;
  const bind = state.editing.bind;
  const parsed = parseAmount(state.editing.raw);
  const value = parsed.empty || parsed.value == null ? null : parsed.value;
  state.editing = null;
  if (!bind || bind === "profile.name") return;
  if (bind.startsWith("draft.")) setByPath(state, bind, value);
  else setByPath(state.data, bind, value);
}

function onClick(event) {
  if (state.editing && event.target.closest("button")) {
    commitEditing();
    persist();
  }
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
  if (kind === "toggle-mode") {
    const look = readLook();
    if (look.theme !== "default") return;
    look.mode = look.mode === "dark" ? "light" : "dark";
    writeLook(look);
    return;
  }
  if (kind === "open-design") {
    openModal({ kind: "design" });
    return;
  }
  if (kind === "pick-theme") {
    const look = readLook();
    look.theme = action.dataset.theme || "default";
    if (look.theme !== "default") look.mode = "light";
    writeLook(look);
    paintModal();
    return;
  }
  if (kind === "skip-month") {
    const expense = (state.data.expenses || [])[Number(action.dataset.index)];
    if (expense) {
      if (expense.kind === "installment" || expense.kind === "repeat") addSkip(expense, action.dataset.month);
      else expense.month = E.shiftMonth(expense.month || action.dataset.month, 1) || expense.month;
    }
    persist();
    render();
    return;
  }
  if (kind === "skip-add") {
    const expense = (state.data.expenses || [])[Number(action.dataset.index)];
    const input = document.querySelector('[data-skip-for="' + action.dataset.index + '"]');
    if (expense) addSkip(expense, (input && input.value) || shown(allRows()).id);
    persist();
    render();
    return;
  }
  if (kind === "unskip") {
    const expense = (state.data.expenses || [])[Number(action.dataset.index)];
    if (expense && Array.isArray(expense.skip)) {
      expense.skip = expense.skip.filter((item) => String(item).slice(0, 7) !== action.dataset.month);
    }
    persist();
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
  } else if (modal.kind === "design") {
    const look = readLook();
    body = `<h2>Design</h2><p>Cinq apparences. Le bouton clair / sombre n’existe que pour Défaut.</p>
      <div class="theme-list">
        ${THEMES.map((theme) => `<button type="button" class="theme-choice ${look.theme === theme.id ? "on" : ""}" data-action="pick-theme" data-theme="${theme.id}">
          <strong>${esc(theme.name)}</strong>
          <span>${esc(theme.font)}</span>
          <em>${esc(theme.note)}</em>
        </button>`).join("")}
      </div>`;
    actions = modalButtons([["close-modal", "Fermer", "primary"]]);
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

function caretOf(el) {
  try {
    return el && typeof el.selectionStart === "number" ? el.selectionStart : null;
  } catch (err) {
    return null;
  }
}

function renderKeepingFocus() {
  const active = document.activeElement;
  const bind = active && active.dataset ? active.dataset.bind : null;
  const caret = caretOf(active);
  render();
  if (!bind) return;
  const next = document.querySelector('[data-bind="' + CSS.escape(bind) + '"]');
  if (!next) return;
  next.focus({ preventScroll: true });
  if (caret != null && next.setSelectionRange) {
    try { next.setSelectionRange(caret, caret); } catch (err) { /* number input */ }
  }
}

function onField(event) {
  const el = event.target.closest("[data-bind]");
  if (!el) return;
  const type = el.dataset.type || "text";
  if (event.type === "change" && (type === "number" || (type === "text" && el.tagName !== "SELECT"))) return;
  let value = el.value;
  let holdModel = false;
  if (type === "check") value = el.checked;
  else if (type === "number") {
    const cleaned = cleanAmount(el.value);
    if (cleaned !== el.value) {
      const caret = caretOf(el);
      el.value = cleaned;
      if (caret != null && el.setSelectionRange) {
        const pos = Math.max(0, Math.min(cleaned.length, caret - 1));
        try { el.setSelectionRange(pos, pos); } catch (err) { /* champ déjà remplacé */ }
      }
    }
    state.editing = { bind: el.dataset.bind, raw: cleaned };
    const parsed = parseAmount(cleaned);
    if (parsed.invalid) return;
    if (parsed.empty) value = null;
    else if (parsed.value == null) holdModel = true;
    else value = parsed.value;
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
  if (!holdModel) {
    if (bind.startsWith("draft.")) setByPath(state, bind, value);
    else {
      setByPath(state.data, bind, value);
      persist();
    }
  }
  if (state.page === "settings" || state.page === "profile") {
    refreshSide(allRows());
    return;
  }
  if (type === "number") {
    renderKeepingFocus();
    return;
  }
  if (el.tagName === "SELECT" || type === "check" || (type === "month" && event.type === "change")) {
    render();
    return;
  }
  refreshSide(allRows());
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
  document.body.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) event.preventDefault();
  });
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("input", onField);
  document.body.addEventListener("change", onField);
  document.body.addEventListener("focusout", (event) => {
    const el = event.target;
    if (!el || !el.dataset || el.dataset.type !== "number") return;
    const bind = el.dataset.bind;
    setTimeout(() => {
      if (!state.editing || state.editing.bind !== bind) return;
      commitEditing();
      persist();
      const active = document.activeElement;
      const typing = active && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA");
      if (typing) refreshSide(allRows());
      else render();
    }, 0);
  });
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
