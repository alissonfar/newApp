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

// Configuração do CORS - permitindo todas as origens
const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

// Middlewares
app.use(cors(corsOptions));
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
const rotasRegra = require('./routes/rotasRegra');
const rotasEmail = require('./routes/emailRoutes');
const rotasImportacao = require('./routes/importacao');

// Prefixo /api em todas as rotas
app.use('/api/usuarios', rotasUsuario);
app.use('/api/transacoes', rotasTransacao);
app.use('/api/tags', rotasTag);
app.use('/api/categorias', rotasCategoria);
app.use('/api/regras', rotasRegra);
app.use('/api/email', rotasEmail);
app.use('/api/importacoes', rotasImportacao);

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
