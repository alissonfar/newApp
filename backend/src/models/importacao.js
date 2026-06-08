const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const ImportacaoSchema = new mongoose.Schema({
  descricao: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pendente', 'processando', 'validado', 'finalizada', 'estornada', 'erro'],
    default: 'pendente'
  },
  nomeArquivo: { 
    type: String, 
    required: function() { return this.origem !== 'pluggy'; },
    default: function() { return this.origem === 'pluggy' ? 'Open Finance' : undefined; }
  },
  caminhoArquivo: {
    type: String,
    required: function() { return this.origem !== 'pluggy'; },
    default: function() { return this.origem === 'pluggy' ? 'pluggy' : undefined; }
  },
  totalProcessado: { 
    type: Number, 
    default: 0 
  },
  totalSucesso: { 
    type: Number, 
    default: 0 
  },
  totalErro: { 
    type: Number, 
    default: 0 
  },
  totalIgnoradas: {
    type: Number,
    default: 0
  },
  totalEsperado: {
    type: Number,
    default: 0
  },
  totalPossiveisDuplicatas: {
    type: Number,
    default: 0
  },
  erro: {
    type: String,
    default: null
  },
  erros: [{
    mensagem: String,
    dados: mongoose.Schema.Types.Mixed
  }],
  tagsPadrao: {
    type: Object,
    default: {}
  },
  tipoImportacao: {
    type: String,
    enum: ['normal', 'complementar'],
    default: 'normal'
  },
  origem: {
    type: String,
    default: null
  },
  pluggySyncId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ImportacaoPluggy',
    default: null
  },
  dataInicial: {
    type: Date,
    default: null
  },
  dataFinal: {
    type: Date,
    default: null
  },
  periodoCompetencia: {
    type: String,
    default: null
  },
  totalCreditos: {
    type: Number,
    default: 0
  },
  totalDebitos: {
    type: Number,
    default: 0
  },
  metadadosInferidos: {
    type: Object,
    default: {}
  },
  vencimento: {
    type: Date,
    default: null
  },
  mesVencimento: {
    type: String,
    default: null,
    index: true
  },
  numeroComplemento: {
    type: Number,
    default: null
  },
  tagSugeridaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag',
    default: null
  },
  categoriaSugeridaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoria',
    default: null
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

// Virtual para calcular o progresso
ImportacaoSchema.virtual('progresso').get(function() {
  if (!this.totalProcessado) return 0;
  return Math.round((this.totalSucesso / this.totalProcessado) * 100);
});

// Índices
ImportacaoSchema.index({ usuario: 1, status: 1 });
ImportacaoSchema.index({ createdAt: -1 });

// Adiciona o plugin de paginação
ImportacaoSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Importacao', ImportacaoSchema); 