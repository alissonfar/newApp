const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Para criar o diretório se não existir
const everestCnpjController = require('../controllers/everestCnpjController');
const { autenticacao } = require('../middlewares/autenticacao');
const checkRole = require('../middlewares/checkRole');
const upload = require('../middlewares/multerConfig'); // Middleware Multer

// Diretório para uploads temporários
const tempUploadDir = path.join(__dirname, '../../uploads/temp');

// Criar o diretório se ele não existir
if (!fs.existsSync(tempUploadDir)){
    fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Configuração do Multer para upload de arquivos CSV/XLSX
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadDir);
  },
  filename: function (req, file, cb) {
    // Usar timestamp e ID do usuário (se disponível) para nome único
    const uniqueSuffix = Date.now() + '-' + (req.user?.userId || 'temp');
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel', // Older Excel format (sometimes associated with CSV)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // XLSX
  ];
  const allowedExts = /.csv$|.xlsx$/i;

  if (allowedTypes.includes(file.mimetype) && allowedExts.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo inválido. Apenas CSV e XLSX são permitidos.'), false);
  }
};

const uploadMulter = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limite de 10MB (ajustar conforme necessário)
  }
});

// Aplicar autenticação e verificação de role para todas as rotas
router.use(autenticacao);
router.use(checkRole(['everest', 'admin']));

// --- Rotas para Consulta CNPJ Everest ---

// @route   POST /api/everest/cnpj/upload
// @desc    Upload e processamento de planilha CNPJ
// @access  Private (everest, admin)
router.post('/upload',
  checkRole(['everest', 'admin']),
  uploadMulter.single('file'), // 'file' deve ser o nome do campo no formulário de upload
  everestCnpjController.uploadCnpjFile
);

// @route   GET /api/everest/cnpj/query/:cnpj
// @desc    Consultar usuário por CNPJ
// @access  Private (everest, admin)
router.get('/query/:cnpj',
  checkRole(['everest', 'admin']),
  everestCnpjController.queryCnpj
);

module.exports = router; 