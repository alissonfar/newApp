const mongoose = require('mongoose');

const EventoAlimentacaoSchema = new mongoose.Schema({
  bebeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bebe', required: true },
  registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  tipo: {
    type: String,
    enum: ['amamentacao', 'mamadeira_formula', 'mamadeira_leite_materno'],
    required: true
  },
  inicio: { type: Date, required: true },
  fim: { type: Date, default: null },
  lado: { type: String, enum: ['esquerdo', 'direito', 'ambos'] },
  qualidadePega: { type: String, enum: ['boa', 'dificil', 'nenhuma'] },
  volumeMl: { type: Number },
  observacoes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('EventoAlimentacao', EventoAlimentacaoSchema);
