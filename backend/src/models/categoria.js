const mongoose = require('mongoose');

const CategoriaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String, default: '' },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
});

// Cria um índice composto único para { nome, usuario }
CategoriaSchema.index({ nome: 1, usuario: 1 }, { unique: true });

// Configura para incluir virtuals no JSON, criando o campo "id"
CategoriaSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Categoria', CategoriaSchema);
