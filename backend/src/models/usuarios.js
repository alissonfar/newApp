// src/models/usuario.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
  emailVerificado: { type: Boolean, default: false },
  tokenVerificacao: String,
  tokenVerificacaoExpira: Date,
  tokenRedefinicaoSenha: String,
  tokenRedefinicaoSenhaExpira: Date,
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
    moedaPadrao: { type: String, default: 'BRL' },
    proprietario: { type: String, default: '' }
  },
  ultimoAcesso: { type: Date },
  status: { type: String, enum: ['ativo', 'inativo', 'bloqueado'], default: 'ativo' },
  role: { 
    type: String, 
    enum: ['admin', 'pro', 'comum'], 
    default: 'comum',
    index: true // Adicionado para buscas futuras por role
  }
}, { 
  timestamps: true,
  toJSON: { 
    transform: function(doc, ret) {
      delete ret.senha;
      delete ret.tokenVerificacao;
      delete ret.tokenVerificacaoExpira;
      delete ret.tokenRedefinicaoSenha;
      delete ret.tokenRedefinicaoSenhaExpira;
      return ret;
    }
  }
});

// Antes de salvar, faz o hash da senha e limpa o email
UsuarioSchema.pre('save', async function (next) {
  try {
    // Limpa espaços extras do email
    if (this.isModified('email')) {
      this.email = this.email.trim();
    }

    // Hash da senha
    if (this.isModified('senha')) {
      const salt = await bcrypt.genSalt(10);
      this.senha = await bcrypt.hash(this.senha, salt);
    }
    next();
  } catch (error) {
    return next(error);
  }
});

// Método para verificar senha
UsuarioSchema.methods.verificarSenha = async function(senha) {
  return await bcrypt.compare(senha, this.senha);
};

// Método para gerar token de verificação de email
UsuarioSchema.methods.gerarTokenVerificacaoEmail = function() {
  this.tokenVerificacao = crypto.randomBytes(32).toString('hex');
  this.tokenVerificacaoExpira = Date.now() + 24 * 60 * 60 * 1000; // 24 horas
  return this.tokenVerificacao;
};

// Método para gerar token de redefinição de senha
UsuarioSchema.methods.gerarTokenRedefinicaoSenha = function() {
  this.tokenRedefinicaoSenha = crypto.randomBytes(32).toString('hex');
  this.tokenRedefinicaoSenhaExpira = Date.now() + 1 * 60 * 60 * 1000; // 1 hora
  return this.tokenRedefinicaoSenha;
};

// Método para verificar se um token de verificação de email é válido
UsuarioSchema.methods.tokenVerificacaoEhValido = function() {
  return this.tokenVerificacao && this.tokenVerificacaoExpira > Date.now();
};

// Método para verificar se um token de redefinição de senha é válido
UsuarioSchema.methods.tokenRedefinicaoSenhaEhValido = function() {
  return this.tokenRedefinicaoSenha && this.tokenRedefinicaoSenhaExpira > Date.now();
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
