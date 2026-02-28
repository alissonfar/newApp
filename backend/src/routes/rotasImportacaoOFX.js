// src/routes/rotasImportacaoOFX.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const { autenticacao } = require('../middlewares/autenticacao');
const importacaoOFXController = require('../controllers/importacaoOFXController');

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      await fs.mkdir('uploads/importacao-ofx', { recursive: true });
      cb(null, 'uploads/importacao-ofx');
    } catch (error) {
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: function (req, file, cb) {
    const allowedExts = /\.(ofx|qfx)$/i;
    const extOk = allowedExts.test(path.extname(file.originalname));
    const mimeOk = [
      'application/x-ofx',
      'application/vnd.intu.qfx',
      'text/xml',
      'application/xml',
      'text/plain'
    ].includes(file.mimetype);
    if (extOk || mimeOk) return cb(null, true);
    cb(new Error('Apenas arquivos OFX ou QFX são permitidos'));
  }
});

router.use(autenticacao);

router.post('/', upload.single('arquivo'), importacaoOFXController.upload);
router.get('/', importacaoOFXController.listar);
router.get('/:id', importacaoOFXController.obterDetalhes);
router.get('/:id/transacoes/:transacaoOFXId/sugestoes-transferencia', importacaoOFXController.sugerirTransferencias);
router.patch('/:id/transacoes/:transacaoOFXId', importacaoOFXController.atualizarTransacao);
router.post('/:id/transacoes/:transacaoOFXId/criar-transacao', importacaoOFXController.criarTransacao);
router.post('/:id/finalizar', importacaoOFXController.finalizar);
router.delete('/:id', importacaoOFXController.cancelar);

module.exports = router;
