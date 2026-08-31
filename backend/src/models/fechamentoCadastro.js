// src/models/fechamentoCadastro.js
const mongoose = require('mongoose');

const FechamentoCadastroSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  pessoa: { type: mongoose.Schema.Types.ObjectId, ref: 'Pessoa', required: true },
  modeloRelatorio: { type: mongoose.Schema.Types.ObjectId, ref: 'ModeloRelatorio', required: true },
  ativo: { type: Boolean, default: true }
}, { timestamps: true });

FechamentoCadastroSchema.index({ usuario: 1, pessoa: 1 }, { unique: true });

module.exports = mongoose.model('FechamentoCadastro', FechamentoCadastroSchema);
