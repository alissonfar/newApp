const mongoose = require('mongoose');

const EventoFraldaSchema = new mongoose.Schema({
  bebeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bebe', required: true },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  horario: { type: Date, required: true },
  tipo: { type: String, enum: ['xixi', 'coco', 'ambos'], required: true },
  observacoes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('EventoFralda', EventoFraldaSchema);
