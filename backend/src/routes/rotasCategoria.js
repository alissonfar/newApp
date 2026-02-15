// src/routes/rotasCategoria.js
const express = require('express');
const router = express.Router();
const controladorCategoria = require('../controllers/controladorCategoria');
const { autenticacao } = require('../middlewares/autenticacao'); // Protege as rotas

router.use(autenticacao);

// Listar todas as categorias
router.get('/', controladorCategoria.obterTodasCategorias);

// Obter uma categoria por ID
router.get('/:id', controladorCategoria.obterCategoriaPorId);

// Criar uma nova categoria
router.post('/', controladorCategoria.criarCategoria);

// Ativar/Inativar categoria (rotas específicas antes do PUT genérico)
router.put('/:id/ativar', controladorCategoria.ativarCategoria);
router.put('/:id/inativar', controladorCategoria.inativarCategoria);

// Atualizar uma categoria
router.put('/:id', controladorCategoria.atualizarCategoria);

// Excluir uma categoria
router.delete('/:id', controladorCategoria.excluirCategoria);

module.exports = router;
