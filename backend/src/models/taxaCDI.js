// src/models/taxaCDI.js
// Coleção global - NÃO por usuário. Compartilhada por todos.
const mongoose = require('mongoose');

const TaxaCDISchema = new mongoose.Schema({
  data: { type: Date, required: true, unique: true },
  taxaDiaria: { type: Number, required: true },
  taxaMensal: { type: Number, required: true },
  taxaAnual: { type: Number, required: true },
  fonte: { type: String, default: 'api.bcb.gov.br' }
}, {
  timestamps: true
});

TaxaCDISchema.index({ data: -1 });

module.exports = mongoose.model('TaxaCDI', TaxaCDISchema);
