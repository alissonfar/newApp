const mongoose = require('mongoose');

const EverestCnpjAccessSchema = new mongoose.Schema({
  cnpj: { // Armazenar SEMPRE sem pontuação (14 dígitos)
    type: String,
    required: [true, 'CNPJ é obrigatório'],
    trim: true,
    index: true // Essencial para busca rápida
  },
  usuario: {
    type: String,
    required: [true, 'Usuário é obrigatório'],
    trim: true
  },
  tipoOrigem: { // Identifica a aba de origem (Ex: EMISSAO, RECEBIMENTO)
    type: String,
    required: [true, 'Tipo de origem é obrigatório'],
    enum: ['EMISSAO', 'RECEBIMENTO'], // Ajustar se os nomes das abas forem diferentes
    index: true
  },
  dataUpload: { // Rastreabilidade
    type: Date,
    default: Date.now
  }
}, { timestamps: true }); // Adiciona createdAt e updatedAt automaticamente

// Índice único para garantir que um CNPJ não se repita DENTRO DA MESMA ORIGEM
EverestCnpjAccessSchema.index({ cnpj: 1, tipoOrigem: 1 }, { unique: true });

module.exports = mongoose.model('EverestCnpjAccess', EverestCnpjAccessSchema); 