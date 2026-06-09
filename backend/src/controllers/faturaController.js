const faturaService = require('../services/faturaService');

exports.obterFaturas = async (req, res) => {
  try {
    const { anoMes } = req.query;
    const faturas = await faturaService.obterFaturas(req.userId, anoMes);
    res.json(faturas);
  } catch (error) {
    console.error('Erro ao obter faturas:', error);
    res.status(500).json({ erro: 'Erro ao obter faturas.' });
  }
};
