const mongoose = require('mongoose');

const EverestLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true, // Título passa a ser obrigatório no backend?
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true,
    // Validação básica de URL (pode ser mais robusta se necessário)
    match: [/^https?:\/\/.+/i, 'Por favor, insira uma URL válida começando com http ou https.']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  tags: {
    type: [String],
    default: [],
    set: tags => tags.map(tag => tag.trim().toLowerCase()) // Normalizar tags
  }
}, {
  timestamps: true
});

// Opcional: usar URL como título se título não for fornecido (removido, título agora é obrigatório)
// EverestLinkSchema.pre('save', function(next) {
//   if (!this.title) {
//     this.title = this.url;
//   }
//   next();
// });

module.exports = mongoose.model('EverestLink', EverestLinkSchema); 