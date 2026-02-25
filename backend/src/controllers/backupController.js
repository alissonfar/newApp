// src/controllers/backupController.js
const fs = require('fs').promises;
const backupService = require('../services/backupService');

/**
 * POST /api/admin/backup
 * Gera backup e retorna filename + size
 */
async function gerarBackup(req, res) {
  try {
    const result = await backupService.gerarBackup(req.userId);
    const sizeMB = (result.size / (1024 * 1024)).toFixed(2);
    res.status(200).json({
      success: true,
      file: result.filename,
      size: result.size < 1024
        ? `${result.size} bytes`
        : result.size < 1024 * 1024
          ? `${(result.size / 1024).toFixed(2)} KB`
          : `${sizeMB} MB`,
      type: result.type
    });
  } catch (error) {
    console.error('Erro ao gerar backup:', error);
    res.status(500).json({
      success: false,
      erro: error.message || 'Erro ao gerar backup'
    });
  }
}

/**
 * POST /api/admin/restore
 * Recebe arquivo via multer, valida e restaura
 */
async function restaurarBackup(req, res) {
  const filePath = req.file?.path;
  try {
    if (!req.file || !filePath) {
      return res.status(400).json({
        success: false,
        erro: 'Nenhum arquivo enviado. Use o campo "arquivo" no form-data.'
      });
    }

    await backupService.restaurarBackup(filePath, req.userId);

    res.status(200).json({
      success: true,
      mensagem: 'Restauração concluída com sucesso. Backup pré-restore foi gerado automaticamente.'
    });
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    res.status(500).json({
      success: false,
      erro: error.message || 'Erro ao restaurar backup'
    });
  } finally {
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (_) {}
    }
  }
}

/**
 * GET /api/admin/backups
 * Lista backups com paginação
 */
async function listarBackups(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { backups, total, page: p, limit: l } = await backupService.listarBackups(page, limit);
    res.status(200).json({
      success: true,
      backups,
      total,
      page: p,
      limit: l
    });
  } catch (error) {
    console.error('Erro ao listar backups:', error);
    res.status(500).json({
      success: false,
      erro: error.message || 'Erro ao listar backups'
    });
  }
}

/**
 * GET /api/admin/backups/:filename/download
 * Download do arquivo de backup
 */
async function downloadBackup(req, res) {
  try {
    const { filename } = req.params;
    const filePath = await backupService.obterCaminhoBackup(filename);
    res.download(filePath, filename, (err) => {
      if (err && !res.headersSent) {
        console.error('Erro no download:', err);
        res.status(500).json({ success: false, erro: 'Erro ao baixar arquivo' });
      }
    });
  } catch (error) {
    console.error('Erro no download do backup:', error);
    res.status(404).json({
      success: false,
      erro: error.message || 'Arquivo não encontrado'
    });
  }
}

module.exports = {
  gerarBackup,
  restaurarBackup,
  listarBackups,
  downloadBackup
};
