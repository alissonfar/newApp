// src/models/tag.js
const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String, default: '' },
  categoria: { type: String, required: true }
});

// Adiciona virtual para que o JSON inclua o campo "id" (baseado em _id)
TagSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Tag', TagSchema);
