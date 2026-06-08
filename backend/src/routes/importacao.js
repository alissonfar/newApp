const express = require('express');
const router = express.Router();
const ImportacaoController = require('../controllers/importacaoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { autenticacao } = require('../middlewares/autenticacao');
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

const fileFilter = function (req, file, cb) {
    const allowedTypes = [
        'text/csv',
        'application/csv',
        'text/plain',
        'application/json',
        'text/json',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    const allowedExts = /\.json$|\.csv$|\.xlsx$/i;
    const extname = allowedExts.test(path.extname(file.originalname));
    const mimetype = allowedTypes.includes(file.mimetype);
    if (extname || mimetype) {
        return cb(null, true);
    }
    cb(new Error('Apenas arquivos JSON, CSV ou XLSX são permitidos'));
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    },
    fileFilter: fileFilter
});

// Multer para preview — usa arquivo temporário em uploads/importacao (será movido para preview/ no controller)
const uploadPreview = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1
    },
    fileFilter: fileFilter
});

// Middleware de autenticação para todas as rotas
router.use(autenticacao);

// Rotas de Importação
router.post('/preview', uploadPreview.single('arquivo'), ImportacaoController.previewArquivo);
router.delete('/preview/:previewId', ImportacaoController.cancelarPreview);
router.post('/', upload.single('arquivo'), ImportacaoController.criar);
router.get('/', ImportacaoController.listar);
router.get('/:id', ImportacaoController.obterDetalhes);
router.post('/:id/duplicate', ImportacaoController.duplicar);
router.delete('/:id', ImportacaoController.excluir);
router.put('/:id/finalizar', ImportacaoController.finalizarImportacao);
router.put('/:id/estornar', ImportacaoController.estornarImportacao);
router.post('/from-pluggy', ImportacaoController.criarDaPluggy);
router.post('/preview-pluggy', ImportacaoController.previewPluggy);

// Rotas de Transações Importadas
router.get('/:importacaoId/transacoes', transacaoImportadaController.listarTransacoes);
router.post('/transacoes/acoes-massa', transacaoImportadaController.acoesMassa);
router.put('/transacoes/:id', transacaoImportadaController.atualizarTransacao);
router.post('/transacoes/:id/validar', transacaoImportadaController.validarTransacao);
router.post('/transacoes/:id/erro', transacaoImportadaController.marcarErro);
router.delete('/transacoes/:id', transacaoImportadaController.excluirTransacao);
router.post('/transacoes/:id/restaurar', transacaoImportadaController.restaurarTransacao);
router.post('/transacoes/validar-multiplas', transacaoImportadaController.validarMultiplas);

module.exports = router; 