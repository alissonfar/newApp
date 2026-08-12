const express = require('express');
const router = express.Router();
const { autenticacao, exigirAcessoLucca } = require('../../middlewares/autenticacao');
const bebeController = require('../../controllers/lucca/bebeController');

router.use(autenticacao);
router.use(exigirAcessoLucca);

router.get('/bebe', bebeController.obterBebe);
router.patch('/bebe', bebeController.atualizarBebe);

module.exports = router;
