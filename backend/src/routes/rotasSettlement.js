// src/routes/rotasSettlement.js
const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', settlementController.listar);
router.get('/recebimentos-disponiveis', settlementController.listarRecebimentosDisponiveis);
router.get('/pendentes', settlementController.listarPendentes);
router.post('/', settlementController.criar);
router.delete('/:id', settlementController.excluir);

module.exports = router;
