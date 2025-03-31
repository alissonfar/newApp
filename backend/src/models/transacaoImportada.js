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
    enum: ['pendente', 'revisada', 'validada', 'erro'],
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
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  }
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

// Middleware para validar valor
TransacaoImportadaSchema.pre('save', function(next) {
  if (this.valor < 0) {
    next(new Error('O valor da transação não pode ser negativo'));
  }
  next();
});

// Índices
TransacaoImportadaSchema.index({ importacao: 1, status: 1 });
TransacaoImportadaSchema.index({ usuario: 1 });
TransacaoImportadaSchema.index({ data: -1 });

module.exports = mongoose.model('TransacaoImportada', TransacaoImportadaSchema); 