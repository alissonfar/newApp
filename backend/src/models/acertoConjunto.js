// src/models/acertoConjunto.js
const mongoose = require('mongoose');

const AcertoConjuntoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  vinculo: { type: mongoose.Schema.Types.ObjectId, ref: 'VinculoConjunto', required: true },
  valor: { type: Number, required: true, min: 0.01 },
  direcao: { type: String, enum: ['recebi', 'paguei'], required: true },
  data: { type: Date, required: true },
  observacao: { type: String },
  transacoesQuitadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transacao' }],
  criadoEm: { type: Date, default: Date.now },
  tipo: {
    type: String,
    enum: ['compensacao', 'pagamento_individual'],
    default: 'compensacao'
  },
  ladoAfetado: {
    type: String,
    enum: ['usuario', 'participante'],
    required: function () {
      return this.tipo === 'pagamento_individual';
    }
  }
});

AcertoConjuntoSchema.index({ vinculo: 1, data: -1 });
AcertoConjuntoSchema.index({ usuario: 1 });

module.exports = mongoose.model('AcertoConjunto', AcertoConjuntoSchema);
