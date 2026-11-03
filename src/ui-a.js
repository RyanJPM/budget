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
  if (value < -0.001) return { text: "−" + abs.replace(/^[\u2212-]/, ""), cls: "neg" };
  return { text: E.eur(0), cls: "" };
}
