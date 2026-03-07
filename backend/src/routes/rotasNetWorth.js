// src/routes/rotasNetWorth.js
const express = require('express');
const router = express.Router();
const netWorthController = require('../controllers/netWorthController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/at-date', netWorthController.patrimonioEmData);
router.get('/history', netWorthController.evolucaoPatrimonio);

module.exports = router;
