// src/controllers/netWorthController.js
const netWorthService = require('../services/netWorthService');

/**
 * GET /net-worth/at-date?date=YYYY-MM-DD&subcontaIds=id1,id2&tipo=corrente&origem=importacao_ofx
 */
exports.patrimonioEmData = async (req, res) => {
  try {
    const dateParam = req.query.date;
    const data = dateParam ? new Date(dateParam) : new Date();

    const filtros = {};
    if (req.query.subcontaIds) {
      filtros.subcontaIds = Array.isArray(req.query.subcontaIds)
        ? req.query.subcontaIds
        : req.query.subcontaIds.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (req.query.tipo) filtros.tipoConta = req.query.tipo;
    if (req.query.proposito) filtros.proposito = req.query.proposito;
    if (req.query.origem) filtros.origemSistema = req.query.origem;

    const resultado = await netWorthService.patrimonioEmData(req.userId, data, filtros);
    res.json(resultado);
  } catch (error) {
    console.error('Erro ao obter patrimônio em data:', error);
    res.status(500).json({ erro: 'Erro ao obter patrimônio na data especificada.' });
  }
};

/**
 * GET /net-worth/history?startDate=...&endDate=...&interval=month|day|week|year&...
 */
exports.evolucaoPatrimonio = async (req, res) => {
  try {
    let startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const interval = req.query.interval || 'month';

    if (!startDate) {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    const opts = {
      startDate,
      endDate,
      interval
    };

    if (req.query.subcontaIds) {
      opts.subcontaIds = Array.isArray(req.query.subcontaIds)
        ? req.query.subcontaIds
        : req.query.subcontaIds.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (req.query.tipo) opts.tipoConta = req.query.tipo;
    if (req.query.proposito) opts.proposito = req.query.proposito;
    if (req.query.origem) opts.origemSistema = req.query.origem;

    const resultado = await netWorthService.evolucaoPatrimonio(req.userId, opts);
    res.json(resultado);
  } catch (error) {
    console.error('Erro ao obter evolução patrimônio:', error);
    res.status(500).json({ erro: 'Erro ao obter evolução do patrimônio.' });
  }
};
