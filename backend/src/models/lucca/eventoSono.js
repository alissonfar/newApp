const mongoose = require('mongoose');

const EventoSonoSchema = new mongoose.Schema({
  bebeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bebe', required: true },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  inicio: { type: Date, required: true },
  fim: { type: Date, default: null },
  local: { type: String, enum: ['berco', 'colo', 'cama_compartilhada', 'outro'], default: 'berco' },
  observacoes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('EventoSono', EventoSonoSchema);
