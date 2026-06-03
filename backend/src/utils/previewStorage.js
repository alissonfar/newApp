const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const PREVIEW_DIR = path.join('uploads', 'importacao', 'preview');
const TTL_MS = 60 * 60 * 1000;

async function ensureDir() {
  await fs.mkdir(PREVIEW_DIR, { recursive: true });
}

function novoPreviewId() {
  return crypto.randomBytes(16).toString('hex');
}

async function salvarPreview({ buffer, originalname }) {
  await ensureDir();
  const id = novoPreviewId();
  const ext = path.extname(originalname || '') || '';
  const safeName = `${id}${ext}`;
  const caminhoAbsoluto = path.join(PREVIEW_DIR, safeName);
  await fs.writeFile(caminhoAbsoluto, buffer);
  return { previewId: id, caminhoAbsoluto, nomeOriginal: originalname };
}

async function obterCaminhoPreview(previewId) {
  if (!previewId || !/^[a-f0-9]{32}$/i.test(previewId)) {
    throw new Error('previewId inválido.');
  }
  await ensureDir();
  const arquivos = await fs.readdir(PREVIEW_DIR);
  const match = arquivos.find(a => a.startsWith(previewId));
  if (!match) return null;
  const caminhoAbsoluto = path.join(PREVIEW_DIR, match);
  const stat = await fs.stat(caminhoAbsoluto);
  if (Date.now() - stat.mtimeMs > TTL_MS) {
    await fs.unlink(caminhoAbsoluto).catch(() => {});
    return null;
  }
  return caminhoAbsoluto;
}

async function consumirPreview(previewId, destinoDir) {
  const origem = await obterCaminhoPreview(previewId);
  if (!origem) throw new Error('Preview expirado ou inexistente. Envie o arquivo novamente.');
  await fs.mkdir(destinoDir, { recursive: true });
  const base = path.basename(origem);
  const destino = path.join(destinoDir, `${Date.now()}-${base}`);
  await fs.rename(origem, destino);
  return destino;
}

async function removerPreview(previewId) {
  const caminho = await obterCaminhoPreview(previewId);
  if (caminho) {
    await fs.unlink(caminho).catch(() => {});
  }
}

async function limparExpirados() {
  await ensureDir();
  const arquivos = await fs.readdir(PREVIEW_DIR);
  const agora = Date.now();
  let removidos = 0;
  for (const a of arquivos) {
    const caminho = path.join(PREVIEW_DIR, a);
    try {
      const stat = await fs.stat(caminho);
      if (agora - stat.mtimeMs > TTL_MS) {
        await fs.unlink(caminho);
        removidos += 1;
      }
    } catch (e) { /* ignore */ }
  }
  return removidos;
}

module.exports = {
  PREVIEW_DIR,
  TTL_MS,
  ensureDir,
  salvarPreview,
  obterCaminhoPreview,
  consumirPreview,
  removerPreview,
  limparExpirados,
  novoPreviewId
};
