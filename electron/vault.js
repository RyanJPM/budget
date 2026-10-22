const crypto = require("crypto");

function encrypt(password, payload) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(String(password), salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encoded = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    app: "budget",
    version: 1,
    encrypted: true,
    kdf: "scrypt",
    cipher: "aes-256-gcm",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encoded.toString("base64"),
  };
}

function decrypt(password, packed) {
  if (!packed || packed.app !== "budget" || !packed.encrypted) {
    throw new Error("fichier");
  }
  const salt = Buffer.from(packed.salt, "base64");
  const iv = Buffer.from(packed.iv, "base64");
  const tag = Buffer.from(packed.tag, "base64");
  const key = crypto.scryptSync(String(password), salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(Buffer.from(packed.data, "base64")), decipher.final()]).toString("utf8");
  return JSON.parse(json);
}

module.exports = { encrypt, decrypt };
