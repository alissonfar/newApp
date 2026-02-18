// src/models/modeloRelatorio.js
const mongoose = require('mongoose');

const RegraTagSchema = new mongoose.Schema({
  tag: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true },
  effect: { type: String, enum: ['add', 'subtract', 'ignore'], required: true }
});

const ModeloRelatorioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String, default: '' },
  aggregation: { type: String, enum: ['default', 'devedor'], default: 'default' },
  regras: { type: [RegraTagSchema], default: [] },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  ativo: { type: Boolean, default: true }
}, { timestamps: true });

ModeloRelatorioSchema.index({ usuario: 1 });

module.exports = mongoose.model('ModeloRelatorio', ModeloRelatorioSchema);
