// src/controllers/taxaCDIController.js
const taxaCDIService = require('../services/taxaCDIService');

exports.obterTaxaAtual = async (req, res) => {
  try {
    const forceRefresh = req.query.force === '1' || req.query.refresh === '1';
    const taxa = await taxaCDIService.obterOuAtualizarTaxaAtual({ forceRefresh });
    if (!taxa) {
      return res.json({ taxa: null, mensagem: 'Taxa CDI não disponível no momento.' });
    }
    res.json({
      taxa: {
        data: taxa.data,
        dataUltimaAtualizacao: taxa.data,
        taxaDiaria: taxa.taxaDiaria,
        taxaMensal: taxa.taxaMensal,
        taxaAnual: taxa.taxaAnual,
        taxaMensalEquivalente: taxa.taxaMensalEquivalente,
        taxaDiariaEquivalente: taxa.taxaDiariaEquivalente,
        fonte: taxa.fonte
      }
    });
  } catch (error) {
    console.error('[TaxaCDIController] Erro:', error);
    res.json({ taxa: null, mensagem: 'Taxa CDI não disponível no momento.' });
  }
};
