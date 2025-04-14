const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const everestXmlController = require('../controllers/everestXmlController');
const { autenticacao } = require('../middlewares/autenticacao');
const checkRole = require('../middlewares/checkRole');

// Diretório para uploads temporários (o mesmo do CNPJ pode ser usado)
const tempUploadDir = path.join(__dirname, '../../uploads/temp');

// Criar o diretório se ele não existir (reafirmando, caso não tenha sido criado antes)
if (!fs.existsSync(tempUploadDir)){
    fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Configuração do Multer para upload de arquivos XML
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + (req.user?.userId || 'temp');
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Aceitar text/xml e application/xml
  const allowedTypes = ['text/xml', 'application/xml'];
  const allowedExts = /.xml$/i;

  if (allowedTypes.includes(file.mimetype) && allowedExts.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo inválido. Apenas XML é permitido.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Limite de 5MB para XML (ajustar se necessário)
  }
});

// Aplicar autenticação e verificação de role
router.use(autenticacao);
router.use(checkRole(['everest', 'admin']));

// --- Rotas para Processador XML Everest ---

// POST /api/everest/xml/process - Upload e processamento de XML
router.post('/process', upload.single('file'), everestXmlController.processXmlUpload);

// GET /api/everest/xml/summaries - Obter lista de resumos do usuário
router.get('/summaries', everestXmlController.getSummaries);

// GET /api/everest/xml/summaries/:id - Obter um resumo específico por ID
router.get('/summaries/:id', everestXmlController.getSummaryById);

// DELETE /api/everest/xml/summaries/:id - Rota para deletar um resumo
router.delete('/summaries/:id', everestXmlController.deleteSummary);

module.exports = router; 