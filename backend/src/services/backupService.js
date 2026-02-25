// src/services/backupService.js
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const mongoose = require('mongoose');
const Backup = require('../models/backup');

const BACKUPS_DIR = path.join(__dirname, '..', '..', 'backups');
const COLLECTIONS = [
  'usuarios',
  'transacoes',
  'categorias',
  'tags',
  'importacoes',
  'transacaoimportadas',
  'modelorelatorios'
];

/**
 * Verifica se mongodump está disponível no PATH
 */
async function isMongodumpAvailable() {
  return new Promise((resolve) => {
    const proc = spawn('mongodump', ['--version'], { shell: true });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
    proc.stderr?.on('data', () => {});
    proc.stdout?.on('data', () => {});
    setTimeout(() => {
      proc.kill('SIGTERM');
      resolve(false);
    }, 3000);
  });
}

/**
 * Serializa documento para Extended JSON (preserva ObjectId, Date)
 */
function toExtendedJSON(doc) {
  return JSON.stringify(doc, (key, value) => {
    if (value && value._bsontype === 'ObjectID') {
      return { $oid: value.toString() };
    }
    if (value instanceof mongoose.Types.ObjectId) {
      return { $oid: value.toString() };
    }
    if (value instanceof Date) {
      return { $date: value.toISOString() };
    }
    return value;
  });
}

/**
 * Converte Extended JSON de volta para tipos BSON
 */
function fromExtendedJSON(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj.$oid) {
    return new mongoose.Types.ObjectId(obj.$oid);
  }
  if (obj.$date) {
    return new Date(obj.$date);
  }
  const result = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = fromExtendedJSON(v);
  }
  return result;
}

/**
 * Gera backup via mongodump (quando disponível)
 */
async function backupViaMongodump(userId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-mongodump-${timestamp}.gz`;
  const filePath = path.join(BACKUPS_DIR, filename);

  await fs.mkdir(BACKUPS_DIR, { recursive: true });

  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    throw new Error('DB_URI não configurada');
  }

  return new Promise((resolve, reject) => {
    const args = [
      `--uri=${dbUri}`,
      `--archive=${filePath}`,
      '--gzip'
    ];
    const proc = spawn('mongodump', args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', async (code) => {
      if (code !== 0) {
        try { await fs.unlink(filePath); } catch (_) {}
        reject(new Error(`mongodump falhou: ${stderr || 'erro desconhecido'}`));
        return;
      }
      const stats = await fs.stat(filePath);
      resolve({ filePath, filename, size: stats.size });
    });
    proc.on('error', (err) => {
      reject(new Error(`mongodump não executável: ${err.message}`));
    });
  });
}

/**
 * Gera backup lógico (fallback quando mongodump não disponível)
 */
async function backupViaLogical(userId) {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Conexão com MongoDB não estabelecida');
  }

  const databaseName = db.databaseName;
  const metadata = {
    createdAt: new Date().toISOString(),
    version: '1.0',
    database: databaseName,
    type: 'logical'
  };

  const collections = {};
  const collectionCounts = {};

  for (const collName of COLLECTIONS) {
    try {
      const coll = db.collection(collName);
      const docs = await coll.find({}).toArray();
      collections[collName] = docs.map((doc) => JSON.parse(toExtendedJSON(doc)));
      collectionCounts[collName] = docs.length;
    } catch (err) {
      console.warn(`Collection ${collName} não encontrada ou erro:`, err.message);
      collections[collName] = [];
      collectionCounts[collName] = 0;
    }
  }

  metadata.collectionCounts = collectionCounts;

  const backupData = JSON.stringify({ metadata, collections });
  const compressed = zlib.gzipSync(Buffer.from(backupData, 'utf8'));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup-logical-${timestamp}.json.gz`;
  const filePath = path.join(BACKUPS_DIR, filename);

  await fs.mkdir(BACKUPS_DIR, { recursive: true });
  await fs.writeFile(filePath, compressed);

  return {
    filePath,
    filename,
    size: compressed.length,
    metadata
  };
}

/**
 * Orquestra a geração de backup (mongodump ou lógico)
 */
