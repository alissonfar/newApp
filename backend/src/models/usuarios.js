// src/models/usuario.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  fotoPerfil: { type: String, default: '' },
  telefone: { type: String },
  dataNascimento: { type: Date },
  genero: { type: String, enum: ['masculino', 'feminino', 'outro', 'prefiro_nao_informar'] },
  biografia: { type: String },
  cargo: { type: String },
  empresa: { type: String },
  redesSociais: {
    linkedin: { type: String },
    twitter: { type: String },
    instagram: { type: String }
  },
  preferencias: {
    tema: { type: String, enum: ['claro', 'escuro'], default: 'claro' },
    notificacoes: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    moedaPadrao: { type: String, default: 'BRL' }
  },
  ultimoAcesso: { type: Date },
  status: { type: String, enum: ['ativo', 'inativo', 'bloqueado'], default: 'ativo' }
}, { 
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.senha;
      return ret;
    }
  }
});

// Antes de salvar, faz o hash da senha
UsuarioSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('senha')) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.senha = await bcrypt.hash(this.senha, salt);
    next();
  } catch (error) {
    return next(error);
  }
});

// Método para verificar senha
UsuarioSchema.methods.verificarSenha = async function(senha) {
  return await bcrypt.compare(senha, this.senha);
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
