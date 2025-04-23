const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Diretório temporário para uploads
const tmpDir = path.join(__dirname, '../..', 'tmp', 'uploads');

// Cria o diretório temporário se não existir
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// Configuração de armazenamento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpDir); // Salva no diretório temporário
  },
  filename: (req, file, cb) => {
    // Gera um nome de arquivo único para evitar colisões
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro de arquivo para aceitar apenas .xlsx
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.originalname.toLowerCase().endsWith('.xlsx')) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo inválido. Apenas arquivos .xlsx são permitidos.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 10 // Limite de 10MB (ajustar conforme necessário)
  }
});

module.exports = upload; 