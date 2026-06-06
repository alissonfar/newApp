// src/models/pessoa.js
const mongoose = require('mongoose');

const PessoaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true, trim: true },
  contato: { type: String, default: null },
  observacoes: { type: String, default: null },
  ativo: { type: Boolean, default: true }
}, {
  timestamps: true
});

PessoaSchema.index({ usuario: 1, ativo: 1 });
PessoaSchema.index({ usuario: 1, nome: 1 }, { unique: true });

module.exports = mongoose.model('Pessoa', PessoaSchema);
