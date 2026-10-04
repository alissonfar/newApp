// src/models/emprestimo.js
const mongoose = require('mongoose');

const STATUS_EMPRESTIMO = ['ativo', 'quitado', 'cancelado'];

const EmprestimoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },

  pessoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pessoa', required: true },
  pessoaNomeSnapshot: { type: String, required: true, trim: true },
  pessoaContatoSnapshot: { type: String, default: null },

  prazoFinal: { type: Date, required: true },
  observacao: { type: String, default: null },

  status: { type: String, enum: STATUS_EMPRESTIMO, default: 'ativo', required: true },
  dataQuitacao: { type: Date, default: null }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

EmprestimoSchema.index({ usuario: 1, status: 1, prazoFinal: 1 });
EmprestimoSchema.index({ usuario: 1, pessoaId: 1, status: 1 });

EmprestimoSchema.virtual('isQuitado').get(function () {
  return this.status === 'quitado';
});

module.exports = mongoose.model('Emprestimo', EmprestimoSchema);
module.exports.STATUS_EMPRESTIMO = STATUS_EMPRESTIMO;
