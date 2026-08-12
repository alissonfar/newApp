const Bebe = require('../../models/lucca/bebe');
const dashboardService = require('../../services/lucca/dashboardService');

async function obterDashboard(req, res) {
  try {
    const bebe = await Bebe.findOne();
    if (!bebe) {
      return res.status(404).json({ erro: 'Bebê ainda não cadastrado. Rode a migration de seed.' });
    }
    const dashboard = await dashboardService.obterDashboard(bebe._id);
    res.json(dashboard);
  } catch (error) {
    console.error('Erro ao obter dashboard:', error);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { obterDashboard };
