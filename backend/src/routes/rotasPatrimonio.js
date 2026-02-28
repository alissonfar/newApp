// src/routes/rotasPatrimonio.js
const express = require('express');
const router = express.Router();
const patrimonioController = require('../controllers/patrimonioController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/resumo', patrimonioController.obterResumo);
router.get('/evolucao', patrimonioController.obterEvolucao);

module.exports = router;
