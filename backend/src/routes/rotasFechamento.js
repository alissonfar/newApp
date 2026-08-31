// src/routes/rotasFechamento.js
const express = require('express');
const router = express.Router();
const controlador = require('../controllers/controladorFechamento');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/cadastros', controlador.listarCadastros);
router.post('/cadastros', controlador.criarCadastro);
router.get('/instancias', controlador.listarInstancias);
router.post('/instancias', controlador.criarInstancia);
router.post('/instancias/:id/duplicar', controlador.duplicarInstancia);
router.get('/instancias/:id/transacoes', controlador.obterTransacoesDaInstancia);
router.patch('/instancias/:id/status', controlador.atualizarStatus);
router.post('/instancias/:id/linkar-recebimento', controlador.linkarRecebimento);
router.delete('/instancias/:id', controlador.excluirInstancia);

module.exports = router;
