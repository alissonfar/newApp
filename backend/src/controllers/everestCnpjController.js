const EverestCnpjAccess = require('../models/EverestCnpjAccess');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const stream = require('stream');
const cnpjProcessor = require('../services/planilhaProcessors/cnpjProcessor');
const fsPromises = require('fs').promises;

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
  },

  /**
   * @desc    Processa o upload de um arquivo de planilha CNPJ.
   * @route   POST /api/everest/cnpj/upload
   * @access  Private (everest, admin)
   */
  async uploadCnpjFile(req, res) {
    if (!req.file) {
      return res.status(400).json({ sucesso: false, erro: 'Nenhum arquivo enviado.' });
    }

    const filePath = req.file.path;

    try {
      console.log(`Controller recebendo arquivo para processamento: ${filePath}`);
      const resultadoProcessamento = await cnpjProcessor.processarPlanilhaCnpj(filePath);

      if (resultadoProcessamento.sucesso) {
        return res.status(200).json({
          sucesso: true,
          mensagem: 'Planilha processada com sucesso.',
          detalhes: {
            emissaoProcessados: resultadoProcessamento.registrosEmissaoProcessados,
            recebimentoProcessados: resultadoProcessamento.registrosRecebimentoProcessados,
            avisos: resultadoProcessamento.erros // Renomear para 'avisos' se forem erros não fatais
          }
        });
      } else {
        // Mesmo que o processamento não seja um sucesso total (ex: abas faltando, erros em linhas), 
        // pode ter processado algo. Retornar 207 Multi-Status ou manter 400?
        // Por simplicidade, vamos retornar 400 se houver erros fatais ou nenhuma aba válida.
        console.error('Falha no processamento da planilha:', resultadoProcessamento.erros);
        return res.status(400).json({
          sucesso: false,
          erro: 'Falha ao processar a planilha.',
          detalhes: resultadoProcessamento.erros
        });
      }
    } catch (error) {
      console.error('Erro inesperado no controller de upload:', error);
      return res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor ao processar o arquivo.' });
    } finally {
      // Remover o arquivo temporário após o processamento (sucesso ou falha)
      try {
        await fsPromises.unlink(filePath);
        console.log(`Arquivo temporário ${filePath} removido.`);
      } catch (unlinkError) {
        // Logar o erro mas não impedir a resposta ao cliente
        console.error(`Erro ao remover arquivo temporário ${filePath}:`, unlinkError);
      }
    }
  },

  /**
   * @desc    Consulta informações de acesso por CNPJ.
   * @route   GET /api/everest/cnpj/query/:cnpj
   * @access  Private (everest, admin)
   */
  async queryCnpj(req, res) {
    try {
      const cnpjParam = req.params.cnpj;
      if (!cnpjParam) {
        return res.status(400).json({ sucesso: false, erro: 'Parâmetro CNPJ não fornecido.' });
      }

      // 1. Limpar CNPJ da consulta (remover não dígitos)
      const cnpjLimpoConsulta = cnpjParam.replace(/\D/g, '');

      // 2. Preparar CNPJs para busca (tratar zero à esquerda)
      let cnpjsParaBuscar = [];
      if (cnpjLimpoConsulta.length === 14) {
        cnpjsParaBuscar.push(cnpjLimpoConsulta);
      } else if (cnpjLimpoConsulta.length === 13) {
        cnpjsParaBuscar.push(cnpjLimpoConsulta); // Busca pelo que foi digitado (sem o zero)
        cnpjsParaBuscar.push('0' + cnpjLimpoConsulta); // E busca pela versão com zero
      } else if (cnpjLimpoConsulta.length > 0) {
          // Se for menor que 13 ou maior que 14 após limpar, provavelmente inválido,
          // mas podemos tentar buscar mesmo assim pelo valor limpo.
          cnpjsParaBuscar.push(cnpjLimpoConsulta);
          // Poderia retornar erro 400 aqui se quisesse ser mais estrito
          // return res.status(400).json({ sucesso: false, erro: 'CNPJ inválido (não tem 13 ou 14 dígitos após limpeza).' });
      } else {
           return res.status(400).json({ sucesso: false, erro: 'CNPJ inválido após limpeza.' });
      }
      
      // 3. Buscar no banco
      console.log(`Consultando CNPJs: ${cnpjsParaBuscar.join(', ')}`);
      const resultados = await EverestCnpjAccess.find({
        cnpj: { $in: cnpjsParaBuscar }
      }).select('usuario tipoOrigem -_id'); // Seleciona apenas os campos necessários

      console.log(`Resultados encontrados: ${resultados.length}`);
      // Log para depurar a estrutura EXATA dos resultados ANTES de enviar
      console.log('Estrutura dos resultados encontrados:', JSON.stringify(resultados, null, 2));
      
      return res.status(200).json({ sucesso: true, dados: resultados });

    } catch (error) {
      console.error('Erro na consulta de CNPJ:', error);
      return res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor ao consultar CNPJ.' });
    }
  }
}; 