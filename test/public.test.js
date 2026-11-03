const test = require("node:test");
const assert = require("node:assert/strict");
const { forecast, defaultBudget, normalize, openStore, blankBudget } = require("../src/engine.js");
const { encrypt, decrypt } = require("../electron/vault.js");

function near(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 0.02, `${label}: ${actual} ≠ ${expected}`);
}

test("une installation neuve ne contient aucun chiffre personnel", () => {
  const data = defaultBudget();
  assert.equal(data.salary, 0);
  assert.equal(data.floor, 150);
  assert.equal(data.charges.length, 0);
  assert.equal(data.sales.length, 0);
  assert.equal(data.debts.length, 0);
  assert.equal(data.expenses.length, 0);
  const store = openStore(null);
  assert.equal(store.profiles[0].name, "Nouveau profil");
  assert.equal(store.profiles[0].data.salary, 0);
});

test("un prélèvement se paie en entier, premier montant puis les suivants", () => {
  const data = blankBudget(new Date("2026-10-15T12:00:00Z"));
  data.salary = 1000;
  data.expenses.push({ kind: "installment", label: "Vélo", start: "2026-10", first: 400, next: 150, count: 2 });
  const rows = forecast(data, { y: 2026, m: 10 });
  const by = Object.fromEntries(rows.map((row) => [row.id, row]));
  near(by["2026-10"].expenses, 400, "premier");
  near(by["2026-10"].reste, 600, "reste octobre");
  near(by["2026-11"].expenses, 150, "suivant");
  near(by["2026-12"].expenses, 150, "dernier");
  near(by["2027-01"].expenses, 0, "fini");
});

test("une vente entre à part de la paye", () => {
  const data = blankBudget(new Date("2026-06-01T12:00:00Z"));
  data.salary = 500;
  data.sales.push({ label: "Vélo", month: "2026-06", amount: 120 });
  const june = forecast(data, { y: 2026, m: 6 })[0];
  near(june.salary, 500, "paye");
  near(june.sales, 120, "vente");
  near(june.reste, 620, "reste");
});

test("un ancien fichier mac et pc ne migre qu'une fois", () => {
  const data = {
    start: "2026-01",
    charges: [],
    mac: { sold: true, month: "2026-01", price: 100 },
    pc: { first: 40, next: 30, count: 1 },
  };
  normalize(data);
  normalize(data);
  assert.equal(data.sales.length, 1);
  assert.equal(data.expenses.length, 1);
  assert.equal(data.mac, undefined);
});

test("sauter novembre décale le prélèvement, sans l'annuler", () => {
  const data = blankBudget(new Date("2026-10-15T12:00:00Z"));
  data.salary = 2000;
  data.expenses.push({
    kind: "installment",
    label: "PC",
    start: "2026-10",
    first: 400,
    next: 100,
    count: 3,
    skip: ["2026-11"],
  });
  const rows = forecast(data, { y: 2026, m: 10 });
  const by = Object.fromEntries(rows.map((row) => [row.id, row]));
  near(by["2026-10"].expenses, 400, "octobre déjà payé");
  near(by["2026-11"].expenses, 0, "novembre sauté");
  near(by["2026-12"].expenses, 100, "décembre prend la place de novembre");
  near(by["2027-01"].expenses, 100, "janvier");
  near(by["2027-02"].expenses, 100, "février, dernier décalé");
  near(by["2027-03"].expenses, 0, "terminé");
  assert.equal(by["2026-12"].expensesDetail[0].note, "prélèvement 2/4");
  assert.equal(by["2027-02"].expensesDetail[0].note, "prélèvement 4/4");
});

test("sauter un mois répété ne prolonge pas la fin", () => {
  const data = blankBudget(new Date("2026-10-15T12:00:00Z"));
  data.expenses.push({ kind: "repeat", label: "Bureau", amount: 28, start: "2026-10", end: "2026-12", skip: ["2026-11"] });
  const rows = forecast(data, { y: 2026, m: 10 });
  const by = Object.fromEntries(rows.map((row) => [row.id, row]));
  near(by["2026-10"].expenses, 28, "octobre");
  near(by["2026-11"].expenses, 0, "pause");
  near(by["2026-12"].expenses, 28, "décembre");
  near(by["2027-01"].expenses, 0, "fini");
});

test("une charge ajoutée reste une charge", () => {
  const data = blankBudget(new Date("2026-10-15T12:00:00Z"));
  data.charges.push({ name: "", amount: null, shared: false, end: "" });
  data.charges.push({ name: "Netflix", amount: 13, shared: false, end: "" });
  normalize(data);
  assert.equal(data.charges.length, 2);
  assert.equal(data.expenses.length, 0);
  near(forecast(data, { y: 2026, m: 10 })[0].charges, 13, "netflix");
});

test("sans le drapeau, une charge inconnue migre une seule fois", () => {
  const data = { start: "2026-10", charges: [{ name: "Netflix", amount: 13, end: "" }] };
  assert.equal(normalize(data), 1);
  assert.equal(data.charges.length, 0);
  assert.equal(data.expenses[0].kind, "once");
  assert.equal(data.chargesReady, true);
  normalize(data);
  assert.equal(data.expenses.length, 1);
});

test("une ancienne moitié partagée est relue", () => {
  const data = blankBudget(new Date("2026-10-15T12:00:00Z"));
  data.chargesReady = false;
  data.charges = [{ name: "Électricité", amount: 70, halfEvan: true, end: "" }];
  normalize(data);
  assert.equal(data.charges[0].shared, true);
  assert.equal("halfEvan" in data.charges[0], false);
  assert.equal(data.charges.length, 1);
});

test("minimum vide vaut 150, et zéro reste zéro", () => {
  const data = blankBudget(new Date("2026-10-15T12:00:00Z"));
  data.salary = 1000;
  data.floor = null;
  data.debts = [{ person: "A", amount: 5000, paid: 0, cap: null, mode: "Progressif", settled: false, pause: false, halfBills: false, after: "", start: "2026-10" }];
  let row = forecast(data, { y: 2026, m: 10 })[0];
  near(row.reste, 150, "plancher par défaut");
  data.floor = 0;
  row = forecast(data, { y: 2026, m: 10 })[0];
  near(row.reste, 0, "plancher zéro");
});

test("le fichier chiffré se relit seulement avec le bon mot de passe", () => {
  const packed = encrypt("secret", { name: "Essai", data: blankBudget(new Date("2026-01-01T12:00:00Z")) });
  assert.equal(decrypt("secret", packed).name, "Essai");
  assert.throws(() => decrypt("autre", packed));
});
