// src/middlewares/autenticacao.js
const jwt = require('jsonwebtoken');
const { jwtSecret, loginRedirectUrl } = require('../config/config');

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

module.exports = autenticacao;
