/**
 * Middleware para transformação de dados de transações em massa
 * Este módulo processa os dados de entrada de diferentes formatos
 * e os converte para o formato padrão utilizado pelo sistema
 */

/**
 * Processa e transforma dados no formato padrão da aplicação
 * @param {Array|Object} dados - Dados a serem processados
 * @param {String} formato - Formato de origem dos dados ('csv', 'json', 'manual')
 * @param {Object} usuario - Informações do usuário logado
 * @returns {Array} Array de transações no formato padrão
 */
export const processarDados = (dados, formato, usuario) => {
  // Normaliza dados para sempre trabalhar com um array
  let dadosArray = Array.isArray(dados) ? dados : [dados];
  
  switch (formato) {
    case 'csv':
      return processarCSV(dadosArray, usuario);
    case 'json':
      return processarJSON(dadosArray, usuario);
    case 'manual':
      return processarManual(dadosArray, usuario);
    default:
      throw new Error(`Formato não suportado: ${formato}`);
  }
};

/**
 * Processa dados no formato CSV
 * @param {Array} linhas - Linhas do CSV já convertidas em array
 * @param {Object} usuario - Informações do usuário
 * @returns {Array} Transações no formato padrão
 */
const processarCSV = (linhas, usuario) => {
  // A primeira linha é considerada como cabeçalho
  const cabecalho = linhas[0];
  const dados = linhas.slice(1);
  
  return dados.map((linha, index) => {
    // Mapeia os campos do CSV para o formato padrão
    const transacao = {
      tipo: detectarTipo(linha[cabecalho.indexOf('valor') || 0]),
      descricao: linha[cabecalho.indexOf('descricao') || 0] || `Transação #${index + 1}`,
      valor: Math.abs(parseFloat(linha[cabecalho.indexOf('valor') || 0] || 0)),
      data: normalizarData(linha[cabecalho.indexOf('data') || 0]),
      observacao: linha[cabecalho.indexOf('observacao') || 0] || '',
      pagamentos: [
        {
          pessoa: linha[cabecalho.indexOf('pessoa') || 0] || usuario.nome || 'Não especificado',
          valor: Math.abs(parseFloat(linha[cabecalho.indexOf('valor') || 0] || 0)),
          tags: processarTags(linha[cabecalho.indexOf('tags') || 0] || '')
        }
      ],
      identificador: linha[cabecalho.indexOf('identificador') || 0] || `import-${Date.now()}-${index}`,
      dataImportacao: new Date().toISOString(),
      usuario: usuario.id
    };
    
    return transacao;
  });
};

/**
 * Processa dados no formato JSON
 * @param {Array} dados - Array de objetos JSON
 * @param {Object} usuario - Informações do usuário
 * @returns {Array} Transações no formato padrão
 */
const processarJSON = (dados, usuario) => {
  return dados.map((item, index) => {
    const valor = Math.abs(parseFloat(item.valor || 0));
    
    // Transforma JSON em formato padrão
    return {
      tipo: item.tipo || detectarTipo(item.valor),
      descricao: item.descricao || `Transação #${index + 1}`,
      valor: valor,
      data: normalizarData(item.data),
      observacao: item.observacao || '',
      pagamentos: item.pagamentos || [
        {
          pessoa: item.pessoa || usuario.nome || 'Não especificado',
          valor: valor,
          tags: item.tags || {}
        }
      ],
      identificador: item.identificador || `import-${Date.now()}-${index}`,
      dataImportacao: new Date().toISOString(),
      usuario: usuario.id
    };
  });
};

/**
 * Processa dados inseridos manualmente
 * @param {Array} dados - Dados manuais
 * @param {Object} usuario - Informações do usuário
 * @returns {Array} Transações no formato padrão
 */
