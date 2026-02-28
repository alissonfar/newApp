// src/routes/rotasInstituicao.js
const express = require('express');
const router = express.Router();
const instituicaoController = require('../controllers/instituicaoController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', instituicaoController.listar);
router.get('/:id', instituicaoController.obterPorId);
router.post('/', instituicaoController.criar);
router.put('/:id', instituicaoController.atualizar);
router.delete('/:id', instituicaoController.excluir);

module.exports = router;
