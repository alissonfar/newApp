// src/routes/rotasTaxaCDI.js
const express = require('express');
const router = express.Router();
const taxaCDIController = require('../controllers/taxaCDIController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/atual', taxaCDIController.obterTaxaAtual);

module.exports = router;
