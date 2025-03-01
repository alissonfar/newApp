// src/models/categoria.js
const mongoose = require('mongoose');

const CategoriaSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  descricao: { type: String, default: '' }
});

// Configura para incluir virtuals no JSON, criando o campo "id"
CategoriaSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Categoria', CategoriaSchema);
