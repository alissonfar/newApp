// backend/scripts/migrations/010-lucca-acesso-e-seed.js
// Marca acessoLucca:true para os 2 usuários do domínio lucca e cria o documento
// singleton do Bebe (Lucca), se ainda não existir.
//
// Desenvolvimento (usa .env.development com DB_URI):
//   node scripts/migrations/010-lucca-acesso-e-seed.js <emailUsuario1> <emailUsuario2>
//
// Produção (usa .env.production com DB_URI):
//   node scripts/migrations/010-lucca-acesso-e-seed.js <emailUsuario1> <emailUsuario2> --production
const path = require('path');
const fs = require('fs');

const forcarProducao = process.argv.includes('--production');
if (forcarProducao) process.env.NODE_ENV = 'production';

const envFileName = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
const envPath = path.resolve(__dirname, '../../' + envFileName);

let envFile = envPath;
if (!fs.existsSync(envPath)) {
  const fallback = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(fallback)) {
    envFile = fallback;
    if (process.env.NODE_ENV === 'production') {
      console.warn('Aviso: .env.production nao encontrado, usando .env como fallback.');
    }
  } else if (process.env.DB_URI || process.env.MONGODB_URI) {
    console.log(envFileName + ' nao encontrado — usando DB_URI do ambiente (Railway/Docker).');
  } else {
    console.error('Erro: ' + envFileName + ' nao encontrado e DB_URI nao definida no ambiente.');
    console.error('Esperado: ' + envPath);
    process.exit(1);
  }
}
if (envFile) {
  require('dotenv').config({ path: envFile });
}

const mongoose = require('mongoose');
const Usuario = require('../../src/models/usuarios');
const Bebe = require('../../src/models/lucca/bebe');

async function main() {
  const [emailUsuario1, emailUsuario2] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  if (!emailUsuario1 || !emailUsuario2) {
    console.error('Uso: node scripts/migrations/010-lucca-acesso-e-seed.js <emailUsuario1> <emailUsuario2>');
    process.exit(1);
  }

  await mongoose.connect(process.env.DB_URI || process.env.MONGODB_URI);

  const resultado = await Usuario.updateMany(
    { email: { $in: [emailUsuario1, emailUsuario2] } },
    { $set: { acessoLucca: true } }
  );
  console.log(`Usuários atualizados: ${resultado.modifiedCount}`);

  const bebeExistente = await Bebe.findOne();
  if (!bebeExistente) {
    const bebe = await Bebe.create({
      nome: 'Lucca',
      dataNascimento: new Date('2026-08-06'),
      idadeGestacionalNascimento: { semanas: 37, dias: 5 },
      janelaVigiliaAlvoMinutos: 90
    });
    console.log(`Bebe criado: ${bebe._id}`);
  } else {
    console.log('Bebe já existe, nada a criar.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
