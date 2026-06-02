// src/routes/rotasTransacao.js
const express = require('express');
const router = express.Router();
const controladorTransacao = require('../controllers/controladorTransacao');
const { autenticacao } = require('../middlewares/autenticacao'); // Middleware de autenticação

// Aplica o middleware de autenticação em todas as rotas
router.use(autenticacao);

// Listar todas as transações
router.get('/', controladorTransacao.obterTodasTransacoes);

// Exportar transações (filtros na query, sem paginação)
router.get('/export', controladorTransacao.obterTransacoesExport);

// Pessoas distintas (para filtros)
router.get('/distinct-pessoas', controladorTransacao.obterPessoasDistintas);

// Preview de parcelas (antes de criar)
router.get('/preview-parcelas', controladorTransacao.previewParcelas);

// Preview de parcelas via POST (para payloads grandes com pagamentos)
router.post('/preview-parcelas', controladorTransacao.previewParcelasPost);

// Obter transações de um grupo pai
router.get('/grupo/:parentTransactionId', controladorTransacao.obterTransacoesPorGrupo);

// Obter uma transação por ID
router.get('/:id', controladorTransacao.obterTransacaoPorId);

// Criar uma nova transação
router.post('/', controladorTransacao.criarTransacao);

// Reativar transação estornada (antes de PUT /:id)
router.put('/reativar/:id', controladorTransacao.reativarTransacao);

// Atualizar uma transação
router.put('/:id', controladorTransacao.atualizarTransacao);

// Estornar grupo pai inteiro (todas as transações com mesmo parentTransactionId)
router.delete('/transacao-pai/:parentTransactionId', controladorTransacao.estornarGrupoPai);

// Estornar parcelamento inteiro (por installmentGroupId)
router.delete('/parcelamento/:installmentGroupId', controladorTransacao.estornarParcelamento);

// "Excluir" (estornar) uma transação
router.delete('/:id', controladorTransacao.excluirTransacao);

// Registrar transações em massa
router.post('/bulk', controladorTransacao.registrarTransacoesEmMassa);

module.exports = router;
