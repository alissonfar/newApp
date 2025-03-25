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
const processarCSV = (dados, usuario) => {
  // Remove o cabeçalho e linhas vazias
  const linhas = dados.filter(linha => linha.length >= 4 && linha[0] !== 'Data');
  
  return linhas.map((linha, index) => {
    // Extrai os dados do CSV
    const [data, valorStr, identificador, descricao] = linha;
    
    // Processa o valor (remove o sinal de negativo se houver)
    const valor = Math.abs(parseFloat(valorStr || 0));
    
    // Detecta o tipo baseado no valor original (gastos são negativos no Nubank)
    const tipo = parseFloat(valorStr) < 0 ? 'gasto' : 'recebivel';
    
    // Transforma CSV em formato padrão
    return {
      tipo: tipo,
      descricao: descricao || `Transação #${index + 1}`,
      valor: valor,
      data: normalizarData(data), // Converte do formato DD/MM/YYYY para YYYY-MM-DD
      observacao: `Importado do Nubank - ID: ${identificador}`,
      pagamentos: [
        {
          pessoa: usuario.nome || 'Não especificado',
          valor: valor,
          tags: {} // Tags vazias por padrão, podem ser adicionadas na edição
        }
      ],
      identificador: identificador || `import-${Date.now()}-${index}`,
      dataImportacao: new Date().toISOString(),
      usuario: usuario.id
    };
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
  if (!data) return new Date().toISOString().split('T')[0];
  
  // Verifica se a data está no formato DD/MM/YYYY
  if (data.includes('/')) {
    const [dia, mes, ano] = data.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  
  // Se já estiver no formato YYYY-MM-DD, retorna como está
  if (data.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return data;
  }
  
  // Para outros formatos, tenta converter ou retorna a data atual
  try {
    const dataObj = new Date(data);
    return dataObj.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
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