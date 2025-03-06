// src/routes/rotasTag.js
const express = require('express');
const router = express.Router();
const controladorTag = require('../controllers/controladorTag');
const autenticacao = require('../middlewares/autenticacao'); // Se você deseja proteger as rotas

// Aplica o middleware de autenticação em todas as rotas (se necessário)
router.use(autenticacao);

// Listar todas as tags
router.get('/', controladorTag.obterTodasTags);

// Obter uma tag por ID
router.get('/:id', controladorTag.obterTagPorId);

// Criar uma nova tag
router.post('/', controladorTag.criarTag);

// Atualizar uma tag
router.put('/:id', controladorTag.atualizarTag);

// Excluir uma tag
router.delete('/:id', controladorTag.excluirTag);

module.exports = router;
