const express = require('express');
const router = express.Router();
const everestLinkController = require('../controllers/everestLinkController');
const { autenticacao } = require('../middlewares/autenticacao');
const checkRole = require('../middlewares/checkRole');

// Aplicar autenticação e verificação de role para todas as rotas
router.use(autenticacao);
router.use(checkRole(['everest', 'admin']));

// --- Rotas CRUD para Links Everest ---

// POST /api/everest/links - Criar novo link
router.post('/', everestLinkController.createLink);

// GET /api/everest/links - Obter todos os links do usuário
router.get('/', everestLinkController.getLinks);

// GET /api/everest/links/:id - Obter um link específico por ID
router.get('/:id', everestLinkController.getLinkById);

// PUT /api/everest/links/:id - Atualizar um link específico
router.put('/:id', everestLinkController.updateLink);

// DELETE /api/everest/links/:id - Deletar um link específico
router.delete('/:id', everestLinkController.deleteLink);

module.exports = router; 