// src/routes/rotasSubconta.js
const express = require('express');
const router = express.Router();
const subcontaController = require('../controllers/subcontaController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', subcontaController.listar);
router.post('/', subcontaController.criar);
router.get('/:id/historico', subcontaController.obterHistorico);
router.get('/:id/rendimento-estimado', subcontaController.obterRendimentoEstimado);
router.get('/:id/eventos-ledger', subcontaController.obterEventosLedger);
router.get('/:id/saldo-ledger', subcontaController.obterSaldoPorLedger);
router.post('/:id/confirmar-saldo', subcontaController.confirmarSaldo);
router.get('/:id', subcontaController.obterPorId);
router.put('/:id', subcontaController.atualizar);
router.delete('/:id', subcontaController.excluir);

module.exports = router;
