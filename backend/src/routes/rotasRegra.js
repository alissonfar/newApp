const express = require('express');
const router = express.Router();
const controladorRegra = require('../controllers/controladorRegra');
const autenticacao = require('../middlewares/autenticacao');

// Aplica o middleware de autenticação em todas as rotas
router.use(autenticacao);

// Rota para obter opções de campos
router.get('/opcoes', controladorRegra.obterOpcoesCampos);

// Rotas CRUD básicas
router.post('/', controladorRegra.criarRegra);
router.get('/', controladorRegra.listarRegras);
router.get('/:id', controladorRegra.obterRegraPorId);
router.put('/:id', controladorRegra.atualizarRegra);
router.delete('/:id', controladorRegra.excluirRegra);

// Rotas específicas para execução de regras
router.post('/:id/simular', controladorRegra.simularRegra);
router.post('/:id/executar', controladorRegra.executarRegra);
router.post('/:id/desfazer', controladorRegra.desfazerUltimaExecucao);

module.exports = router;