// src/reportEngine/reportTemplates.js

const TEMPLATES = {
  simples: {
    id: 'simples',
    name: 'Relatório Simples',
    rules: [],
    aggregation: 'default'
  },
  devedor: {
    id: 'devedor',
    name: 'Relatório de Devedor',
    rules: [
      { tagNome: 'PAGO', effect: 'subtract' },
      { tagNome: 'ESTORNADO', effect: 'ignore' },
      { tagNome: 'ESTORNADA', effect: 'ignore' },
      { tagNome: 'CANCELADO', effect: 'ignore' },
      { tagNome: 'CANCELADA', effect: 'ignore' }
    ],
    aggregation: 'devedor'
  }
};

function getTemplate(templateId) {
  return TEMPLATES[templateId] || TEMPLATES.simples;
}

function listTemplates() {
  return Object.values(TEMPLATES);
}

module.exports = { TEMPLATES, getTemplate, listTemplates };
