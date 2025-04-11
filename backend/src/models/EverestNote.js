const mongoose = require('mongoose');

const EverestNoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario', // Referencia o model Usuario
    required: true,
    index: true // Indexar para buscas por usuário
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  tags: {
    type: [String], // Array de strings
    default: [],
    // Poderia adicionar validação de tags se necessário
    set: tags => tags.map(tag => tag.trim().toLowerCase()) // Normalizar tags (trim, lowercase)
  }
}, {
  timestamps: true // Adiciona createdAt e updatedAt automaticamente
});

module.exports = mongoose.model('EverestNote', EverestNoteSchema); 