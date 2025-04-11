const mongoose = require('mongoose');

const EverestXmlSummarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  originalFilename: {
    type: String,
    required: true,
    trim: true
  },
  extractedData: {
    // Armazena os dados chave extraídos do XML.
    // Usar Mixed permite flexibilidade, mas perde validação de schema.
    // Alternativa: definir um sub-schema se a estrutura for sempre a mesma.
    type: mongoose.Schema.Types.Mixed, 
    required: true,
    default: {}
  },
  // Poderia adicionar um campo para o XML original (como buffer ou string), mas pode ser grande.
  // rawXml: Buffer,
  processingError: { // Opcional: Para registrar erros de parsing/extração
    type: String,
    default: null
  }
}, {
  timestamps: true // Adiciona createdAt (data do processamento) e updatedAt
});

module.exports = mongoose.model('EverestXmlSummary', EverestXmlSummarySchema); 