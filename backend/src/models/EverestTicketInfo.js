const mongoose = require('mongoose');

// Usar os mesmos status definidos no frontend para consistência?
// const ticketStatuses = ['Novo', 'Em Análise', 'Aguardando Cliente', 'Resolvido', 'Fechado'];

const EverestTicketInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  externalId: {
    type: String,
    trim: true,
    default: '' // ID externo opcional
  },
  client: {
    type: String,
    trim: true,
    default: '' // Cliente opcional
  },
  summary: {
    type: String,
    required: true, // Resumo é obrigatório
    trim: true
  },
  status: {
    type: String,
    trim: true,
    // Poderia adicionar um enum se quiséssemos restringir os status no backend
    // enum: ticketStatuses,
    default: 'Novo' // Ou o primeiro status da lista
  },
  steps: {
    type: String, // Para detalhes, links, etc.
    trim: true,
    default: ''
  }
  // Poderíamos adicionar campos para relacionar com Notas ou Links Everest no futuro
  // relatedNotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EverestNote' }],
  // relatedLinks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EverestLink' }]
}, {
  timestamps: true
});

module.exports = mongoose.model('EverestTicketInfo', EverestTicketInfoSchema); 