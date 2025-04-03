const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { autenticacao, isAdmin } = require('../middlewares/autenticacao');

// Aplicar autenticação e verificação de admin a todas as rotas deste arquivo
router.use(autenticacao);
router.use(isAdmin);

// Rotas de gerenciamento de usuários
router.get('/usuarios', adminController.listarUsuarios);
router.get('/usuarios/:id', adminController.obterDetalhesUsuario);
router.post('/usuarios/:id/resetar-senha', adminController.resetarSenhaUsuario);
router.put('/usuarios/:id/verify-email', adminController.verifyUserEmail);

// (Futuras rotas de admin podem ser adicionadas aqui)
// Ex: router.put('/usuarios/:id/atualizar-role', adminController.atualizarRoleUsuario);

module.exports = router; 