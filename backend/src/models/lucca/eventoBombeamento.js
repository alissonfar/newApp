const mongoose = require('mongoose');

const EventoBombeamentoSchema = new mongoose.Schema({
  bebeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bebe', required: true },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  inicio: { type: Date, required: true },
  fim: { type: Date, default: null },
  lado: { type: String, enum: ['esquerdo', 'direito', 'ambos'] },
  volumeMl: { type: Number },
  armazenadoComo: { type: String, enum: ['geladeira', 'freezer', 'uso_imediato'], default: 'geladeira' },
  observacoes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('EventoBombeamento', EventoBombeamentoSchema);
