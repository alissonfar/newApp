// src/config/config.js

module.exports = {
  porta: process.env.PORT,
  // URL do MongoDB: utilize uma instância local ou a do MongoDB Atlas
  dbUri: process.env.DB_URI
};
