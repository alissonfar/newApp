// src/models/divisaoPreset.js
const mongoose = require('mongoose');

const ParteSchema = new mongoose.Schema({
  pessoa: { type: String, required: true, trim: true },
  percentual: { type: Number, required: true, min: 0, max: 100 }
}, { _id: false });

const DivisaoPresetSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true, trim: true },
  partes: {
    type: [ParteSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length >= 2,
      message: 'O preset precisa de pelo menos 2 partes.'
    }
  }
}, {
  timestamps: true
});

DivisaoPresetSchema.index({ usuario: 1, nome: 1 }, { unique: true });

module.exports = mongoose.model('DivisaoPreset', DivisaoPresetSchema);
