// src/routes/rotasAcertos.js
const express = require('express');
const router = express.Router();
const acertoController = require('../controllers/acertoController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);
router.delete('/:id', acertoController.estornar);

module.exports = router;
