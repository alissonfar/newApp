const express = require('express');
const router = express.Router();
const ImportacaoController = require('../controllers/importacaoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const autenticacao = require('../middlewares/autenticacao');
const transacaoImportadaController = require('../controllers/transacaoImportadaController');

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        try {
            await fs.mkdir('uploads/importacao', { recursive: true });
            cb(null, 'uploads/importacao');
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
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1
    },
    fileFilter: function (req, file, cb) {
        const filetypes = /json|csv/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Apenas arquivos JSON e CSV são permitidos'));
    }
});

// Middleware de autenticação para todas as rotas
router.use(autenticacao);

// Rotas de Importação
router.post('/', upload.single('arquivo'), ImportacaoController.criar);
router.get('/', ImportacaoController.listar);
router.get('/:id', ImportacaoController.obterDetalhes);
router.delete('/:id', ImportacaoController.excluir);
router.put('/:id/finalizar', ImportacaoController.finalizarImportacao);
router.put('/:id/estornar', ImportacaoController.estornarImportacao);

// Rotas de Transações Importadas
router.get('/:importacaoId/transacoes', transacaoImportadaController.listarTransacoes);
router.put('/transacoes/:id', transacaoImportadaController.atualizarTransacao);
router.post('/transacoes/:id/validar', transacaoImportadaController.validarTransacao);
router.post('/transacoes/:id/erro', transacaoImportadaController.marcarErro);
router.delete('/transacoes/:id', transacaoImportadaController.excluirTransacao);
router.post('/transacoes/validar-multiplas', transacaoImportadaController.validarMultiplas);

module.exports = router; 