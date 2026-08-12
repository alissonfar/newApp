const express = require('express');
const router = express.Router();
const { autenticacao, exigirAcessoLucca } = require('../../middlewares/autenticacao');
const bebeController = require('../../controllers/lucca/bebeController');
const sonoController = require('../../controllers/lucca/sonoController');
const alimentacaoController = require('../../controllers/lucca/alimentacaoController');

router.use(autenticacao);
router.use(exigirAcessoLucca);

router.get('/bebe', bebeController.obterBebe);
router.patch('/bebe', bebeController.atualizarBebe);

router.get('/sono', sonoController.listar);
router.post('/sono', sonoController.criar);
router.patch('/sono/:id', sonoController.atualizar);
router.delete('/sono/:id', sonoController.excluir);

router.get('/alimentacao', alimentacaoController.listar);
router.post('/alimentacao', alimentacaoController.criar);
router.patch('/alimentacao/:id', alimentacaoController.atualizar);
router.delete('/alimentacao/:id', alimentacaoController.excluir);

module.exports = router;
