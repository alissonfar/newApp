// src/controllers/dashboardController.js
const tagInsightsService = require('../services/tagInsightsService');

exports.obterTagInsights = async (req, res) => {
  try {
    const insights = await tagInsightsService.calcularTagInsights(req.userId);
    res.json(insights);
  } catch (error) {
    console.error('Erro ao obter tag insights:', error);
    res.status(500).json({ erro: 'Erro ao obter insights de tags.', detalhe: error.message });
  }
};
