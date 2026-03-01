// src/routes/rotasVinculoConjunto.js
const express = require('express');
const router = express.Router();
const vinculoConjuntoController = require('../controllers/vinculoConjuntoController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', vinculoConjuntoController.listar);
router.post('/', vinculoConjuntoController.criar);
router.get('/:id/saldo', vinculoConjuntoController.obterSaldo);
router.get('/:id/resumo', vinculoConjuntoController.obterResumo);
router.get('/:id/transacoes', vinculoConjuntoController.listarTransacoes);
router.get('/:id/acertos', vinculoConjuntoController.listarAcertos);
router.post('/:id/acertos', vinculoConjuntoController.registrarAcerto);
router.get('/:id', vinculoConjuntoController.obterPorId);
router.put('/:id', vinculoConjuntoController.atualizar);
router.delete('/:id', vinculoConjuntoController.excluir);

module.exports = router;
