// backend/src/routes/rotasContaFixa.js
const express = require('express');
const router = express.Router();
const contaFixaController = require('../controllers/contaFixaController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/pendencias', contaFixaController.listarPendencias);
router.post('/:id/confirmar', contaFixaController.confirmar);
router.post('/:id/pular', contaFixaController.pular);
router.post('/:id/pausar', contaFixaController.pausar);
router.post('/:id/reativar', contaFixaController.reativar);
router.get('/', contaFixaController.listar);
router.post('/', contaFixaController.criar);
router.get('/:id', contaFixaController.obterPorId);
router.put('/:id', contaFixaController.atualizar);
router.delete('/:id', contaFixaController.excluir);

module.exports = router;