const processarManual = (dados, usuario) => {
  // Para entrada manual, assumimos que os dados já estão mais próximos do formato desejado
  return dados.map((item, index) => {
    const valor = Math.abs(parseFloat(item.valor || 0));
    
    // Validação e normalização básica dos dados manuais
    return {
      tipo: item.tipo || 'gasto',
      descricao: item.descricao || `Transação #${index + 1}`,
      valor: valor,
      data: normalizarData(item.data),
      observacao: item.observacao || '',
      pagamentos: Array.isArray(item.pagamentos) ? item.pagamentos : [
        {
          pessoa: item.pessoa || usuario.nome || 'Não especificado',
          valor: valor,
          tags: item.tags || {}
        }
      ],
      identificador: item.identificador || `import-${Date.now()}-${index}`,
      dataImportacao: new Date().toISOString(),
      usuario: usuario.id
    };
  });
};

/**
 * Detecta o tipo de transação (gasto ou recebível) com base no valor
 * @param {Number|String} valor - Valor da transação
 * @returns {String} 'gasto' ou 'recebivel'
 */
const detectarTipo = (valor) => {
  const valorNumerico = parseFloat(valor);
  // Se o valor for negativo ou contiver sinal de menos, consideramos como gasto
  if (valorNumerico < 0 || String(valor).includes('-')) {
    return 'gasto';
  }
  return 'recebivel';
};

/**
 * Normaliza uma data para o formato ISO
 * @param {String|Date} data - Data a ser normalizada
 * @returns {String} Data no formato ISO 8601
 */
const normalizarData = (data) => {
  if (!data) {
    return new Date().toISOString();
  }
  
  try {
    // Tenta converter para objeto Date
    const dataObj = new Date(data);
    if (isNaN(dataObj.getTime())) {
      return new Date().toISOString();
    }
    return dataObj.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
};

/**
 * Processa tags de uma string para o formato de objeto
 * @param {String} tagsString - String contendo tags separadas por vírgula ou outro delimitador
 * @returns {Object} Objeto com categorias e tags
 */
const processarTags = (tagsString) => {
  if (!tagsString || typeof tagsString !== 'string') {
    return {};
  }
  
  // Formato padrão de retorno: { Categoria: [tag1, tag2] }
  // Aqui assumimos um formato simples onde todas as tags pertencem a uma categoria "Geral"
  const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
  
  if (tags.length === 0) {
    return {};
  }
  
  return {
    'Geral': tags
  };
};

/**
 * Valida um conjunto de transações
 * @param {Array} transacoes - Array de transações a serem validadas
 * @returns {Object} Resultado da validação com status e mensagens de erro
 */
export const validarTransacoes = (transacoes) => {
  if (!Array.isArray(transacoes) || transacoes.length === 0) {
    return {
      valido: false,
      erros: ['Nenhuma transação para processar.']
    };
  }
  
  const erros = [];
  
  transacoes.forEach((transacao, index) => {
    const errosTransacao = [];
    
    // Validações básicas
    if (!transacao.tipo || !['gasto', 'recebivel'].includes(transacao.tipo)) {
      errosTransacao.push(`Tipo inválido. Deve ser "gasto" ou "recebivel".`);
    }
    
    if (!transacao.descricao) {
      errosTransacao.push(`Descrição é obrigatória.`);
    }
    
    if (!transacao.valor || isNaN(transacao.valor) || transacao.valor <= 0) {
      errosTransacao.push(`Valor deve ser um número positivo.`);
    }
    
    if (!transacao.data || isNaN(new Date(transacao.data).getTime())) {
      errosTransacao.push(`Data inválida.`);
    }
    
    if (!Array.isArray(transacao.pagamentos) || transacao.pagamentos.length === 0) {
      errosTransacao.push(`Pagamentos inválidos.`);
    } else {
      transacao.pagamentos.forEach((pagamento, idx) => {
        if (!pagamento.pessoa) {
          errosTransacao.push(`Pessoa do pagamento ${idx + 1} é obrigatória.`);
        }
        
        if (!pagamento.valor || isNaN(pagamento.valor) || pagamento.valor <= 0) {
          errosTransacao.push(`Valor do pagamento ${idx + 1} deve ser um número positivo.`);
        }
      });
    }
    
    if (errosTransacao.length > 0) {
      erros.push({
        indice: index,
        transacao,
        erros: errosTransacao
      });
    }
  });
  
  return {
    valido: erros.length === 0,
    erros
  };
}; 