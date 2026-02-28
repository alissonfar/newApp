// src/routes/rotasTransferencia.js
const express = require('express');
const router = express.Router();
const transferenciaController = require('../controllers/transferenciaController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', transferenciaController.listar);
router.post('/', transferenciaController.criar);
router.get('/:id', transferenciaController.obterPorId);

module.exports = router;
