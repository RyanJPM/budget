/* Reconstitue les polices à partir des morceaux texte, avant de lancer l'application. */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "src", "fonts");
const groups = new Map();
for (const name of fs.readdirSync(dir)) {
  const match = name.match(/^(.+)\.b64\.(\d+)$/);
  if (!match) continue;
  if (!groups.has(match[1])) groups.set(match[1], []);
  groups.get(match[1]).push(name);
}
for (const [stem, parts] of groups) {
  parts.sort();
  const packed = parts.map((part) => fs.readFileSync(path.join(dir, part), "utf8").trim()).join("");
  fs.writeFileSync(path.join(dir, stem + ".woff2"), Buffer.from(packed, "base64"));
}
