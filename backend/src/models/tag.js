const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String, default: '' },
  categoria: { type: String, required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
});

// Cria um índice composto único para { nome, usuario }
TagSchema.index({ nome: 1, usuario: 1 }, { unique: true });

// Adiciona virtual para que o JSON inclua o campo "id" (baseado em _id)
TagSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Tag', TagSchema);
