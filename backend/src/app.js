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

// Health check (verifica conexão e suporte a transações/replica set)
app.get('/api/health', async (req, res) => {
  try {
    const state = mongoose.connection.readyState;
    const connected = state === 1;
    let replicaSet = null;
    if (connected) {
      try {
        const status = await mongoose.connection.db.admin().command({ replSetGetStatus: 1 });
        replicaSet = status?.set || 'unknown';
      } catch (rsErr) {
        replicaSet = 'not_configured';
      }
    }
    res.json({
      ok: connected,
      mongodb: { connected: state === 1, stateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][state] || 'unknown' },
      replicaSet: replicaSet,
      transactionsSupported: connected && replicaSet !== 'not_configured'
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err?.message });
  }
});

// Rotas
const rotasUsuario = require('./routes/rotasUsuario');
const rotasTransacao = require('./routes/rotasTransacao');
const rotasTag = require('./routes/rotasTag');
const rotasCategoria = require('./routes/rotasCategoria');
const rotasEmail = require('./routes/emailRoutes');
const rotasImportacao = require('./routes/importacao');
const adminRoutes = require('./routes/adminRoutes');
const rotasRelatorio = require('./routes/rotasRelatorio');
const rotasModeloRelatorio = require('./routes/rotasModeloRelatorio');
const rotasSettlement = require('./routes/rotasSettlement');
const rotasTaxaCDI = require('./routes/rotasTaxaCDI');
const rotasInstituicao = require('./routes/rotasInstituicao');
const rotasSubconta = require('./routes/rotasSubconta');
const rotasPatrimonio = require('./routes/rotasPatrimonio');
const rotasImportacaoOFX = require('./routes/rotasImportacaoOFX');
const rotasTransferencia = require('./routes/rotasTransferencia');
const rotasVinculoConjunto = require('./routes/rotasVinculoConjunto');
const rotasAcertos = require('./routes/rotasAcertos');
const rotasNetWorth = require('./routes/rotasNetWorth');

// Prefixo /api em todas as rotas
app.use('/api/usuarios', rotasUsuario);
app.use('/api/transacoes', rotasTransacao);
app.use('/api/tags', rotasTag);
app.use('/api/categorias', rotasCategoria);
app.use('/api/email', rotasEmail);
app.use('/api/importacoes', rotasImportacao);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', rotasRelatorio);
app.use('/api/modelos-relatorio', rotasModeloRelatorio);
app.use('/api/settlements', rotasSettlement);
app.use('/api/taxa-cdi', rotasTaxaCDI);
app.use('/api/instituicoes', rotasInstituicao);
app.use('/api/subcontas', rotasSubconta);
app.use('/api/patrimonio/importacoes-ofx', rotasImportacaoOFX);
app.use('/api/patrimonio/transferencias', rotasTransferencia);
app.use('/api/patrimonio', rotasPatrimonio);
app.use('/api/net-worth', rotasNetWorth);
app.use('/api/vinculos-conjuntos', rotasVinculoConjunto);
app.use('/api/acertos', rotasAcertos);

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
