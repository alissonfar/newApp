const xlsx = require('xlsx');
const EverestCnpjAccess = require('../../models/EverestCnpjAccess'); // Ajustar o caminho conforme a estrutura final
const fs = require('fs').promises; // Para operações de arquivo assíncronas, se necessário

/**
 * Processa um arquivo Excel (.xlsx) contendo dados de CNPJ e Usuário,
 * lendo as abas 'EMISSÃO'/'EMISSAO' e 'RECEBIMENTO', limpando os dados antigos
 * e inserindo os novos no banco de dados.
 *
 * @param {string} filePath O caminho para o arquivo .xlsx a ser processado.
 * @returns {Promise<object>} Uma promessa que resolve com um objeto contendo o status e detalhes do processamento.
 */
async function processarPlanilhaCnpj(filePath) {
  console.log(`Iniciando processamento do arquivo: ${filePath}`);
  const resultados = {
    sucesso: false,
    registrosEmissaoProcessados: 0,
    registrosRecebimentoProcessados: 0,
    erros: [],
  };

  try {
    // 1. Ler o arquivo Excel
    const workbook = xlsx.readFile(filePath);
    const sheetNames = workbook.SheetNames;

    console.log('Abas encontradas:', sheetNames);

    // Nomes esperados para as abas (case-insensitive e com/sem acento)
    const abaEmissaoNome = sheetNames.find(name => 
        name.toUpperCase() === 'EMISSAO' || name.toUpperCase() === 'EMISSÃO'
    );
    const abaRecebimentoNome = sheetNames.find(name => name.toUpperCase() === 'RECEBIMENTO');

    // 2. Processar Aba de Emissão (se existir)
    if (abaEmissaoNome) {
      console.log(`Processando aba: ${abaEmissaoNome}`);
      const { count, errors } = await processarAba(workbook, abaEmissaoNome, 'EMISSAO', 'CNPJ_EMISSAO');
      resultados.registrosEmissaoProcessados = count;
      resultados.erros.push(...errors.map(e => `[${abaEmissaoNome}] ${e}`));
    } else {
      console.warn('Aba de Emissão (EMISSAO ou EMISSÃO) não encontrada.');
      // Decidir se a ausência de uma aba é um erro ou apenas um aviso
      // resultados.erros.push('Aba de Emissão não encontrada.');
    }

    // 3. Processar Aba de Recebimento (se existir)
    if (abaRecebimentoNome) {
      console.log(`Processando aba: ${abaRecebimentoNome}`);
      const { count, errors } = await processarAba(workbook, abaRecebimentoNome, 'RECEBIMENTO', 'CNPJ_RECEBIMENTO');
      resultados.registrosRecebimentoProcessados = count;
      resultados.erros.push(...errors.map(e => `[${abaRecebimentoNome}] ${e}`));
    } else {
      console.warn('Aba de Recebimento não encontrada.');
      // resultados.erros.push('Aba de Recebimento não encontrada.');
    }

    // 4. Definir sucesso geral (pode depender se alguma aba foi processada)
    const houveProcessamento = resultados.registrosEmissaoProcessados > 0 || resultados.registrosRecebimentoProcessados > 0;
    const houveErroCritico = resultados.erros.some(e => e.toLowerCase().includes('crítico') || e.toLowerCase().includes('cabeçalho')); // Exemplo de critério
    
    resultados.sucesso = houveProcessamento && !houveErroCritico;
    
    console.log('Processamento concluído.', resultados);

  } catch (error) {
    console.error('Erro geral no processamento da planilha:', error);
    resultados.erros.push(`Erro fatal: ${error.message}`);
    resultados.sucesso = false;
  } finally {
    // Opcional: Limpar o arquivo temporário se necessário
    // try {
    //   await fs.unlink(filePath);
    //   console.log(`Arquivo temporário ${filePath} removido.`);
    // } catch (unlinkError) {
    //   console.error(`Erro ao remover arquivo temporário ${filePath}:`, unlinkError);
    // }
  }

  return resultados;
}

/**
 * Processa uma única aba da planilha, lidando com múltiplos pares de colunas USUARIO/CNPJ.
 * @param {object} workbook Objeto workbook do xlsx.
 * @param {string} sheetName Nome da aba a processar.
 * @param {string} tipoOrigem Valor 'EMISSAO' ou 'RECEBIMENTO'.
 * @param {string} nomeColunaCnpj Nome exato da coluna CNPJ esperada nesta aba.
 * @returns {Promise<object>} Contagem de registros processados e erros encontrados.
 */
