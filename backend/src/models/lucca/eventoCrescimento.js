const mongoose = require('mongoose');

const EventoCrescimentoSchema = new mongoose.Schema({
  bebeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bebe', required: true },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  data: { type: Date, required: true },
  pesoGramas: { type: Number },
  alturaCm: { type: Number },
  perimetroCefalicoCm: { type: Number },
  observacoes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('EventoCrescimento', EventoCrescimentoSchema);
