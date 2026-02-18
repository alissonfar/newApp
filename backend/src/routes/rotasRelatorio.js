// src/routes/rotasRelatorio.js
const express = require('express');
const router = express.Router();
const controladorRelatorioAvancado = require('../controllers/controladorRelatorioAvancado');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

// POST /api/reports/advanced - Gerar relatório avançado
router.post('/advanced', controladorRelatorioAvancado.gerarRelatorioAvancado);

// GET /api/reports/templates - Listar templates disponíveis
router.get('/templates', controladorRelatorioAvancado.listarTemplates);

module.exports = router;
