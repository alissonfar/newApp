const express = require('express');
const router = express.Router();
const everestNoteController = require('../controllers/everestNoteController');
const { autenticacao } = require('../middlewares/autenticacao');
const checkRole = require('../middlewares/checkRole');

// Aplicar autenticação e verificação de role para todas as rotas neste arquivo
router.use(autenticacao);
router.use(checkRole(['everest', 'admin']));

// --- Rotas CRUD para Notas Everest ---

// POST /api/everest/notes - Criar nova nota
router.post('/', everestNoteController.createNote);

// GET /api/everest/notes - Obter todas as notas do usuário
// (Futuramente pode aceitar query params para busca, ex: /?search=termo)
router.get('/', everestNoteController.getNotes);

// GET /api/everest/notes/:id - Obter uma nota específica por ID
router.get('/:id', everestNoteController.getNoteById);

// PUT /api/everest/notes/:id - Atualizar uma nota específica
router.put('/:id', everestNoteController.updateNote);

// DELETE /api/everest/notes/:id - Deletar uma nota específica
router.delete('/:id', everestNoteController.deleteNote);

module.exports = router; 