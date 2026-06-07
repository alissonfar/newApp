// src/routes/rotasPluggy.js
const express = require('express');
const router = express.Router();
const { autenticacao } = require('../middlewares/autenticacao');
const pluggyController = require('../controllers/pluggyController');

router.use(autenticacao);

router.get('/config', pluggyController.obterConfig);
router.post('/config', pluggyController.salvarConfig);
router.post('/test-connection', pluggyController.testarConexao);

router.get('/items', pluggyController.listarItems);
router.get('/items/:itemId/accounts', pluggyController.listarAccountsDoItem);
router.post('/items', pluggyController.adicionarItem);
router.delete('/items/:itemId/:accountId', pluggyController.removerItem);
router.post('/items/:itemId/refresh-status', pluggyController.atualizarStatusItem);

router.post('/sync', pluggyController.iniciarSync);
router.get('/importacoes', pluggyController.listarImportacoes);
router.get('/importacoes/:id', pluggyController.obterDetalhes);

router.post('/connect-token', pluggyController.criarConnectToken);
router.post('/items/accounts', pluggyController.obterAccountsDoItem);
router.get('/sync-status', pluggyController.obterStatusSync);

module.exports = router;
