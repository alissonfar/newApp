// src/controllers/acertoController.js
const vinculoService = require('../services/vinculoService');

exports.estornar = async (req, res) => {
  try {
    await vinculoService.estornarAcerto(req.params.id, req.userId);
    res.json({ mensagem: 'Acerto estornado com sucesso.' });
  } catch (error) {
    console.error('[Acerto] Erro ao estornar:', error);
    res.status(400).json({ erro: error.message || 'Erro ao estornar acerto.' });
  }
};
