const mongoose = require('mongoose');

const EverestCnpjAccessSchema = new mongoose.Schema({
  cnpj: {
    type: String,
    required: true,
    unique: true, // Garante que cada CNPJ é único na coleção
    index: true,   // Index para buscas rápidas
    trim: true,
    // Poderia adicionar validação de formato de CNPJ se necessário
    match: [/^\d{14}$/, 'CNPJ deve conter 14 dígitos.'] // Validação simples de 14 dígitos
  },
  // Armazenar informações de acesso. Pode ser um objeto ou campos separados.
  // Exemplo com campos separados:
  usuarioAcesso: {
    type: String,
    trim: true,
    default: ''
  },
  infoAdicional: {
    type: String,
    trim: true,
    default: ''
  },
  // Alternativa: um único campo objeto
  // accessInfo: {
  //   type: mongoose.Schema.Types.Mixed, // Permite qualquer estrutura
  //   default: {}
  // },

  // Opcional: rastrear quem fez o último upload que afetou este registro
  // lastUpdatedBy: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Usuario'
  // },
}, {
  timestamps: true // Adiciona createdAt e updatedAt
});

// Método para sanitizar CNPJ antes de salvar/buscar (remover pontuação)
// Executado antes de validações
EverestCnpjAccessSchema.pre('validate', function(next) {
  if (this.cnpj) {
    this.cnpj = this.cnpj.replace(/\D/g, ''); // Remove tudo que não for dígito
  }
  next();
});

module.exports = mongoose.model('EverestCnpjAccess', EverestCnpjAccessSchema); 