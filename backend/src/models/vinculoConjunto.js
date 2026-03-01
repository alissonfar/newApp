// src/models/vinculoConjunto.js
const mongoose = require('mongoose');

const VinculoConjuntoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true },
  participante: { type: String, required: true },
  descricao: { type: String },
  ativo: { type: Boolean, default: true },
  criadoEm: { type: Date, default: Date.now }
});

VinculoConjuntoSchema.index({ usuario: 1, nome: 1 }, { unique: true });
VinculoConjuntoSchema.index({ usuario: 1, ativo: 1 });

module.exports = mongoose.model('VinculoConjunto', VinculoConjuntoSchema);
