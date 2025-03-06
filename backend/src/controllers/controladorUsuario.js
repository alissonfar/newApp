// src/controllers/controladorUsuario.js
const Usuario = require('../models/usuarios');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpires } = require('../config/config');

module.exports = {
  async registrar(req, res) {
    try {
      const { nome, email, senha } = req.body;
      if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Campos obrigatórios faltando.' });
      }

      // Verifica se email já existe
      const usuarioExistente = await Usuario.findOne({ email });
      if (usuarioExistente) {
        return res.status(400).json({ erro: 'Email já está em uso.' });
      }

      const novoUsuario = new Usuario({ nome, email, senha });
      await novoUsuario.save();
      return res.status(201).json({ mensagem: 'Usuário registrado com sucesso!' });
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      return res.status(500).json({ erro: 'Erro interno ao registrar usuário.' });
    }
  },

  async login(req, res) {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
      }

      const usuario = await Usuario.findOne({ email });
      if (!usuario) {
        return res.status(401).json({ erro: 'Credenciais inválidas.' });
      }

      // Compara senhas
      const match = await bcrypt.compare(senha, usuario.senha);
      if (!match) {
        return res.status(401).json({ erro: 'Credenciais inválidas.' });
      }

      // Gera token JWT
      const token = jwt.sign({ userId: usuario._id }, jwtSecret, {
        expiresIn: jwtExpires
      });

      return res.json({
        mensagem: 'Login bem-sucedido!',
        token,
        usuario: {
          _id: usuario._id,
          nome: usuario.nome,
          email: usuario.email
        }
      });
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      return res.status(500).json({ erro: 'Erro interno ao fazer login.' });
    }
  }
};
