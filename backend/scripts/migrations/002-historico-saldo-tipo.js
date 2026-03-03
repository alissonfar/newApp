const mongoose = require('mongoose');
const path = require('path');

const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../.env.production')
  : path.resolve(__dirname, '../../.env.development');

require('dotenv').config({ path: envPath });

const runMigration = async () => {
  const dbUri = process.env.DB_URI;

  if (!dbUri) {
    console.error('Erro: DB_URI não definida no arquivo .env (' + envPath + ').');
    process.exit(1);
  }

  try {
    console.log(`Tentando conectar ao MongoDB usando: ${envPath}...`);
    await mongoose.connect(dbUri);
    console.log('Conectado ao MongoDB com sucesso.');

    const db = mongoose.connection.db;
    const collection = db.collection('historicosaldos');

    console.log('Iniciando migração: Adicionando tipo="ajuste" em registros de HistoricoSaldo onde tipo não existe...');

    const updateResult = await collection.updateMany(
      { tipo: { $exists: false } },
      { $set: { tipo: 'ajuste' } }
    );

    console.log('----------------------------------------');
    console.log('Migração concluída.');
    console.log(`- Documentos encontrados: ${updateResult.matchedCount}`);
    console.log(`- Documentos modificados: ${updateResult.modifiedCount}`);
    console.log('----------------------------------------');

  } catch (error) {
    console.error('########################################');
    console.error('Erro durante a execução da migração:', error);
    console.error('########################################');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Desconectado do MongoDB.');
    }
  }
};

runMigration();
