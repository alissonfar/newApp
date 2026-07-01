// src/routes/rotasEmprestimo.js
const express = require('express');
const router = express.Router();
const emprestimoController = require('../controllers/emprestimoController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', emprestimoController.listar);
router.get('/:id', emprestimoController.obterPorId);
router.get('/:id/transacoes', emprestimoController.listarTransacoes);
router.post('/', emprestimoController.criar);
router.put('/:id', emprestimoController.atualizar);
router.post('/:id/cancelar', emprestimoController.cancelar);
router.post('/:id/reverter-quitacao', emprestimoController.reverterQuitacao);

module.exports = router;
