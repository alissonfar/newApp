// src/models/categoria.js
const mongoose = require('mongoose');

const CategoriaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String, default: '' },
  // [NOVO] Vincula a categoria a um usuário
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
});

// Configura para incluir virtuals no JSON, criando o campo "id"
CategoriaSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Categoria', CategoriaSchema);
