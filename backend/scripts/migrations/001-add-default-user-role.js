const mongoose = require('mongoose');
const path = require('path'); // Usado para construir caminhos de forma segura

// Carrega variáveis de ambiente. Ajusta dinamicamente o caminho do .env
// baseado em NODE_ENV ou um padrão (development).
// IMPORTANTE: Certifique-se que a variável NODE_ENV está definida no seu ambiente
// ou ajuste o nome do arquivo .env diretamente se necessário.
const envPath = process.env.NODE_ENV === 'production'
  ? path.resolve(__dirname, '../../.env.production') // Caminho relativo do script para o .env.production na raiz do backend
  : path.resolve(__dirname, '../../.env.development'); // Caminho relativo do script para o .env.development na raiz do backend

require('dotenv').config({ path: envPath });

// Importa o modelo de usuário. O caminho é relativo à localização deste script.
const Usuario = require('../../src/models/usuarios');

const runMigration = async () => {
  const dbUri = process.env.DB_URI; // Pega a URI do banco do .env carregado

  if (!dbUri) {
    console.error('Erro: DB_URI não definida no arquivo .env (' + envPath + '). Verifique o caminho e o conteúdo do arquivo.');
    process.exit(1); // Encerra o script se não encontrar a URI
  }

  try {
    console.log(`Tentando conectar ao MongoDB usando: ${envPath}...`);
    // Conecta ao banco de dados usando a URI do .env
    await mongoose.connect(dbUri);
    console.log('Conectado ao MongoDB com sucesso.');

    console.log('Iniciando migração: Adicionando role="comum" a usuários onde o campo "role" não existe...');

    // Executa a atualização em lote
    const updateResult = await Usuario.updateMany(
      { role: { $exists: false } }, // Condição: Atualizar apenas usuários onde o campo 'role' NÃO existe
      { $set: { role: 'comum' } }    // Ação: Definir o campo 'role' como 'comum'
    );

    console.log('----------------------------------------');
    console.log('Migração concluída.');
    console.log(`- Documentos encontrados que precisavam de atualização: ${updateResult.matchedCount}`);
    console.log(`- Documentos efetivamente modificados: ${updateResult.modifiedCount}`);
    console.log('----------------------------------------');

    if (updateResult.matchedCount === 0) {
      console.log('Nenhum usuário precisava ter o campo "role" adicionado.');
    } else if (updateResult.modifiedCount > 0) {
      console.log('Os usuários existentes foram atualizados com o role padrão "comum".');
    }

  } catch (error) {
    console.error('########################################');
    console.error('Erro durante a execução da migração:', error);
    console.error('########################################');
    console.error('Verifique se a URI do banco de dados está correta e se o banco está acessível.');
  } finally {
    // Garante que a conexão com o banco seja fechada, mesmo se ocorrer erro
    if (mongoose.connection.readyState === 1) { // 1 === 'connected'
      await mongoose.disconnect();
      console.log('Desconectado do MongoDB.');
    }
  }
};

// Executa a função de migração
runMigration(); 