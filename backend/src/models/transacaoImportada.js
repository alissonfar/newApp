const mongoose = require('mongoose');

const PagamentoSchema = new mongoose.Schema({
  pessoa: { type: String, required: true },
  valor: { type: Number, required: true },
  tags: { type: Object }
});

const TransacaoImportadaSchema = new mongoose.Schema({
  importacao: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Importacao', 
    required: true 
  },
  descricao: { 
    type: String, 
    required: true 
  },
  valor: { 
    type: Number, 
    required: true 
  },
  data: { 
    type: Date, 
    required: true 
  },
  categoria: { 
    type: String,
    required: false
  },
  tipo: { 
    type: String, 
    enum: ['gasto', 'recebivel'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pendente', 'revisada', 'validada', 'erro', 'ja_importada', 'processada', 'estornada', 'ignorada'],
    default: 'pendente'
  },
  erro: { 
    type: String,
    default: null
  },
  pagamentos: {
    type: [PagamentoSchema],
    default: []
  },
  observacao: {
    type: String,
    default: ''
  },
  dadosOriginais: { 
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deduplicationKey: { 
    type: String,
    default: null
  },
  transacaoCriada: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Transacao',
    default: null
  },
  // Parcelamento (para importação já expandida)
  isInstallment: { type: Boolean, default: false },
  installmentGroupId: { type: mongoose.Schema.Types.ObjectId, default: null },
  installmentNumber: { type: Number, default: null },
  installmentTotal: { type: Number, default: null },
  installmentIntervalMonths: { type: Number, default: null },
  installmentIntervalDays: { type: Number, default: null },
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: false, default: null }
}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Converte para formato Transacao (para criar transação real)
TransacaoImportadaSchema.methods.paraTransacao = function() {
  const pagamentos = this.pagamentos && this.pagamentos.length > 0
    ? this.pagamentos
    : [{ pessoa: 'Titular', valor: this.valor, tags: {} }];
  return {
    tipo: this.tipo,
    descricao: this.descricao,
    valor: this.valor,
    data: this.data,
    observacao: this.observacao || '',
    pagamentos,
    usuario: this.usuario,
    subconta: this.subconta || undefined,
    deduplicationKey: this.deduplicationKey || undefined,
    isInstallment: this.isInstallment || false,
    installmentGroupId: this.installmentGroupId || undefined,
    installmentNumber: this.installmentNumber,
    installmentTotal: this.installmentTotal,
    installmentIntervalMonths: this.installmentIntervalMonths,
    installmentIntervalDays: this.installmentIntervalDays
  };
};

// Middleware para validar valor
TransacaoImportadaSchema.pre('save', function(next) {
  if (this.valor < 0) {
    next(new Error('O valor da transação não pode ser negativo'));
  }
  next();
});

// Índices
TransacaoImportadaSchema.index({ importacao: 1, status: 1 });
TransacaoImportadaSchema.index({ importacao: 1, status: 1, deduplicationKey: 1 });
TransacaoImportadaSchema.index({ usuario: 1 });
TransacaoImportadaSchema.index({ usuario: 1, deduplicationKey: 1, status: 1 });
TransacaoImportadaSchema.index({ data: -1 });

module.exports = mongoose.model('TransacaoImportada', TransacaoImportadaSchema); 