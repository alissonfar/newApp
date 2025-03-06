if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: '.env.production' });
} else {
  require('dotenv').config({ path: '.env.development' });
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { porta, dbUri } = require('./config/config');

const app = express();
app.use(cors());
app.use(express.json());

// Conexão com o MongoDB
mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Conectado ao MongoDB'))
  .catch((err) => console.error('Erro ao conectar ao MongoDB:', err));

// Rotas
const rotasTransacao = require('./routes/rotasTransacao');
const rotasTag = require('./routes/rotasTag');
console.log('Tipo de rotasTag:', typeof rotasTag); // Deve imprimir "function"
const rotasCategoria = require('./routes/rotasCategoria');
const rotasUsuario = require('./routes/rotasUsuario');
const controladorRelatorio = require('./controllers/controladorRelatorio');

// Diagnóstico: exibe o tipo de cada rota
console.log('Tipo de rotasTransacao:', typeof rotasTransacao);
console.log('Tipo de rotasTag:', typeof rotasTag);
console.log('Tipo de rotasCategoria:', typeof rotasCategoria);
console.log('Tipo de rotasUsuario:', typeof rotasUsuario);

app.use('/api/transacoes', rotasTransacao);
app.use('/api/tags', rotasTag);
app.use('/api/categorias', rotasCategoria);
app.use('/api/usuarios', rotasUsuario);
app.use('/api/relatorio', (req, res) => {
  controladorRelatorio.gerarRelatorio(req, res);
});

app.get('/', (req, res) => {
  res.send('Backend do Controle de Gastos está em execução.');
});

app.listen(porta, () => {
  console.log(`Servidor rodando na porta ${porta}`);
});
