const mongoose = require('mongoose');

const BebeSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  dataNascimento: { type: Date, required: true },
  idadeGestacionalNascimento: {
    semanas: { type: Number, required: true },
    dias: { type: Number, required: true, min: 0, max: 6 }
  },
  janelaVigiliaAlvoMinutos: { type: Number, default: 90 }
}, { timestamps: true });

module.exports = mongoose.model('Bebe', BebeSchema);
