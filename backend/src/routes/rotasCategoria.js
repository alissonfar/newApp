// src/routes/rotasCategoria.js
const express = require('express');
const router = express.Router();
const controladorCategoria = require('../controllers/controladorCategoria');

router.get('/', controladorCategoria.obterTodasCategorias);
router.post('/', controladorCategoria.criarCategoria);
router.put('/:id', controladorCategoria.atualizarCategoria);
router.delete('/:id', controladorCategoria.excluirCategoria);

module.exports = router;
