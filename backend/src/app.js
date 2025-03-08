const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' 
    ? '.env.production'
    : '.env.development'
});

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Conexão com o MongoDB
mongoose.connect(process.env.DB_URI)
  .then(() => console.log('Conectado ao MongoDB'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Rotas
const rotasUsuario = require('./routes/rotasUsuario');
const rotasTransacao = require('./routes/rotasTransacao');
const rotasTag = require('./routes/rotasTag');
const rotasCategoria = require('./routes/rotasCategoria');

// Prefixo /api em todas as rotas
app.use('/api/usuarios', rotasUsuario);
app.use('/api/transacoes', rotasTransacao);
app.use('/api/tags', rotasTag);
app.use('/api/categorias', rotasCategoria);

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
