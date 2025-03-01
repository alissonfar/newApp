// src/routes/rotasTransacao.js

const express = require('express');
const router = express.Router();
const controladorTransacao = require('../controllers/controladorTransacao');

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

module.exports = router;
