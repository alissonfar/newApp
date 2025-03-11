// src/config/config.js

module.exports = {
  porta: process.env.PORT,
  dbUri: process.env.DB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || '1d',
  loginRedirectUrl: process.env.LOGIN_REDIRECT_URL
};