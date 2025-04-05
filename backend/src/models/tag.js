const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const TagSchema = new mongoose.Schema({
  codigo: { 
    type: String, 
    required: true,
    unique: true,
    default: function() {
      return this.categoria + '_TAG_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    }
  },
  nome: { type: String, required: true },
  descricao: { type: String, default: '' },
  categoria: { type: String, required: true },
  cor: { type: String, default: '#000000' },
  icone: { type: String, default: 'default-icon' },
  ativo: { type: Boolean, default: true },
  dataCriacao: { type: Date, default: Date.now },
  dataAtualizacao: { type: Date, default: Date.now },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
}, {
  timestamps: { 
    createdAt: 'dataCriacao',
    updatedAt: 'dataAtualizacao'
  }
});

// Adicionar o plugin de paginação
TagSchema.plugin(mongoosePaginate);

// Cria um índice composto único para { nome, usuario }
TagSchema.index({ nome: 1, usuario: 1 }, { unique: true });

// Adiciona virtual para que o JSON inclua o campo "id" (baseado em _id)
TagSchema.set('toJSON', { virtuals: true });

// Middleware pre-save para garantir que o código seja único
TagSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('categoria')) {
    this.codigo = this.categoria + '_TAG_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    let codigoUnico = false;
    while (!codigoUnico) {
      const existente = await this.constructor.findOne({ codigo: this.codigo });
      if (!existente) {
        codigoUnico = true;
      } else {
        this.codigo = this.categoria + '_TAG_' + Math.random().toString(36).substr(2, 9).toUpperCase();
      }
    }
  }
  next();
});

module.exports = mongoose.model('Tag', TagSchema);
