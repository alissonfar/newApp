const mongoose = require('mongoose');

const CondicaoSchema = new mongoose.Schema({
  campo: { 
    type: String, 
    enum: ['tipo', 'valor', 'data', 'status', 'pagamentos.pessoa', 'pagamentos.tags', 'pessoa'],
    required: true 
  },
  operador: { 
    type: String, 
    enum: ['igual', 'diferente', 'maior', 'menor', 'contem', 'nao_contem'],
    required: true 
  },
  valor: { type: mongoose.Schema.Types.Mixed, required: true }
});

const AcaoSchema = new mongoose.Schema({
  tipo: { 
    type: String, 
    enum: ['adicionar_tag', 'remover_tag', 'alterar_status', 'alterar_valor'],
    required: true 
  },
  valor: { type: mongoose.Schema.Types.Mixed, required: true }
});

const RegraSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  ativa: { type: Boolean, default: true },
  condicoes: {
    type: [CondicaoSchema],
    required: true,
    validate: [arr => arr.length > 0, 'Pelo menos uma condição é necessária']
  },
  operadorLogico: { 
    type: String, 
    enum: ['E', 'OU'],
    default: 'E'
  },
  acoes: {
    type: [AcaoSchema],
    required: true,
    validate: [arr => arr.length > 0, 'Pelo menos uma ação é necessária']
  },
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  ultimaExecucao: { 
    data: Date,
    transacoesAfetadas: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transacao' }],
    estadoAnterior: [mongoose.Schema.Types.Mixed]
  },
  execucaoAutomatica: {
    ativa: { type: Boolean, default: false },
    frequencia: { 
      type: String,
      enum: ['diaria', 'semanal', 'mensal'],
      required: function() { 
        return this.execucaoAutomatica && this.execucaoAutomatica.ativa === true;
      }
    }
  }
}, {
  timestamps: true
});

// Middleware pre-save para garantir a estrutura correta de execucaoAutomatica
RegraSchema.pre('save', function(next) {
  if (this.execucaoAutomatica && !this.execucaoAutomatica.ativa) {
    this.execucaoAutomatica.frequencia = undefined;
  }
  next();
});

module.exports = mongoose.model('Regra', RegraSchema); 