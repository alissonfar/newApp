// src/services/encryptionService.js
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH_BYTES = 32;

function getKey() {
  const raw = process.env.PLUGGY_ENC_KEY;
  if (!raw) {
    throw new Error(
      'PLUGGY_ENC_KEY nao definida no .env. Defina uma chave de 64 caracteres hex (32 bytes).'
    );
  }
  const key = Buffer.from(raw.trim(), 'hex');
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `PLUGGY_ENC_KEY invalida: esperado ${KEY_LENGTH_BYTES} bytes (64 hex chars), recebido ${key.length} bytes.`
    );
  }
  return key;
}

function encrypt(plaintext) {
  if (plaintext == null) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decrypt(payload) {
  if (payload == null || payload === '') return null;
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + 16) {
    throw new Error('Payload criptografado invalido (tamanho).');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ct = buf.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

function mask(value) {
  if (!value) return '';
  const s = String(value);
  if (s.length <= 10) return '*'.repeat(s.length);
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

module.exports = { encrypt, decrypt, mask };
