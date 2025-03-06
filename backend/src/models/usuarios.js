// src/models/usuario.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UsuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  senha: { type: String, required: true },
}, { timestamps: true });

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

module.exports = mongoose.model('Usuario', UsuarioSchema);
