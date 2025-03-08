// src/routes/rotasUsuario.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const controladorUsuario = require('../controllers/controladorUsuario');
const autenticacao = require('../middlewares/autenticacao');

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/perfil')
  },
  filename: function (req, file, cb) {
    cb(null, `${req.userId}-${Date.now()}${path.extname(file.originalname)}`)
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // limite de 5MB
  },
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = /jpeg|jpg|png/;
    const extname = tiposPermitidos.test(path.extname(file.originalname).toLowerCase());
    const mimetype = tiposPermitidos.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Apenas imagens são permitidas!'));
  }
});

// Rotas públicas
router.post('/registrar', controladorUsuario.registrar);
router.post('/login', controladorUsuario.login);

// Rotas protegidas (requerem autenticação)
router.use(autenticacao);

// Rotas de perfil
router.get('/perfil', controladorUsuario.obterPerfil);
router.put('/perfil', controladorUsuario.atualizarPerfil);
router.put('/perfil/senha', controladorUsuario.atualizarSenha);
router.put('/perfil/email', controladorUsuario.atualizarEmail);
router.put('/perfil/preferencias', controladorUsuario.atualizarPreferencias);
router.post('/perfil/foto', upload.single('foto'), controladorUsuario.uploadFotoPerfil);

module.exports = router;
