const express = require('express');
const router = express.Router();
const { autenticacao, exigirAcessoLucca } = require('../../middlewares/autenticacao');
const bebeController = require('../../controllers/lucca/bebeController');
const sonoController = require('../../controllers/lucca/sonoController');

router.use(autenticacao);
router.use(exigirAcessoLucca);

router.get('/bebe', bebeController.obterBebe);
router.patch('/bebe', bebeController.atualizarBebe);

router.get('/sono', sonoController.listar);
router.post('/sono', sonoController.criar);
router.patch('/sono/:id', sonoController.atualizar);
router.delete('/sono/:id', sonoController.excluir);

module.exports = router;
