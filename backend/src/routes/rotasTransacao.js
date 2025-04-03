// src/routes/rotasTransacao.js
const express = require('express');
const router = express.Router();
const controladorTransacao = require('../controllers/controladorTransacao');
const { autenticacao } = require('../middlewares/autenticacao'); // Middleware de autenticação

// Aplica o middleware de autenticação em todas as rotas
router.use(autenticacao);

// Listar todas as transações
router.get('/', controladorTransacao.obterTodasTransacoes);

// Obter uma transação por ID
router.get('/:id', controladorTransacao.obterTransacaoPorId);

// Criar uma nova transação
router.post('/', controladorTransacao.criarTransacao);

// Atualizar uma transação
router.put('/:id', controladorTransacao.atualizarTransacao);

// "Excluir" (estornar) uma transação
router.delete('/:id', controladorTransacao.excluirTransacao);

// Registrar transações em massa
router.post('/bulk', controladorTransacao.registrarTransacoesEmMassa);

module.exports = router;