async function processarAba(workbook, sheetName, tipoOrigem, nomeColunaCnpj) {
  let count = 0; // Contará upserts (inserts + updates)
  const errors = [];
  let skippedEmpty = 0;
  let skippedInvalidCnpj = 0;
  const usuariosUnicos = new Set();
  let totalLinhasProcessadas = 0;
  let successfulUpserts = 0;
  let failedUpserts = 0;

  try { // <-- Try principal
    console.log(`[${tipoOrigem}] Limpando dados antigos...`);
    const deleteResult = await EverestCnpjAccess.deleteMany({ tipoOrigem });
    console.log(`[${tipoOrigem}] Dados antigos removidos: ${deleteResult.deletedCount}`);

    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: null });
    console.log(`[${tipoOrigem}] Total de linhas lidas da aba (incluindo cabeçalho): ${jsonData.length}`);

    if (!jsonData || jsonData.length < 2) {
        throw new Error(`Aba ${sheetName} está vazia ou contém apenas cabeçalho.`);
    }
    
    const headerRow = jsonData[0];
    const nomeColunaCnpjUpper = nomeColunaCnpj.toUpperCase();
    const nomeColunaUsuarioUpper = 'USUARIO';
    const paresDeColunas = []; 
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
        const headerUsuario = headerRow[colIndex] ? String(headerRow[colIndex]).toUpperCase().trim() : null;
        if (headerUsuario === nomeColunaUsuarioUpper && (colIndex + 1 < headerRow.length)) {
            const headerCnpj = headerRow[colIndex + 1] ? String(headerRow[colIndex + 1]).toUpperCase().trim() : null;
            if (headerCnpj === nomeColunaCnpjUpper) {
                paresDeColunas.push({ usuarioIndex: colIndex, cnpjIndex: colIndex + 1 });
            }
        }
    }
    console.log(`[${tipoOrigem}] Cabeçalhos lidos (linha 1): ${headerRow.map(h => `'${h ?? ""}'`).join(', ')}`);
    console.log(`[${tipoOrigem}] Pares de colunas encontrados (Usuario/CNPJ):`, paresDeColunas);
    if (paresDeColunas.length === 0) {
      throw new Error(`Nenhum par de colunas '${nomeColunaUsuarioUpper}' / '${nomeColunaCnpjUpper}' encontrado na aba ${sheetName}.`);
    }

    console.log(`[${tipoOrigem}] Iniciando processamento individual sobre ${jsonData.length - 1} linhas de dados...`);
    for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
      const row = jsonData[rowIndex];
      totalLinhasProcessadas++;
      let linhaTeveDadosValidos = false;

      if (!Array.isArray(row)) { skippedEmpty++; continue; }

      for (const par of paresDeColunas) {
        if (row.length <= Math.max(par.usuarioIndex, par.cnpjIndex)) { continue; }

        const usuario = row[par.usuarioIndex];
        const cnpjRaw = row[par.cnpjIndex];
        
        if (cnpjRaw === null || cnpjRaw === undefined || String(cnpjRaw).trim() === '' || 
            usuario === null || usuario === undefined || String(usuario).trim() === '') {
          continue; 
        }
        
        linhaTeveDadosValidos = true; 
        let cnpjLimpo = String(cnpjRaw).replace(/\D/g, '');
        
        if (cnpjLimpo.length === 13) { cnpjLimpo = '0' + cnpjLimpo; }
        
        if (cnpjLimpo.length !== 14) {
          const errorMsg = `Linha ${rowIndex + 1}, Col ${par.cnpjIndex + 1}: CNPJ '${cnpjRaw}' inválido. Pulando par.`;
          errors.push(errorMsg); 
          skippedInvalidCnpj++;
          continue; 
        }
        
        const usuarioStr = String(usuario).trim();
        usuariosUnicos.add(usuarioStr); 
        
        try {
          const upsertResult = await EverestCnpjAccess.updateOne(
            { cnpj: cnpjLimpo, tipoOrigem: tipoOrigem },
            { $set: { usuario: usuarioStr } },
            { upsert: true }
          );
          if (upsertResult.acknowledged) {
             successfulUpserts++;
          } else {
             failedUpserts++;
             errors.push(`Falha no upsert para CNPJ ${cnpjLimpo} (linha ${rowIndex + 1}) - não reconhecido.`);
          }
        } catch (upsertError) {
          console.error(`[${tipoOrigem}] Erro no upsert para CNPJ ${cnpjLimpo} (linha ${rowIndex + 1}):`, upsertError);
          errors.push(`Erro no upsert para CNPJ ${cnpjLimpo}: ${upsertError.message}`);
          failedUpserts++;
        }
        
      } // Fim loop pares
      
      if (!linhaTeveDadosValidos && Array.isArray(row) && row.every(cell => cell === null || String(cell).trim() === '')) {
           skippedEmpty++;
      }

    } // Fim loop linhas
    
    count = successfulUpserts; 
    
    console.log(`[${tipoOrigem}] Fim do processamento. Total Linhas Dados: ${totalLinhasProcessadas}. Linhas vazias: ${skippedEmpty}, Pares CNPJ inválido: ${skippedInvalidCnpj}`);
    console.log(`[${tipoOrigem}] Total de usuários únicos encontrados: ${usuariosUnicos.size}`);
    console.log(`[${tipoOrigem}] Total de operações Upsert bem-sucedidas: ${successfulUpserts}`);
    if(failedUpserts > 0) {
       console.warn(`[${tipoOrigem}] Total de operações Upsert que falharam: ${failedUpserts}`);
    }

  } catch (error) { // <-- Catch principal (agora pega erros de leitura, conexão, etc.)
    console.error(`[${tipoOrigem}] Erro crítico INESPERADO durante o processamento da aba ${sheetName}:`, error);
    errors.push(`Erro crítico inesperado ao processar aba: ${error.message}`);
    count = 0; // Zera contagem em caso de erro fatal aqui
  } // Fim do catch principal

  return { count, errors };
}

module.exports = {
  processarPlanilhaCnpj,
}; 