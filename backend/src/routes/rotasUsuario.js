// src/routes/rotasUsuario.js
const express = require('express');
const router = express.Router();
const controladorUsuario = require('../controllers/controladorUsuario');

router.post('/registrar', controladorUsuario.registrar);
router.post('/login', controladorUsuario.login);

module.exports = router;
