require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development' });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.DB_URI);
  const res = await mongoose.connection.db.collection('emprestimos')
    .updateMany({ tipoRetorno: { $exists: true } }, { $unset: { tipoRetorno: '' } });
  console.log(`Empréstimos normalizados: ${res.modifiedCount}`);
  await mongoose.disconnect();
}
run().catch((e) => { console.error(e); process.exit(1); });