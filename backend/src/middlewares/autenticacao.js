// src/middlewares/autenticacao.js
const jwt = require('jsonwebtoken');
const { jwtSecret, loginRedirectUrl } = require('../config/config');
const Usuario = require('../models/usuarios'); // Importa o modelo

function autenticacao(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      erro: 'Token não fornecido.',
      redirectUrl: loginRedirectUrl
    });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({ 
      erro: 'Token inválido.',
      redirectUrl: loginRedirectUrl
    });
  }
  const [scheme, token] = parts;
  if (!/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ 
      erro: 'Token malformatado.',
      redirectUrl: loginRedirectUrl
    });
  }
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (err) {
      return res.status(401).json({ 
        erro: 'Token inválido ou expirado.',
        redirectUrl: loginRedirectUrl
      });
    }
    req.userId = decoded.userId;
    next();
  });
}

// Middleware para verificar se o usuário é administrador
async function isAdmin(req, res, next) {
  try {
    // Verifica se userId foi anexado pela autenticação
    if (!req.userId) {
      return res.status(401).json({ 
        erro: 'Usuário não autenticado.',
        redirectUrl: require('../config/config').loginRedirectUrl // Acesso seguro à config
      });
    }

    const usuario = await Usuario.findById(req.userId).select('role'); // Busca apenas o campo 'role'

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    if (usuario.role !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado. Permissão de administrador necessária.' });
    }

    // Se for admin, continua para a próxima função
    next();
  } catch (error) {
    console.error('Erro no middleware isAdmin:', error);
    res.status(500).json({ erro: 'Erro interno do servidor ao verificar permissão.' });
  }
}

module.exports = { autenticacao, isAdmin }; // Exporta ambas as funções
