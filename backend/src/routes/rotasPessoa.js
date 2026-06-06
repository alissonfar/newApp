// src/routes/rotasPessoa.js
const express = require('express');
const router = express.Router();
const pessoaController = require('../controllers/pessoaController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', pessoaController.listar);
router.get('/:id', pessoaController.obterPorId);
router.post('/', pessoaController.criar);
router.put('/:id', pessoaController.atualizar);
router.delete('/:id', pessoaController.excluir);

module.exports = router;
