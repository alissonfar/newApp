// src/reportEngine/types.js

const TagEffect = {
  IGNORE: 'ignore',
  SUBTRACT: 'subtract',
  ADD: 'add',
  CUSTOM: 'custom'
};

/**
 * @typedef {Object} TagBehavior
 * @property {string} tagNome - Nome da tag para resolver em runtime
 * @property {string} tagCodigo - Código da tag (alternativa a tagNome)
 * @property {string} effect - TagEffect
 */

/**
 * @typedef {Object} ReportTemplate
 * @property {string} id
 * @property {string} name
 * @property {TagBehavior[]} rules
 * @property {string} aggregation - 'default' | 'devedor' | etc.
 */

module.exports = { TagEffect };
