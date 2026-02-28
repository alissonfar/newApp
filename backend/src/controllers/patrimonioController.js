// src/controllers/patrimonioController.js
const patrimonioService = require('../services/patrimonioService');

exports.obterResumo = async (req, res) => {
  try {
    const resumo = await patrimonioService.obterResumo(req.userId);
    res.json(resumo);
  } catch (error) {
    console.error('Erro ao obter resumo patrimônio:', error);
    res.status(500).json({ erro: 'Erro ao obter resumo do patrimônio.' });
  }
};

exports.obterEvolucao = async (req, res) => {
  try {
    const dataInicio = req.query.dataInicio ? new Date(req.query.dataInicio) : null;
    const dataFim = req.query.dataFim ? new Date(req.query.dataFim) : null;
    const evolucao = await patrimonioService.obterEvolucao(req.userId, {
      dataInicio,
      dataFim
    });
    res.json(evolucao);
  } catch (error) {
    console.error('Erro ao obter evolução patrimônio:', error);
    res.status(500).json({ erro: 'Erro ao obter evolução do patrimônio.' });
  }
};
