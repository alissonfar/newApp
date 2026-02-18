// src/controllers/controladorRelatorioAvancado.js
const reportEngine = require('../reportEngine');

exports.gerarRelatorioAvancado = async (req, res) => {
  try {
    const { templateId = 'simples', filters = {}, format = 'json' } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ erro: 'Usuário não autenticado.' });
    }

    const result = await reportEngine.generateReport({
      templateId,
      filters,
      userId
    });

    if (format === 'pdf') {
      // Fase 3: PDF no backend - por ora retornamos JSON
      return res.json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Erro ao gerar relatório avançado:', error);
    res.status(500).json({
      erro: 'Erro ao gerar relatório avançado.',
      detalhe: error.message
    });
  }
};

exports.listarTemplates = async (req, res) => {
  try {
    const templates = await reportEngine.listTemplatesWithModels(req.userId);
    res.json({ templates });
  } catch (error) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({ erro: 'Erro ao listar templates.' });
  }
};
