const express = require('express');
const router = express.Router();
const everestTicketInfoController = require('../controllers/everestTicketInfoController');
const { autenticacao } = require('../middlewares/autenticacao');
const checkRole = require('../middlewares/checkRole');

// Aplicar autenticação e verificação de role para todas as rotas
router.use(autenticacao);
router.use(checkRole(['everest', 'admin']));

// --- Rotas CRUD para Ticket Info Everest ---

// POST /api/everest/ticketinfo - Criar novo registro
router.post('/', everestTicketInfoController.createTicketInfo);

// GET /api/everest/ticketinfo - Obter todos os registros do usuário
router.get('/', everestTicketInfoController.getTicketInfos);

// GET /api/everest/ticketinfo/:id - Obter um registro específico por ID
router.get('/:id', everestTicketInfoController.getTicketInfoById);

// PUT /api/everest/ticketinfo/:id - Atualizar um registro específico
router.put('/:id', everestTicketInfoController.updateTicketInfo);

// DELETE /api/everest/ticketinfo/:id - Deletar um registro específico
router.delete('/:id', everestTicketInfoController.deleteTicketInfo);

module.exports = router; 