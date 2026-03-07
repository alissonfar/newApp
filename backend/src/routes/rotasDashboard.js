// src/routes/rotasDashboard.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/tag-insights', dashboardController.obterTagInsights);

module.exports = router;
