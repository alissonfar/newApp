const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const adminController = require('../controllers/adminController');
const backupController = require('../controllers/backupController');
const { autenticacao, isAdmin } = require('../middlewares/autenticacao');

// Multer para upload de backup (restore)
const restoreStorage = multer.diskStorage({
  destination: async function (_req, _file, cb) {
    try {
      const dir = path.join(__dirname, '..', '..', 'tmp', 'restore');
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname) || '.gz';
    cb(null, `restore-${Date.now()}${ext}`);
  }
});

const restoreUpload = multer({
  storage: restoreStorage,
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  fileFilter: function (_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (/\.(gz|json)$/.test(ext)) return cb(null, true);
    cb(new Error('Apenas arquivos .gz ou .json são permitidos'));
  }
});

// Aplicar autenticação e verificação de admin a todas as rotas deste arquivo
router.use(autenticacao);
router.use(isAdmin);

// Rotas de backup
router.post('/backup', backupController.gerarBackup);
router.post('/restore', restoreUpload.single('arquivo'), backupController.restaurarBackup);
router.get('/backups', backupController.listarBackups);
router.get('/backups/:filename/download', backupController.downloadBackup);

// Rotas de gerenciamento de usuários
router.get('/usuarios', adminController.listarUsuarios);
router.get('/usuarios/:id', adminController.obterDetalhesUsuario);
router.post('/usuarios/:id/resetar-senha', adminController.resetarSenhaUsuario);
router.put('/usuarios/:id/verify-email', adminController.verifyUserEmail);
router.put('/usuarios/:id/role', adminController.updateUserRole);
router.put('/usuarios/:id/status', adminController.updateUserStatus);

module.exports = router; 