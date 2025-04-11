const EverestXmlSummary = require('../models/EverestXmlSummary');
const xml2js = require('xml2js');
const fs = require('fs');

// Função auxiliar para extrair dados de um objeto NFe JS (exemplo)
// Esta função PRECISA ser adaptada conforme a estrutura real do XML!
const extractNFeData = (xmlObj) => {
  try {
    const infNFe = xmlObj?.NFe?.infNFe?.[0] || xmlObj?.nfeProc?.NFe?.[0]?.infNFe?.[0];
    if (!infNFe) return null; 

    const ide = infNFe.ide?.[0];
    const emit = infNFe.emit?.[0];
    const dest = infNFe.dest?.[0];
    const total = infNFe.total?.[0]?.ICMSTot?.[0];

    return {
      numeroNota: ide?.nNF?.[0],
      dataEmissao: ide?.dhEmi?.[0] || ide?.dEmi?.[0], // Tenta dhEmi primeiro
      emitente: emit?.xNome?.[0],
      cnpjEmitente: emit?.CNPJ?.[0],
      destinatario: dest?.xNome?.[0],
      cnpjDestinatario: dest?.CNPJ?.[0] || dest?.CPF?.[0], // Pode ser CPF
      valorTotal: total?.vNF?.[0],
      // Adicionar mais campos se necessário (ex: chave de acesso infNFe.$.Id)
      chaveAcesso: infNFe.$?.Id?.replace('NFe', '') // Remove o prefixo 'NFe'
    };
  } catch (error) {
    console.error("Erro ao extrair dados do objeto XML:", error);
    return null;
  }
};

module.exports = {
  // --- Processar Upload de XML ---
  async processXmlUpload(req, res) {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo XML enviado.' });
    }

    const filePath = req.file.path;
    const originalFilename = req.file.originalname;
    const userId = req.user.userId;

    try {
      // Ler o conteúdo do arquivo XML
      const xmlContent = fs.readFileSync(filePath, 'utf-8');
      
      // Parse do XML para Objeto JS
      const parser = new xml2js.Parser({ explicitArray: true }); // explicitArray: true é importante
      const xmlObj = await parser.parseStringPromise(xmlContent);

      // Extrair dados chave (usando a função auxiliar - adaptar conforme necessidade)
      const extractedData = extractNFeData(xmlObj);

      if (!extractedData) {
         // Tentar logar a estrutura para debug se a extração falhar
         // console.log("Estrutura XML parseada:", JSON.stringify(xmlObj, null, 2)); 
         // Remover arquivo temporário
         fs.unlink(filePath, (err) => { if (err) console.error("Erro ao remover temp XML:", err); });
         return res.status(400).json({ erro: 'Não foi possível extrair os dados esperados do XML. Verifique o formato.' });
      }

      // Salvar o resumo no banco
      const newSummary = new EverestXmlSummary({
        userId,
        originalFilename,
        extractedData,
        processingError: null // Indica sucesso na extração básica
      });

      await newSummary.save();

      // Remover arquivo temporário após sucesso
      fs.unlink(filePath, (err) => {
        if (err) console.error("Erro ao remover arquivo temporário após sucesso:", err);
      });

      return res.status(201).json(newSummary); // Retorna o resumo salvo

    } catch (error) {
      console.error('Erro ao processar arquivo XML:', error);
      // Remover arquivo temporário em caso de erro
      fs.unlink(filePath, (err) => {
        if (err) console.error("Erro ao remover arquivo temporário após erro:", err);
      });

      // Salvar um registro indicando erro de processamento? (Opcional)
      try {
        const errorSummary = new EverestXmlSummary({
          userId,
          originalFilename,
          extractedData: { error: 'Falha no parsing ou processamento inicial.' },
          processingError: error.message || 'Erro desconhecido no processamento XML'
        });
         await errorSummary.save();
      } catch (saveError) {
          console.error("Erro ao salvar registro de erro do XML:", saveError);
      }

      return res.status(500).json({ erro: 'Erro interno ao processar o arquivo XML.', details: error.message });
    }
  },

  // --- Obter Resumos do Usuário ---
  async getSummaries(req, res) {
    try {
      const userId = req.user.userId;
      // Ordena pelos mais recentes primeiro
      const summaries = await EverestXmlSummary.find({ userId }).sort({ createdAt: -1 });
      return res.json(summaries);

    } catch (error) {
      console.error('Erro ao buscar resumos XML Everest:', error);
      return res.status(500).json({ erro: 'Erro interno ao buscar resumos XML.' });
    }
  },

  // --- Obter Resumo por ID ---
  async getSummaryById(req, res) {
    try {
      const userId = req.user.userId;
      const summaryId = req.params.id;

      const summary = await EverestXmlSummary.findOne({ _id: summaryId, userId });

      if (!summary) {
        return res.status(404).json({ erro: 'Resumo XML não encontrado ou não pertence a este usuário.' });
      }

      return res.json(summary);

    } catch (error) {
      console.error('Erro ao buscar resumo XML por ID:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de resumo inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao buscar resumo XML.' });
    }
  }
  
  // Poderia adicionar um DELETE para resumos se necessário
}; 