async function gerarBackup(userId) {
  await fs.mkdir(BACKUPS_DIR, { recursive: true });

  let result;
  let backupType = 'logical';

  const mongodumpAvailable = await isMongodumpAvailable();
  if (mongodumpAvailable) {
    try {
      result = await backupViaMongodump(userId);
      backupType = 'mongodump';
    } catch (err) {
      console.warn('mongodump falhou, usando backup lógico:', err.message);
      result = await backupViaLogical(userId);
    }
  } else {
    result = await backupViaLogical(userId);
  }

  const backupRecord = new Backup({
    filename: result.filename,
    size: result.size,
    type: backupType,
    createdBy: userId,
    status: 'success',
    metadata: result.metadata || { database: mongoose.connection.db?.databaseName }
  });
  await backupRecord.save();

  return {
    filename: result.filename,
    size: result.size,
    type: backupType
  };
}

/**
 * Gera backup pré-restore (segurança)
 */
async function gerarBackupPreRestore(userId) {
  return gerarBackup(userId);
}

/**
 * Restaura backup mongodump via mongorestore
 */
async function restaurarViaMongodump(filePath) {
  const dbUri = process.env.DB_URI;
  if (!dbUri) {
    throw new Error('DB_URI não configurada');
  }

  return new Promise((resolve, reject) => {
    const args = [
      `--uri=${dbUri}`,
      `--archive=${filePath}`,
      '--gzip',
      '--drop'
    ];
    const proc = spawn('mongorestore', args, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`mongorestore falhou: ${stderr || 'erro desconhecido'}`));
        return;
      }
      resolve();
    });
    proc.on('error', (err) => {
      reject(new Error(`mongorestore não executável: ${err.message}`));
    });
  });
}

/**
 * Restaura backup lógico (JSON)
 * @param {string} filePath - Caminho do arquivo
 * @param {boolean} isGzipped - Se true, descompacta com gzip antes de parsear
 */
async function restaurarViaLogical(filePath, isGzipped) {
  let raw = await fs.readFile(filePath);
  const content = isGzipped
    ? zlib.gunzipSync(raw).toString('utf8')
    : raw.toString('utf8');
  const data = JSON.parse(content);

  if (!data.metadata || !data.collections) {
    throw new Error('Estrutura de backup inválida: metadata e collections obrigatórios');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Conexão com MongoDB não estabelecida');
  }

  for (const [collName, docs] of Object.entries(data.collections)) {
    if (!Array.isArray(docs) || docs.length === 0) continue;

    const coll = db.collection(collName);
    await coll.deleteMany({});
    const converted = docs.map((d) => fromExtendedJSON(d));
    if (converted.length > 0) {
      await coll.insertMany(converted, { ordered: false });
    }
  }
}

/**
 * Detecta tipo de arquivo e restaura
 */
async function restaurarBackup(filePath, userId) {
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw new Error('Arquivo inválido');
  }

  const buffer = Buffer.alloc(2);
  const fd = await fs.open(filePath, 'r');
  await fd.read(buffer, 0, 2, 0);
  await fd.close();

  const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;

  await gerarBackupPreRestore(userId);

  let restoredType = 'logical';
  if (isGzip) {
    try {
      await restaurarViaMongodump(filePath);
      restoredType = 'mongodump';
    } catch (mongorestoreErr) {
      try {
        await restaurarViaLogical(filePath, true);
      } catch (logicalErr) {
        await Backup.create({
          filename: path.basename(filePath),
          size: stats.size,
          type: 'mongodump',
          operation: 'restore',
          createdBy: userId,
          status: 'error',
          errorMessage: `${mongorestoreErr.message}; ${logicalErr.message}`
        });
        throw new Error(
          `Restore falhou. mongorestore: ${mongorestoreErr.message}. ` +
          `Logical: ${logicalErr.message}`
        );
      }
    }
  } else {
    await restaurarViaLogical(filePath, false);
  }

  await Backup.create({
    filename: path.basename(filePath),
    size: stats.size,
    type: restoredType,
    operation: 'restore',
    createdBy: userId,
    status: 'success'
  });
}

/**
 * Lista backups com paginação (apenas operações de backup, não restore)
 */
async function listarBackups(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const query = { operation: 'backup' };
  const [backups, total] = await Promise.all([
    Backup.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'nome email')
      .lean(),
    Backup.countDocuments(query)
  ]);
  return { backups, total, page, limit };
}

/**
 * Retorna caminho do arquivo de backup para download
 */
async function obterCaminhoBackup(filename) {
  const safeName = path.basename(filename);
  if (safeName !== filename || safeName.includes('..')) {
    throw new Error('Nome de arquivo inválido');
  }
  const filePath = path.join(BACKUPS_DIR, safeName);
  await fs.access(filePath);
  return filePath;
}

module.exports = {
  gerarBackup,
  restaurarBackup,
  listarBackups,
  obterCaminhoBackup,
  BACKUPS_DIR
};
