// src/routes/rotasDivisaoPreset.js
const express = require('express');
const router = express.Router();
const divisaoPresetController = require('../controllers/divisaoPresetController');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', divisaoPresetController.listar);
router.post('/', divisaoPresetController.criar);
router.put('/:id', divisaoPresetController.atualizar);
router.delete('/:id', divisaoPresetController.excluir);

module.exports = router;
