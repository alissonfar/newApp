// src/controllers/controladorUsuario.js
const Usuario = require('../models/usuarios'); // Atualizado para o nome correto do modelo
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

      // Verifica se o email já está em uso
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

      // Compara as senhas
      const match = await bcrypt.compare(senha, usuario.senha);
      if (!match) {
        return res.status(401).json({ erro: 'Credenciais inválidas.' });
      }

      // Gera o token JWT
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
  },

  // Obter perfil do usuário
  async obterPerfil(req, res) {
    try {
      const usuario = await Usuario.findById(req.userId);
      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }
      return res.json(usuario);
    } catch (error) {
      console.error('Erro ao obter perfil:', error);
      return res.status(500).json({ erro: 'Erro interno ao obter perfil.' });
    }
  },

  // Atualizar perfil do usuário
  async atualizarPerfil(req, res) {
    try {
      const atualizacoes = { ...req.body };
      delete atualizacoes.senha; // Não permite atualizar senha por esta rota
      delete atualizacoes.email; // Não permite atualizar email por esta rota

      const usuario = await Usuario.findByIdAndUpdate(
        req.userId,
        { $set: atualizacoes },
        { new: true }
      );

      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      return res.json({
        mensagem: 'Perfil atualizado com sucesso!',
        usuario
      });
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return res.status(500).json({ erro: 'Erro interno ao atualizar perfil.' });
    }
  },

  // Atualizar senha
  async atualizarSenha(req, res) {
    try {
      const { senhaAtual, novaSenha } = req.body;
      if (!senhaAtual || !novaSenha) {
        return res.status(400).json({ erro: 'Senha atual e nova senha são obrigatórias.' });
      }

      const usuario = await Usuario.findById(req.userId);
      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      const senhaCorreta = await usuario.verificarSenha(senhaAtual);
      if (!senhaCorreta) {
        return res.status(400).json({ erro: 'Senha atual incorreta.' });
      }

      usuario.senha = novaSenha;
      await usuario.save();

      // Gera um novo token após a alteração da senha
      const token = jwt.sign({ userId: usuario._id }, jwtSecret, {
        expiresIn: jwtExpires
      });

      return res.json({ 
        mensagem: 'Senha atualizada com sucesso!',
        token,
        usuario: {
          _id: usuario._id,
          nome: usuario.nome,
          email: usuario.email
        }
      });
    } catch (error) {
      console.error('Erro ao atualizar senha:', error);
      return res.status(500).json({ erro: 'Erro interno ao atualizar senha.' });
    }
  },

  // Atualizar email
  async atualizarEmail(req, res) {
    try {
      const { novoEmail, senha } = req.body;
      if (!novoEmail || !senha) {
        return res.status(400).json({ erro: 'Novo email e senha são obrigatórios.' });
      }

      const usuario = await Usuario.findById(req.userId);
      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      const senhaCorreta = await usuario.verificarSenha(senha);
      if (!senhaCorreta) {
        return res.status(401).json({ erro: 'Senha incorreta.' });
      }

      const emailExistente = await Usuario.findOne({ email: novoEmail });
      if (emailExistente) {
        return res.status(400).json({ erro: 'Este email já está em uso.' });
      }

      usuario.email = novoEmail;
      await usuario.save();

      return res.json({ mensagem: 'Email atualizado com sucesso!' });
    } catch (error) {
      console.error('Erro ao atualizar email:', error);
      return res.status(500).json({ erro: 'Erro interno ao atualizar email.' });
    }
  },

  // Atualizar preferências
  async atualizarPreferencias(req, res) {
    try {
      const { preferencias } = req.body;
      if (!preferencias) {
        return res.status(400).json({ erro: 'Preferências são obrigatórias.' });
      }

      const usuario = await Usuario.findByIdAndUpdate(
        req.userId,
        { $set: { preferencias } },
        { new: true }
      );

      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      return res.json({
        mensagem: 'Preferências atualizadas com sucesso!',
        preferencias: usuario.preferencias
      });
    } catch (error) {
      console.error('Erro ao atualizar preferências:', error);
      return res.status(500).json({ erro: 'Erro interno ao atualizar preferências.' });
    }
  },

  // Upload de foto de perfil
  async uploadFotoPerfil(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ erro: 'Nenhuma imagem foi enviada.' });
      }

      const usuario = await Usuario.findByIdAndUpdate(
        req.userId,
        { $set: { fotoPerfil: req.file.path } },
        { new: true }
      );

      if (!usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado.' });
      }

      return res.json({
        mensagem: 'Foto de perfil atualizada com sucesso!',
        fotoPerfil: usuario.fotoPerfil
      });
    } catch (error) {
      console.error('Erro ao atualizar foto de perfil:', error);
      return res.status(500).json({ erro: 'Erro interno ao atualizar foto de perfil.' });
    }
  }
};
