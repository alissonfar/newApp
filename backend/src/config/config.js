// src/config/config.js

module.exports = {
  porta: process.env.PORT || 3001,
  // URL do MongoDB: utilize uma instância local ou a do MongoDB Atlas
  dbUri: process.env.DB_URI || 'mongodb://localhost:27017/controle_gastos'
};
