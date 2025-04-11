const EverestCnpjAccess = require('../models/EverestCnpjAccess');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const stream = require('stream');

// Função auxiliar para sanitizar CNPJ
const sanitizeCnpj = (cnpj) => {
  return cnpj ? String(cnpj).replace(/\D/g, '') : '';
};

module.exports = {
  // --- Processar Upload de Planilha --- 
  async processUpload(req, res) {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    }

    const filePath = req.file.path;
    const fileType = req.file.mimetype;
    const results = [];
    let processedCount = 0;
    let errorCount = 0;

    try {
      const parseStream = fileType === 'text/csv' 
        ? fs.createReadStream(filePath).pipe(csv())
        // Para XLSX, precisamos ler o buffer
        : (() => {
            const buffer = fs.readFileSync(filePath);
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            // Converter para JSON, assumindo cabeçalhos na primeira linha
            const jsonData = xlsx.utils.sheet_to_json(worksheet);
            // Simular um stream para manter a lógica de processamento consistente
            const readable = new stream.Readable({ objectMode: true });
            jsonData.forEach(row => readable.push(row));
            readable.push(null); // Fim do stream
            return readable;
          })();

      parseStream.on('data', async (data) => {
        // Pausar o stream para processamento assíncrono do banco de dados
        parseStream.pause();
        try {
          // Heurística para encontrar colunas CNPJ, Usuário, Info
          // Tenta encontrar colunas que contenham as palavras chave (case-insensitive)
          let cnpjCol, userCol, infoCol;
          for (const key in data) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('cnpj')) cnpjCol = key;
            if (lowerKey.includes('usuario') || lowerKey.includes('usuário') || lowerKey.includes('login')) userCol = key;
            if (lowerKey.includes('info') || lowerKey.includes('observacao') || lowerKey.includes('observação') || lowerKey.includes('detalhe')) infoCol = key;
          }

          if (!cnpjCol) {
             console.warn('Coluna CNPJ não encontrada na linha:', data);
             errorCount++;
             parseStream.resume(); // Continuar para próxima linha
             return; 
          }

          const cnpjRaw = data[cnpjCol];
          const cnpj = sanitizeCnpj(cnpjRaw);
          const usuarioAcesso = userCol ? String(data[userCol] || '').trim() : '';
          const infoAdicional = infoCol ? String(data[infoCol] || '').trim() : '';

          // Validar CNPJ (14 dígitos após sanitização)
          if (cnpj.length !== 14) {
            console.warn(`CNPJ inválido ou ausente na linha (valor: ${cnpjRaw}):`, data);
            errorCount++;
          } else {
            // Upsert: Atualiza se existir, insere se não existir
            await EverestCnpjAccess.updateOne(
              { cnpj: cnpj }, 
              { 
                $set: { 
                  usuarioAcesso: usuarioAcesso,
                  infoAdicional: infoAdicional 
                  // ,lastUpdatedBy: req.user.userId // Opcional
                }
              }, 
              { upsert: true }
            );
            processedCount++;
          }
        } catch (dbError) {
          console.error('Erro no banco de dados ao processar linha:', dbError, 'Linha:', data);
          errorCount++;
        } finally {
           // Resumir o stream para a próxima linha, mesmo em caso de erro
          parseStream.resume(); 
        }
      });

      parseStream.on('end', () => {
        // Remover arquivo temporário após processamento
        fs.unlink(filePath, (err) => {
          if (err) console.error("Erro ao remover arquivo temporário:", err);
        });

        res.json({ 
          message: `Processamento concluído. Registros processados: ${processedCount}, Erros: ${errorCount}.`,
          processedCount,
          errorCount
        });
      });

      parseStream.on('error', (streamError) => {
        console.error("Erro no stream de parsing:", streamError);
         fs.unlink(filePath, (err) => { // Tenta remover mesmo em caso de erro
          if (err) console.error("Erro ao remover arquivo temporário após erro de stream:", err);
        });
        res.status(500).json({ erro: 'Erro ao ler o arquivo.', details: streamError.message });
      });

    } catch (error) {
      console.error('Erro geral ao processar upload CNPJ:', error);
       fs.unlink(filePath, (err) => { // Tenta remover em caso de erro geral
          if (err) console.error("Erro ao remover arquivo temporário após erro geral:", err);
        });
      res.status(500).json({ erro: 'Erro interno ao processar o arquivo.' });
    }
  },

  // --- Consultar por CNPJ ---
  async queryByCnpj(req, res) {
    try {
      const cnpjParam = req.params.cnpj;
      const cnpj = sanitizeCnpj(cnpjParam);

      if (cnpj.length !== 14) {
         return res.status(400).json({ erro: 'CNPJ inválido. Deve conter 14 dígitos.' });
      }

      const result = await EverestCnpjAccess.findOne({ cnpj: cnpj });

      if (!result) {
        return res.status(404).json({ erro: 'CNPJ não encontrado na base de dados.' });
      }

      return res.json(result); // Retorna o documento encontrado

    } catch (error) {
      console.error('Erro ao consultar CNPJ Everest:', error);
       if (error.kind === 'ObjectId') { // Pouco provável aqui, mas por segurança
         return res.status(400).json({ erro: 'Parâmetro de busca inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao consultar CNPJ.' });
    }
  }
}; 