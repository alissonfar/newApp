// src/controllers/controladorUsuario.js
const Usuario = require('../models/usuarios'); // Atualizado para o nome correto do modelo
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpires } = require('../config/config');
const emailService = require('../services/emailService');

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

      const novoUsuario = new Usuario({ 
        nome, 
        email, 
        senha,
        emailVerificado: false
      });

      // Gera o token de verificação
      const tokenVerificacao = novoUsuario.gerarTokenVerificacaoEmail();
      
      await novoUsuario.save();

      // Envia o email de verificação
      try {
        await emailService.enviarEmailVerificacao(novoUsuario, tokenVerificacao);
      } catch (erro) {
        console.error('Erro ao enviar email de verificação:', erro);
        // Não retornamos erro ao usuário, pois o registro foi bem-sucedido
      }

      return res.status(201).json({ 
        mensagem: 'Usuário registrado com sucesso! Por favor, verifique seu email para ativar sua conta.' 
      });
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      return res.status(500).json({ erro: 'Erro interno ao registrar usuário.' });
    }
  },

  async verificarEmail(req, res) {
    try {
      const { token } = req.params;
      console.log('Token recebido:', token);

      // Primeiro, tenta encontrar o usuário pelo token
      let usuario = await Usuario.findOne({
        tokenVerificacao: token
      });

      // Se não encontrar pelo token, pode ser porque o email já foi verificado
      // e o token foi removido. Vamos buscar nos logs recentes.
      if (!usuario) {
        console.log('Token não encontrado, verificando se o email já foi verificado...');
        
        // Busca o usuário que tinha este token (armazenando temporariamente)
        const tokenAnterior = token;
        
        // Atualiza a busca para verificar se existe um usuário que já verificou o email
        usuario = await Usuario.findOne({
          $or: [
            { tokenVerificacao: tokenAnterior },
            { emailVerificado: true }
          ]
        });

        if (usuario && usuario.emailVerificado) {
          console.log('Email já verificado para o usuário:', usuario.email);
          return res.json({
            mensagem: 'Seu email já foi verificado com sucesso! Você pode fazer login na plataforma.',
            emailVerificado: true
          });
        } else {
          console.log('Token inválido - Nenhum usuário encontrado');
          return res.status(400).json({
            erro: 'Token de verificação inválido ou expirado. Por favor, solicite um novo email de verificação.'
          });
        }
      }

      // Se encontrou o usuário pelo token, continua o processo normal
      console.log('Resultado da busca:', {
        id: usuario._id,
        email: usuario.email,
        emailVerificado: usuario.emailVerificado,
        tokenVerificacao: usuario.tokenVerificacao,
        tokenVerificacaoExpira: usuario.tokenVerificacaoExpira
      });

      // Se o email já foi verificado, retorna sucesso
      if (usuario.emailVerificado) {
        console.log('Email já verificado anteriormente para o usuário:', usuario.email);
        return res.json({
          mensagem: 'Seu email já foi verificado com sucesso! Você pode fazer login na plataforma.',
          emailVerificado: true
        });
      }

      // Verifica se o token expirou
      const agora = Date.now();
      console.log('Verificando expiração do token:', {
        tokenExpira: usuario.tokenVerificacaoExpira,
        agora: agora,
        expirado: usuario.tokenVerificacaoExpira < agora
      });

      if (usuario.tokenVerificacaoExpira < agora) {
        console.log('Token expirado para o usuário:', usuario.email);
        return res.status(400).json({
          erro: 'O link de verificação expirou. Por favor, solicite um novo email de verificação.',
          emailVerificado: false
        });
      }

      // Atualiza o usuário
      console.log('Atualizando status de verificação para o usuário:', usuario.email);
      usuario.emailVerificado = true;
      usuario.tokenVerificacao = undefined;
      usuario.tokenVerificacaoExpira = undefined;
      await usuario.save();

      // Envia email de boas-vindas
      try {
        console.log('Enviando email de boas-vindas para:', usuario.email);
        await emailService.enviarEmailBoasVindas(usuario);
      } catch (erro) {
        console.error('Erro ao enviar email de boas-vindas:', erro);
      }

      console.log('Verificação concluída com sucesso para:', usuario.email);
      return res.json({
        mensagem: 'Email verificado com sucesso! Sua conta está ativa.',
        emailVerificado: true
      });
    } catch (erro) {
      console.error('Erro ao verificar email:', erro);
      return res.status(500).json({
        erro: 'Erro interno ao verificar email.'
      });
    }
  },

  async reenviarVerificacao(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          erro: 'Email é obrigatório.'
        });
      }

      const usuario = await Usuario.findOne({ email });

      if (!usuario) {
        return res.status(404).json({
          erro: 'Usuário não encontrado.'
        });
      }

      if (usuario.emailVerificado) {
        return res.status(400).json({
          erro: 'Este email já foi verificado.'
        });
      }

      // Gera novo token de verificação
      const tokenVerificacao = usuario.gerarTokenVerificacaoEmail();
      await usuario.save();

      // Envia novo email de verificação
      try {
        await emailService.enviarEmailVerificacao(usuario, tokenVerificacao);
      } catch (erro) {
        console.error('Erro ao reenviar email de verificação:', erro);
        return res.status(500).json({
          erro: 'Erro ao enviar email de verificação.'
        });
      }

      return res.json({
        mensagem: 'Email de verificação reenviado com sucesso.'
      });
    } catch (erro) {
      console.error('Erro ao reenviar verificação:', erro);
      return res.status(500).json({
        erro: 'Erro interno ao reenviar verificação.'
      });
    }
  },

  async login(req, res) {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
      }

      // Limpa espaços do email
      const emailLimpo = email.trim();

      // Busca considerando possíveis espaços extras
      const usuario = await Usuario.findOne({
        email: { $regex: new RegExp(`^${emailLimpo}\\s*$`, 'i') }
      });

      if (!usuario) {
        return res.status(401).json({ erro: 'Credenciais inválidas.' });
      }

      // Verifica se o email foi verificado
      if (!usuario.emailVerificado) {
        return res.status(403).json({ 
          erro: 'Por favor, verifique seu email antes de fazer login.',
          emailNaoVerificado: true
        });
      }

      // Compara as senhas
      const match = await bcrypt.compare(senha, usuario.senha);
      if (!match) {
        console.log('Senha fornecida não corresponde ao hash armazenado');
        return res.status(401).json({ erro: 'Credenciais inválidas.' });
      }

      // Gera o token JWT
      const token = jwt.sign(
        {
          userId: usuario._id,
          role: usuario.role
        },
        jwtSecret,
        {
          expiresIn: jwtExpires
        }
      );

      return res.json({
        mensagem: 'Login bem-sucedido!',
        token,
        usuario: {
          _id: usuario._id,
          nome: usuario.nome,
          email: usuario.email.trim(), // Remove espaços extras
          emailVerificado: usuario.emailVerificado,
          role: usuario.role
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
  },

  async solicitarRedefinicaoSenha(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          erro: 'Email é obrigatório.'
        });
      }

      // Limpa espaços extras do email
      const emailLimpo = email.trim();

      const usuario = await Usuario.findOne({ 
        email: { $regex: new RegExp(`^${emailLimpo}\\s*$`, 'i') }
      });

      // Por segurança, não informamos se o email existe ou não
      if (!usuario) {
        return res.json({
          mensagem: 'Se um usuário com este email existir, você receberá as instruções para redefinir sua senha.'
        });
      }

      // Verifica se já existe um token válido
      if (usuario.tokenRedefinicaoSenhaExpira && usuario.tokenRedefinicaoSenhaExpira > Date.now()) {
        return res.status(400).json({
          erro: 'Uma solicitação de redefinição de senha já foi enviada. Por favor, aguarde alguns minutos antes de tentar novamente.'
        });
      }

      // Gera o token de redefinição
      const tokenRedefinicao = usuario.gerarTokenRedefinicaoSenha();
      await usuario.save();

      // Envia o email
      try {
        await emailService.enviarEmailRedefinicaoSenha(usuario, tokenRedefinicao);
        console.log('Email de redefinição enviado com sucesso para:', usuario.email);
      } catch (erro) {
        console.error('Erro ao enviar email de redefinição:', erro);
        return res.status(500).json({
          erro: 'Erro ao enviar email de redefinição de senha.'
        });
      }

      return res.json({
        mensagem: 'Se um usuário com este email existir, você receberá as instruções para redefinir sua senha.'
      });
    } catch (erro) {
      console.error('Erro ao solicitar redefinição de senha:', erro);
      return res.status(500).json({
        erro: 'Erro interno ao processar solicitação de redefinição de senha.'
      });
    }
  },

  async redefinirSenha(req, res) {
    try {
      const { token } = req.params;
      const { novaSenha } = req.body;

      if (!novaSenha) {
        return res.status(400).json({
          erro: 'Nova senha é obrigatória.'
        });
      }

      const usuario = await Usuario.findOne({
        tokenRedefinicaoSenha: token,
        tokenRedefinicaoSenhaExpira: { $gt: Date.now() }
      });

      if (!usuario) {
        return res.status(400).json({
          erro: 'Token de redefinição inválido ou expirado.'
        });
      }

      // Define a nova senha (o middleware pre-save fará o hash)
      usuario.senha = novaSenha;
      usuario.tokenRedefinicaoSenha = undefined;
      usuario.tokenRedefinicaoSenhaExpira = undefined;

      // Limpa espaços do email
      usuario.email = usuario.email.trim();
      
      await usuario.save();

      // Testa se a nova senha pode ser verificada
      const testeSenha = await usuario.verificarSenha(novaSenha);
      console.log('Teste de verificação da nova senha:', testeSenha);

      // Gera um novo token JWT para autenticação automática
      const authToken = jwt.sign({ userId: usuario._id }, jwtSecret, {
        expiresIn: jwtExpires
      });

      // Envia confirmação por email
      try {
        await emailService.enviarEmail(
          usuario.email,
          'Senha Alterada com Sucesso',
          `<h1>Senha Alterada</h1>
           <p>Sua senha foi alterada com sucesso. Se você não realizou esta alteração, entre em contato conosco imediatamente.</p>`
        );
      } catch (erro) {
        console.error('Erro ao enviar email de confirmação:', erro);
      }

      return res.json({
        mensagem: 'Senha redefinida com sucesso!',
        token: authToken,
        usuario: {
          _id: usuario._id,
          nome: usuario.nome,
          email: usuario.email,
          emailVerificado: usuario.emailVerificado
        }
      });
    } catch (erro) {
      console.error('Erro ao redefinir senha:', erro);
      return res.status(500).json({
        erro: 'Erro interno ao redefinir senha.'
      });
    }
  },

  async verificarTokenRedefinicao(req, res) {
    try {
      const { token } = req.params;

      const usuario = await Usuario.findOne({
        tokenRedefinicaoSenha: token,
        tokenRedefinicaoSenhaExpira: { $gt: Date.now() }
      });

      if (!usuario) {
        return res.status(400).json({
          erro: 'Token de redefinição inválido ou expirado.'
        });
      }

      return res.json({
        mensagem: 'Token válido',
        email: usuario.email
      });
    } catch (erro) {
      console.error('Erro ao verificar token:', erro);
      return res.status(500).json({
        erro: 'Erro interno ao verificar token de redefinição.'
      });
    }
  }
};
