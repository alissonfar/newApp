// src/models/instituicao.js
const mongoose = require('mongoose');

const InstituicaoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true },
  tipo: {
    type: String,
    enum: ['banco_digital', 'banco_tradicional', 'carteira_digital', 'corretora'],
    required: true
  },
  cor: { type: String, default: '#000000' },
  icone: { type: String, default: 'default-icon' },
  ativo: { type: Boolean, default: true }
}, {
  timestamps: true
});

InstituicaoSchema.index({ usuario: 1 });
InstituicaoSchema.index({ usuario: 1, nome: 1 }, { unique: true });

module.exports = mongoose.model('Instituicao', InstituicaoSchema);
