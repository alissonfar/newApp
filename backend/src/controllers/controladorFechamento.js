// src/controllers/controladorFechamento.js
const fechamentoService = require('../services/fechamentoService');

exports.listarCadastros = async (req, res) => {
  try {
    const cadastros = await fechamentoService.listarCadastros(req.userId);
    res.json(cadastros);
  } catch (error) {
    console.error('[Fechamento] Erro ao listar cadastros:', error);
    res.status(500).json({ erro: 'Erro ao listar cadastros de Fechamento.' });
  }
};

exports.criarCadastro = async (req, res) => {
  try {
    const { pessoa, modeloRelatorio } = req.body;
    const cadastro = await fechamentoService.criarCadastro({ pessoa, modeloRelatorio }, req.userId);
    res.status(201).json(cadastro);
  } catch (error) {
    console.error('[Fechamento] Erro ao criar cadastro:', error);
    res.status(400).json({ erro: error.message || 'Erro ao criar cadastro de Fechamento.' });
  }
};

exports.listarInstancias = async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    const instancias = await fechamentoService.listarInstancias(req.userId, { dataInicio, dataFim });
    res.json(instancias);
  } catch (error) {
    console.error('[Fechamento] Erro ao listar instâncias:', error);
    res.status(500).json({ erro: 'Erro ao listar instâncias de Fechamento.' });
  }
};

exports.criarInstancia = async (req, res) => {
  try {
    const { cadastro, pessoa, modeloRelatorio, dataInicio, dataFim } = req.body;
    const instancia = await fechamentoService.criarInstancia(
      { cadastro, pessoa, modeloRelatorio, dataInicio, dataFim },
      req.userId
    );
    res.status(201).json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao criar instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao criar instância de Fechamento.' });
  }
};

exports.duplicarInstancia = async (req, res) => {
  try {
    const instancia = await fechamentoService.duplicarInstancia(req.params.id, req.userId);
    res.status(201).json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao duplicar instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao duplicar instância de Fechamento.' });
  }
};

exports.obterTransacoesDaInstancia = async (req, res) => {
  try {
    const resultado = await fechamentoService.obterTransacoesDaInstancia(req.params.id, req.userId);
    res.json(resultado);
  } catch (error) {
    console.error('[Fechamento] Erro ao obter transações da instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao obter transações da instância.' });
  }
};

exports.atualizarStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const instancia = await fechamentoService.atualizarStatus(req.params.id, status, req.userId);
    res.json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao atualizar status:', error);
    res.status(400).json({ erro: error.message || 'Erro ao atualizar status.' });
  }
};

exports.linkarRecebimento = async (req, res) => {
  try {
    const { settlementId } = req.body;
    const instancia = await fechamentoService.linkarRecebimento(req.params.id, settlementId, req.userId);
    res.json(instancia);
  } catch (error) {
    console.error('[Fechamento] Erro ao linkar recebimento:', error);
    res.status(400).json({ erro: error.message || 'Erro ao linkar recebimento.' });
  }
};

exports.excluirInstancia = async (req, res) => {
  try {
    const resultado = await fechamentoService.excluirInstancia(req.params.id, req.userId);
    res.json(resultado);
  } catch (error) {
    console.error('[Fechamento] Erro ao excluir instância:', error);
    res.status(400).json({ erro: error.message || 'Erro ao excluir instância.' });
  }
};
