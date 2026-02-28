// src/controllers/taxaCDIController.js
const taxaCDIService = require('../services/taxaCDIService');

exports.obterTaxaAtual = async (req, res) => {
  try {
    const taxa = await taxaCDIService.obterOuAtualizarTaxaAtual();
    if (!taxa) {
      return res.json({ taxa: null, mensagem: 'Taxa CDI não disponível no momento.' });
    }
    res.json({
      taxa: {
        data: taxa.data,
        taxaDiaria: taxa.taxaDiaria,
        taxaMensal: taxa.taxaMensal,
        taxaAnual: taxa.taxaAnual,
        fonte: taxa.fonte
      }
    });
  } catch (error) {
    console.error('[TaxaCDIController] Erro:', error);
    res.json({ taxa: null, mensagem: 'Taxa CDI não disponível no momento.' });
  }
};
