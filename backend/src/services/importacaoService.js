const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const csv = require('csv-parse');
const mongoose = require('mongoose');
const Importacao = require('../models/importacao');
const TransacaoImportada = require('../models/transacaoImportada');
const Transacao = require('../models/transacao');
const Usuario = require('../models/usuarios');
const inferenciaPessoaService = require('./inferenciaPessoaService');

/**
 * Mescla tagsPadrao da importação em cada pagamento, sem duplicar.
 * @param {Array} pagamentos - Array de { pessoa, valor, tags }
 * @param {Object} tagsPadrao - { [categoriaId]: [tagId, tagId, ...] }
 * @returns {Array} Pagamentos com tags mescladas
 */
function mergeTagsPadrao(pagamentos, tagsPadrao) {
  if (!tagsPadrao || typeof tagsPadrao !== 'object' || Object.keys(tagsPadrao).length === 0) {
    return pagamentos;
  }
  return pagamentos.map((p) => {
    const tagsAtuais = p.tags && typeof p.tags === 'object' ? { ...p.tags } : {};
    Object.keys(tagsPadrao).forEach((catId) => {
      const tagsNovas = Array.isArray(tagsPadrao[catId]) ? tagsPadrao[catId] : [];
      const existentes = Array.isArray(tagsAtuais[catId]) ? tagsAtuais[catId] : [];
      tagsAtuais[catId] = [...new Set([...existentes.map(String), ...tagsNovas.map(String)])];
    });
    return { ...p, tags: tagsAtuais };
  });
}

/**
 * Normaliza descrição para chave de deduplicação.
 * @param {string} descricao
 * @returns {string}
 */
function normalizarDescricao(descricao) {
  if (!descricao || typeof descricao !== 'string') return '';
  return descricao
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ');
}

/**
 * Formata data para YYYY-MM-DD (evita timezone).
 * @param {Date} data
 * @returns {string}
 */
function formatarDataISO(data) {
  if (!data) return '';
  const d = new Date(data);
  const ano = d.getUTCFullYear();
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(d.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/**
 * Gera chave determinística para deduplicação.
 * Fórmula: SHA256(usuarioId | descricao_normalizada | valor | data_iso | tipo | identificador [| installmentGroupId | installmentNumber])
 * @param {string} usuarioId
 * @param {Object} dados - { descricao, valor, data, tipo, identificador, installmentGroupId, installmentNumber }
 * @returns {string}
 */
function gerarDeduplicationKey(usuarioId, dados) {
  const descricao = normalizarDescricao(dados.descricao || '');
  const valor = Math.abs(parseFloat(dados.valor) || 0).toFixed(2);
  const data = formatarDataISO(dados.data);
  const tipo = (dados.tipo === 'recebivel' ? 'recebivel' : 'gasto');
  const identificador = (dados.identificador || '').trim();
  let composicao = `${usuarioId}|${descricao}|${valor}|${data}|${tipo}|${identificador}`;
  if (dados.installmentGroupId && dados.installmentNumber != null) {
    composicao += `|${String(dados.installmentGroupId)}|${dados.installmentNumber}`;
  }
  return crypto.createHash('sha256').update(composicao).digest('hex');
}

/**
 * Janela (em dias) para detecção de possível duplicata com data diferente.
 * Ex: compra dia 5 importada inicialmente; na fatura consolidada do final do mês
 * a mesma compra pode aparecer com dia 6 (variação de 1 dia). ±7 dias cobre o
 * caso sem gerar muitos falsos positivos para assinaturas mensais.
 */
const JANELA_POSSIVEL_DUPLICATA_DIAS = 7;
const TOLERANCIA_VALOR = 0.01;

/**
 * Procura uma transação ativa existente com a mesma descrição (normalizada)
 * e mesmo valor (±R$ 0.01), mas com data diferente dentro de ±JANELA dias.
 * Retorna a transação existente mais próxima em data, ou null.
 */
async function buscarPossivelDuplicata(usuarioId, transacao) {
  const valorAbs = Math.abs(parseFloat(transacao.valor) || 0);
  const dataObj = new Date(transacao.data);
  if (isNaN(dataObj.getTime())) return null;

  const dataMin = new Date(dataObj.getTime() - JANELA_POSSIVEL_DUPLICATA_DIAS * 86400000);
  const dataMax = new Date(dataObj.getTime() + JANELA_POSSIVEL_DUPLICATA_DIAS * 86400000);

  const descricaoEscaped = (transacao.descricao || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!descricaoEscaped) return null;

  const candidatas = await Transacao.find({
    usuario: usuarioId,
    status: 'ativo',
    descricao: new RegExp(`^\\s*${descricaoEscaped}\\s*$`, 'i'),
    valor: { $gte: valorAbs - TOLERANCIA_VALOR, $lte: valorAbs + TOLERANCIA_VALOR },
    data: { $gte: dataMin, $lte: dataMax, $ne: dataObj }
  }).lean();

  if (!candidatas || candidatas.length === 0) return null;

  // Pegar a mais próxima em data
  candidatas.sort((a, b) => {
    const distA = Math.abs(new Date(a.data).getTime() - dataObj.getTime());
    const distB = Math.abs(new Date(b.data).getTime() - dataObj.getTime());
    return distA - distB;
  });
  return candidatas[0];
}

/**
 * Classifica transações parseadas em novas, já importadas, já ignoradas e possíveis duplicatas.
 * "Possíveis duplicatas" são transações NOVAS (não bateram no match exato) que têm
 * uma transação ativa existente com mesma descrição + valor, mas data diferente (≤ ±7 dias).
 * @param {Array} transacoesParseadas - Array retornado por parseCSV
 * @param {string} usuarioId
 * @returns {Promise<{ novas: Array, jaImportadas: Array, jaIgnoradas: Array, possiveisDuplicatas: Array }>}
 */
async function classificarTransacoes(transacoesParseadas, usuarioId) {
  const novas = [];
  const jaImportadas = [];
  const jaIgnoradas = [];
  const possiveisDuplicatas = [];

  for (const transacao of transacoesParseadas) {
    const key = gerarDeduplicationKey(usuarioId, transacao);

    // 1. Busca Transacao ativa (já importada) - match EXATO
    let existeTransacao = await Transacao.findOne({
      usuario: usuarioId,
      deduplicationKey: key,
      status: 'ativo'
    }).lean();

    // Fallback: transações antigas sem deduplicationKey
    if (!existeTransacao) {
      const valorAbs = Math.abs(parseFloat(transacao.valor) || 0);
      const dataObj = new Date(transacao.data);
      const startOfDay = new Date(Date.UTC(dataObj.getUTCFullYear(), dataObj.getUTCMonth(), dataObj.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(dataObj.getUTCFullYear(), dataObj.getUTCMonth(), dataObj.getUTCDate(), 23, 59, 59, 999));
      const descricaoEscaped = (transacao.descricao || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      existeTransacao = await Transacao.findOne({
        usuario: usuarioId,
        $or: [{ deduplicationKey: null }, { deduplicationKey: { $exists: false } }],
        status: 'ativo',
        valor: valorAbs,
        data: { $gte: startOfDay, $lte: endOfDay },
        descricao: new RegExp(`^\\s*${descricaoEscaped}\\s*$`, 'i')
      }).lean();
    }

    if (existeTransacao) {
      jaImportadas.push({ ...transacao, deduplicationKey: key });
      continue;
    }

    // 2. Busca TransacaoImportada ignorada (decisão anterior do usuário)
    let existeIgnorada = await TransacaoImportada.findOne({
      usuario: usuarioId,
      deduplicationKey: key,
      status: 'ignorada'
    }).lean();

    // Fallback: TransacaoImportada ignorada sem deduplicationKey
    if (!existeIgnorada) {
      const valorAbs = Math.abs(parseFloat(transacao.valor) || 0);
      const dataObj = new Date(transacao.data);
      const startOfDay = new Date(Date.UTC(dataObj.getUTCFullYear(), dataObj.getUTCMonth(), dataObj.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(dataObj.getUTCFullYear(), dataObj.getUTCMonth(), dataObj.getUTCDate(), 23, 59, 59, 999));
      const descricaoEscaped = (transacao.descricao || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      existeIgnorada = await TransacaoImportada.findOne({
        usuario: usuarioId,
        status: 'ignorada',
        $or: [{ deduplicationKey: null }, { deduplicationKey: { $exists: false } }],
        valor: valorAbs,
        data: { $gte: startOfDay, $lte: endOfDay },
        descricao: new RegExp(`^\\s*${descricaoEscaped}\\s*$`, 'i')
      }).lean();
    }

    if (existeIgnorada) {
      jaIgnoradas.push({ ...transacao, deduplicationKey: key });
      continue;
    }

    // 3. Match FUZZY: mesma descrição + valor, mas data diferente (±7 dias)
    //    Detecta casos raros onde Nubank consolida uma transação em outra data
    //    (ex: compra dia 5 importada antes; na fatura do final do mês vira dia 6).
    const transacaoSemelhante = await buscarPossivelDuplicata(usuarioId, transacao);
    if (transacaoSemelhante) {
      const dataObj = new Date(transacao.data);
      const dataSem = new Date(transacaoSemelhante.data);
      const distanciaDias = Math.round(Math.abs(dataSem.getTime() - dataObj.getTime()) / 86400000);
      possiveisDuplicatas.push({
        ...transacao,
        deduplicationKey: key,
        transacaoSemelhanteId: transacaoSemelhante._id,
        transacaoSemelhanteDistanciaDias: distanciaDias,
        transacaoSemelhanteData: transacaoSemelhante.data,
        transacaoSemelhanteValor: transacaoSemelhante.valor,
        transacaoSemelhanteDescricao: transacaoSemelhante.descricao
      });
    } else {
      novas.push({ ...transacao, deduplicationKey: key });
    }
  }

  return { novas, jaImportadas, jaIgnoradas, possiveisDuplicatas };
}

class ImportacaoService {
  constructor() {
    this.validadorTransacao = require('./validadorTransacaoService');
  }

  /**
   * Processa um arquivo JSON
   * @param {string} caminhoArquivo - Caminho do arquivo
   * @param {string} importacaoId - ID da importação
   * @param {string} usuarioId - ID do usuário
   */
  async processarArquivoJSON(caminhoArquivo, importacaoId, usuarioId) {
    try {
      const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
      const dados = JSON.parse(conteudo);

      if (!dados.transacoes || !Array.isArray(dados.transacoes)) {
        throw new Error('Formato de arquivo JSON inválido. Esperado: { transacoes: [] }');
      }

      const importacao = await Importacao.findOne({ _id: importacaoId, usuario: usuarioId });
      if (!importacao) throw new Error('Importação não encontrada ou não pertence ao usuário.');
      importacao.totalRegistros = dados.transacoes.length;
      await importacao.save();

      for (const [index, transacao] of dados.transacoes.entries()) {
        try {
          await this.processarTransacao(transacao, importacaoId, usuarioId);
          importacao.registrosProcessados++;
          await importacao.save();
        } catch (error) {
          importacao.registrosComErro++;
          await importacao.save();
          console.error(`Erro ao processar transação ${index}:`, error);
        }
      }

      importacao.status = 'finalizada';
      await importacao.save();
    } catch (error) {
      const importacao = await Importacao.findOne({ _id: importacaoId, usuario: usuarioId });
      if (importacao) {
        importacao.status = 'erro';
        importacao.erro = error.message;
        await importacao.save();
      }
      throw error;
    }
  }

  /**
   * Processa um arquivo CSV
   * @param {string} caminhoArquivo - Caminho do arquivo
   * @param {string} importacaoId - ID da importação
   * @param {string} usuarioId - ID do usuário
   */
  async processarArquivoCSV(caminhoArquivo, importacaoId, usuarioId) {
    try {
      // Lê o arquivo como buffer para detectar e converter a codificação
      const buffer = await fs.readFile(caminhoArquivo);
      const iconv = require('iconv-lite');
      const chardet = require('chardet');
      
      // Detecta a codificação do arquivo
      const encoding = chardet.detect(buffer);
      
      // Converte para UTF-8 se necessário
      const conteudo = encoding && encoding.toLowerCase() !== 'utf-8' 
        ? iconv.decode(buffer, encoding)
        : buffer.toString('utf-8');

      const parser = csv.parse(conteudo, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        encoding: 'utf-8',
        bom: true, // Adiciona suporte a BOM
        delimiter: ',', // Força o delimitador como vírgula
        from_line: 1 // Começa da primeira linha
      });

      const importacao = await Importacao.findOne({ _id: importacaoId, usuario: usuarioId });
      if (!importacao) throw new Error('Importação não encontrada ou não pertence ao usuário.');
      const linhas = conteudo.split('\n').length - 1; // -1 para excluir o cabeçalho
      importacao.totalRegistros = linhas;
      await importacao.save();

      console.log('Iniciando processamento do CSV...'); // Debug

      for await (const registro of parser) {
        try {
          console.log('Registro original:', registro); // Debug
          const transacao = {
            descricao: registro['Descrição'] || registro.Descricao || '',
            valor: Math.abs(parseFloat(registro['Valor'].replace(',', '.')) || 0),
            data: this.converterData(registro['Data']),
            tipo: parseFloat(registro['Valor']) < 0 ? 'gasto' : 'recebivel',
            categoria: null,
            identificador: registro['Identificador'],
            observacao: `Importado do Nubank - ID: ${registro['Identificador']}`,
            pagamentos: [{
              pessoa: 'Titular',
              valor: Math.abs(parseFloat(registro['Valor'].replace(',', '.')) || 0),
              tags: {}
            }]
          };

          console.log('Transação mapeada:', transacao); // Debug
          await this.processarTransacao(transacao, importacaoId, usuarioId);
          importacao.registrosProcessados++;
          await importacao.save();
        } catch (error) {
          console.error('Erro ao processar registro:', error); // Debug
          importacao.registrosComErro++;
          await importacao.save();
        }
      }

      importacao.status = 'finalizada';
      await importacao.save();
    } catch (error) {
      console.error('Erro geral no processamento:', error); // Debug
      const importacao = await Importacao.findOne({ _id: importacaoId, usuario: usuarioId });
      if (importacao) {
        importacao.status = 'erro';
        importacao.erro = error.message;
        await importacao.save();
      }
      throw error;
    }
  }

  /**
   * Converte uma data do formato DD/MM/YYYY para um objeto Date
   * @param {string} dataStr - Data no formato DD/MM/YYYY
   * @returns {Date} Objeto Date
   */
  converterData(dataStr) {
    const [dia, mes, ano] = dataStr.split('/');
    // Define o horário como 12:00 para evitar problemas com timezone
    return new Date(ano, mes - 1, dia, 12, 0, 0);
  }

  /**
   * Processa uma transação individual
   * @param {Object} dados - Dados da transação
   * @param {string} importacaoId - ID da importação
   * @param {string} usuarioId - ID do usuário
   */
  async processarTransacao(dados, importacaoId, usuarioId) {
    try {
      // Validar dados
      await this.validadorTransacao.validarCamposObrigatorios(dados);
      await this.validadorTransacao.validarFormatos(dados);
      await this.validadorTransacao.validarRegrasNegocio(dados);

      // Criar transação importada
      const transacao = new TransacaoImportada({
        importacao: importacaoId,
        usuario: usuarioId,
        descricao: dados.descricao,
        valor: dados.valor,
        data: dados.data,
        tipo: dados.tipo,
        categoria: dados.categoria,
        status: 'pendente',
        dadosOriginais: dados
      });

      await transacao.save();
    } catch (error) {
      const transacao = new TransacaoImportada({
        importacao: importacaoId,
        usuario: usuarioId,
        dadosOriginais: dados,
        status: 'erro',
        erro: error.message
      });

      await transacao.save();
      throw error;
    }
  }

  /**
   * Pausa uma importação em andamento
   * @param {string} importacaoId - ID da importação
   * @param {string} usuarioId - ID do usuário
   */
  async pausarImportacao(importacaoId, usuarioId) {
    const importacao = await Importacao.findOne({
      _id: importacaoId,
      usuario: usuarioId,
      status: 'em_andamento'
    });

    if (!importacao) {
      throw new Error('Importação não encontrada ou não está em andamento.');
    }

    importacao.status = 'pausada';
    await importacao.save();
  }

  /**
   * Continua uma importação pausada
   * @param {string} importacaoId - ID da importação
   * @param {string} usuarioId - ID do usuário
   */
  async continuarImportacao(importacaoId, usuarioId) {
    const importacao = await Importacao.findOne({
      _id: importacaoId,
      usuario: usuarioId,
      status: 'pausada'
    });

    if (!importacao) {
      throw new Error('Importação não encontrada ou não está pausada.');
    }

    importacao.status = 'em_andamento';
    await importacao.save();

    // Retomar processamento
    if (importacao.tipoArquivo === 'json') {
      await this.processarArquivoJSON(
        path.join('uploads/importacao', importacao.nomeArquivo),
        importacaoId,
        usuarioId
      );
    } else {
      await this.processarArquivoCSV(
        path.join('uploads/importacao', importacao.nomeArquivo),
        importacaoId,
        usuarioId
      );
    }
  }

  /**
   * Cancela uma importação
   * @param {string} importacaoId - ID da importação
   * @param {string} usuarioId - ID do usuário
   */
  async cancelarImportacao(importacaoId, usuarioId) {
    const importacao = await Importacao.findOne({
      _id: importacaoId,
      usuario: usuarioId,
      status: { $in: ['em_andamento', 'pausada'] }
    });

    if (!importacao) {
      throw new Error('Importação não encontrada ou não pode ser cancelada.');
    }

    importacao.status = 'cancelada';
    await importacao.save();
  }

  static async processarArquivo(importacaoId, usuarioId) {
    try {
      // Busca a importação validando ownership (defesa em profundidade)
      const importacao = await Importacao.findOne({ _id: importacaoId, usuario: usuarioId });
      if (!importacao) {
        throw new Error('Importação não encontrada ou não pertence ao usuário.');
      }

      console.log('[DEBUG] Iniciando processamento do arquivo:', importacao.nomeArquivo);

      // Atualiza status para processando
      importacao.status = 'processando';
      await importacao.save();

      // Busca o proprietário padrão das preferências do usuário
      const usuario = await Usuario.findById(importacao.usuario)
        .select('preferencias.proprietario')
        .lean();
      const proprietarioPadrao = usuario?.preferencias?.proprietario?.trim() || 'Titular';

      // Lê o arquivo
      const conteudoArquivo = await fs.readFile(importacao.caminhoArquivo, 'utf8');
      let transacoes;
      let deteccao = null;

      // Parse via registry (substitui a detecção hardcoded por CSV Nubank/JSON)
      try {
        const parserRegistry = require('./parsers');
        deteccao = parserRegistry.detectar({
          filename: importacao.nomeArquivo,
          conteudo: conteudoArquivo
        });
        console.log('[DEBUG] Parser detectado:', deteccao.parser.id, 'score=', deteccao.score);
        transacoes = deteccao.parser.parse({ conteudo: conteudoArquivo });
        if (!Array.isArray(transacoes)) {
          throw new Error('Parser não retornou um array de transações.');
        }
      } catch (parserErr) {
        if (importacao.caminhoArquivo.endsWith('.json')) {
          console.log('[DEBUG] Fallback: processando arquivo JSON direto');
          transacoes = JSON.parse(conteudoArquivo);
          if (transacoes && transacoes.transacoes && Array.isArray(transacoes.transacoes)) {
            transacoes = transacoes.transacoes;
          }
          if (!Array.isArray(transacoes)) {
            transacoes = [transacoes];
          }
          transacoes = transacoes.map(t => ({
            ...t,
            data: new Date(new Date(t.data).setHours(12, 0, 0, 0))
          }));
        } else if (importacao.caminhoArquivo.endsWith('.csv')) {
          console.log('[DEBUG] Fallback: parseCSV legado');
          transacoes = ImportacaoService.parseCSV(conteudoArquivo);
        } else {
          throw parserErr;
        }
      }

      // Importação complementar: classifica em novas, já importadas, já ignoradas e possíveis duplicatas
      let transacoesParaProcessar = transacoes;
      let totalIgnoradas = 0;
      let totalPossiveisDuplicatas = 0;
      if (importacao.tipoImportacao === 'complementar') {
        console.log('[DEBUG] Importação complementar: classificando transações');
        const { novas, jaImportadas, jaIgnoradas, possiveisDuplicatas } = await classificarTransacoes(transacoes, importacao.usuario.toString());
        transacoesParaProcessar = novas.map(t => ({ ...t, _statusComplementar: 'pendente' }))
          .concat(jaImportadas.map(t => ({ ...t, _statusComplementar: 'ja_importada' })))
          .concat(possiveisDuplicatas.map(t => ({ ...t, _statusComplementar: 'possivel_duplicata' })));
        totalIgnoradas = jaIgnoradas.length;
        totalPossiveisDuplicatas = possiveisDuplicatas.length;
        console.log('[DEBUG] Classificação:', {
          novas: novas.length,
          jaImportadas: jaImportadas.length,
          jaIgnoradas: totalIgnoradas,
          possiveisDuplicatas: totalPossiveisDuplicatas
        });
      }

      // Inicializa progresso ANTES de processar, para que o frontend mostre "0 de Y"
      // Inferência de pessoa responsável a partir do histórico (best-effort)
      let inferenciasPessoa = [];
      try {
        inferenciasPessoa = await inferenciaPessoaService.inferirPessoasEmLote(
          transacoesParaProcessar,
          importacao.usuario
        );
        const totalInferidas = inferenciasPessoa.filter(Boolean).length;
        if (totalInferidas > 0) {
          console.log(`[DEBUG] Inferência de pessoa: ${totalInferidas}/${transacoesParaProcessar.length} sugestões`);
        }
      } catch (inferenciaErr) {
        console.warn('[Importação] Falha na inferência de pessoa (não-bloqueante):', inferenciaErr.message);
        inferenciasPessoa = [];
      }

      importacao.totalEsperado = transacoesParaProcessar.length;
      importacao.totalProcessado = 0;
      importacao.totalPossiveisDuplicatas = totalPossiveisDuplicatas;
      try {
        await importacao.save();
      } catch (progressInitErr) {
        console.warn('[Importação] Falha ao inicializar progresso (não-bloqueante):', progressInitErr.message);
      }

      // Contador compartilhado para progresso incremental (throttled save a cada 5)
      let processadosCount = 0;
      let finalizado = false;
      const totalEsperado = transacoesParaProcessar.length;
      const salvarProgresso = async () => {
        try {
          // Persiste throttled a cada 5 OU no fim. Nunca sobrescreve o save final.
          if (finalizado) return;
          if (processadosCount === totalEsperado || processadosCount % 5 === 0) {
            importacao.totalProcessado = processadosCount;
            await importacao.save();
          }
        } catch (progErr) {
          // Não-bloqueante: progresso é best-effort
          console.warn('[Importação] Falha ao salvar progresso (não-bloqueante):', progErr.message);
        }
      };

      // Processa cada transação
      const tagsPadrao = importacao.tagsPadrao || {};
      console.log('[DEBUG] Iniciando processamento das transações', Object.keys(tagsPadrao).length > 0 ? '(com tags padrão)' : '');
      const resultados = await Promise.all(
        transacoesParaProcessar.map(async (transacao, index) => {
          try {
            const statusInicial = transacao._statusComplementar || 'pendente';
            const transacaoBase = { ...transacao };
            delete transacaoBase._statusComplementar;
            delete transacaoBase.deduplicationKey;
            // Campos de snapshot de possível duplicata ficam fora de transacaoBase para não irem em dadosOriginais
            const snapshotSemelhante = {
              transacaoSemelhanteId: transacao.transacaoSemelhanteId || null,
              transacaoSemelhanteDistanciaDias: transacao.transacaoSemelhanteDistanciaDias != null ? transacao.transacaoSemelhanteDistanciaDias : null,
              transacaoSemelhanteData: transacao.transacaoSemelhanteData || null,
              transacaoSemelhanteValor: transacao.transacaoSemelhanteValor != null ? transacao.transacaoSemelhanteValor : null,
              transacaoSemelhanteDescricao: transacao.transacaoSemelhanteDescricao || null
            };
            // Snapshot da inferência de pessoa (best-effort; null quando não há sugestão)
            const inferencia = inferenciasPessoa[index] || null;
            const snapshotInferencia = {
              pessoaSugerida: inferencia ? inferencia.pessoa : null,
              pessoaSugeridaCount: inferencia ? inferencia.count : null,
              pessoaSugeridaConfianca: inferencia ? inferencia.confianca : null,
              pessoaSugeridaSample: inferencia ? inferencia.sample : null,
              pessoaSugeridaTransacaoIds: inferencia ? inferencia.transacaoIds : null,
              pessoaSugeridaAplicada: false
            };
            const dedupKey = transacao.deduplicationKey || gerarDeduplicationKey(importacao.usuario.toString(), transacaoBase);

            console.log('[DEBUG] Processando transação:', transacaoBase.descricao, 'status:', statusInicial);
            let pagamentosBase = transacaoBase.pagamentos || [{
              pessoa: proprietarioPadrao,
              valor: transacaoBase.valor,
              tags: {}
            }];
            // Aplicar proprietário padrão quando o primeiro pagamento tem "Titular" ou valor genérico
            if (pagamentosBase.length > 0) {
              const primeiraPessoa = pagamentosBase[0].pessoa;
              const ehGenerico = !primeiraPessoa?.trim() ||
                primeiraPessoa.toLowerCase() === 'titular';
              if (ehGenerico) {
                pagamentosBase[0] = { ...pagamentosBase[0], pessoa: proprietarioPadrao };
              }
            }
            const pagamentosComTags = mergeTagsPadrao(pagamentosBase, tagsPadrao);
            const transacaoImportada = new TransacaoImportada({
              data: transacaoBase.data, // A data já está com horário 12:00
              tipo: transacaoBase.tipo,
              valor: transacaoBase.valor,
              descricao: transacaoBase.descricao,
              categoria: transacaoBase.categoria,
              importacao: importacaoId,
              usuario: importacao.usuario,
              dadosOriginais: transacaoBase,
              pagamentos: pagamentosComTags,
              status: statusInicial,
              deduplicationKey: dedupKey,
              isInstallment: transacaoBase.isInstallment || false,
              installmentGroupId: transacaoBase.installmentGroupId || null,
              installmentNumber: transacaoBase.installmentNumber != null ? transacaoBase.installmentNumber : null,
              installmentTotal: transacaoBase.installmentTotal != null ? transacaoBase.installmentTotal : null,
              installmentIntervalMonths: transacaoBase.installmentIntervalMonths != null ? transacaoBase.installmentIntervalMonths : null,
              installmentIntervalDays: transacaoBase.installmentIntervalDays != null ? transacaoBase.installmentIntervalDays : (transacaoBase.installmentIntervalMonths != null ? transacaoBase.installmentIntervalMonths * 30 : null),
              ...snapshotSemelhante,
              ...snapshotInferencia
            });

            await transacaoImportada.validate();
            await transacaoImportada.save();
            processadosCount++;
            // Salva progresso throttled (não-await para não bloquear processamento paralelo)
            salvarProgresso().catch(() => {});
            console.log('[DEBUG] Transação processada com sucesso');
            return { sucesso: true, transacao: transacaoImportada };
          } catch (erro) {
            console.error('[DEBUG] Erro ao processar transação:', erro);
            return {
              sucesso: false,
              erro: erro.message,
              dadosOriginais: transacao
            };
          }
        })
      );

      // Atualiza estatísticas da importação
      const sucessos = resultados.filter(r => r.sucesso).length;
      const falhas = resultados.filter(r => !r.sucesso).length;

      console.log('[DEBUG] Resultados do processamento:', {
        sucessos,
        falhas,
        total: resultados.length
      });

      importacao.totalProcessado = resultados.length;
      importacao.totalSucesso = sucessos;
      importacao.totalErro = falhas;
      importacao.totalIgnoradas = totalIgnoradas;
      importacao.totalPossiveisDuplicatas = totalPossiveisDuplicatas;
      importacao.status = falhas > 0 ? 'erro' : 'validado';
      importacao.erros = resultados
        .filter(r => !r.sucesso)
        .map(r => ({
          mensagem: r.erro,
          dados: r.dadosOriginais
        }));
      finalizado = true; // bloqueia saves throttled em voo

      // Inferência de metadados (nunca bloqueante — falhas são logadas e ignoradas)
      try {
        const inferencia = require('./inferenciaImportacaoService');
        const parserUsado = (deteccao && deteccao.parser) ? deteccao.parser.id : null;
        const meta = inferencia.extrairMetadados({
          transacoes,
          filename: importacao.nomeArquivo,
          parserId: parserUsado
        });
        if (meta.dataInicial) importacao.dataInicial = meta.dataInicial;
        if (meta.dataFinal) importacao.dataFinal = meta.dataFinal;
        if (meta.periodoCompetencia) importacao.periodoCompetencia = meta.periodoCompetencia;
        importacao.totalCreditos = meta.totalCreditos || 0;
        importacao.totalDebitos = meta.totalDebitos || 0;
        if (parserUsado) importacao.origem = parserUsado;
        // Fatura de Cartão de Crédito
        if (meta.isFaturaCartao) {
          if (meta.vencimento) importacao.vencimento = meta.vencimento;
          if (meta.mesVencimento) importacao.mesVencimento = meta.mesVencimento;
          // Recalcular nº complemento de forma consistente
          if (meta.mesVencimento) {
            try {
              const numeroRecalc = await inferencia.contarComplementosAnteriores(Importacao, {
                usuarioId: importacao.usuario,
                parserId: parserUsado,
                mesVencimento: meta.mesVencimento
              });
              importacao.numeroComplemento = numeroRecalc;
              // Re-sugerir título com nº correto
              meta.numeroComplemento = numeroRecalc;
              importacao.descricao = inferencia.sugerirTitulo({
                filename: importacao.nomeArquivo,
                parserId: parserUsado,
                competencia: meta.periodoCompetencia,
                dataInicial: meta.dataInicial,
                dataFinal: meta.dataFinal,
                vencimento: meta.vencimento,
                numeroComplemento: numeroRecalc
              });
            } catch (nCompErr) {
              console.warn('[Importação] Falha ao calcular nº complemento:', nCompErr.message);
            }
          }
        }
        importacao.metadadosInferidos = {
          ...meta,
          parserId: parserUsado,
          inferidoEm: new Date().toISOString()
        };
        console.log('[DEBUG] Metadados inferidos:', meta);
      } catch (inferenciaErr) {
        console.warn('[Importação] Falha ao inferir metadados (não-bloqueante):', inferenciaErr.message);
      }

      await importacao.save();

      // Remove o arquivo após processamento
      await fs.unlink(importacao.caminhoArquivo);

      return {
        sucessos,
        falhas,
        total: resultados.length
      };
    } catch (erro) {
      console.error('[DEBUG] Erro geral no processamento:', erro);
      
      // Atualiza status da importação para erro (valida ownership)
      const importacao = await Importacao.findOne({ _id: importacaoId, usuario: usuarioId });
      if (importacao) {
        importacao.status = 'erro';
        importacao.erro = erro.message;
        await importacao.save();
      }

      throw erro;
    }
  }

  /**
   * Duplica uma importação existente com todas as suas transações.
   * @param {string} importacaoId - ID da importação original
   * @param {string} usuarioId - ID do usuário
   * @returns {Promise<import('mongoose').Document>} Nova importação criada
   */
  static async duplicarImportacao(importacaoId, usuarioId) {
    const STATUS_PERMITIDOS = ['validado', 'finalizada', 'estornada', 'erro'];
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const importacaoOriginal = await Importacao.findOne({
        _id: importacaoId,
        usuario: usuarioId
      }).session(session);

      if (!importacaoOriginal) {
        throw new Error('Importação não encontrada.');
      }

      if (!STATUS_PERMITIDOS.includes(importacaoOriginal.status)) {
        throw new Error(
          `Não é possível duplicar uma importação com status "${importacaoOriginal.status}". ` +
          'Duplicação permitida apenas para: validado, finalizada, estornada ou erro.'
        );
      }

      const transacoes = await TransacaoImportada.find({
        importacao: importacaoId,
        usuario: usuarioId
      })
        .lean()
        .session(session);

      if (!transacoes.length) {
        throw new Error('Não há transações para duplicar nesta importação.');
      }

      const novaImportacao = new Importacao({
        descricao: `Cópia de ${importacaoOriginal.descricao}`,
        nomeArquivo: `Cópia de ${importacaoOriginal.nomeArquivo}`,
        caminhoArquivo: 'duplicacao/sem-arquivo',
        status: 'validado',
        totalProcessado: 0,
        totalSucesso: 0,
        totalErro: 0,
        erro: null,
        erros: [],
        tagsPadrao: importacaoOriginal.tagsPadrao || {},
        usuario: usuarioId
      });

      await novaImportacao.save({ session });

      const transacoesMapeadas = transacoes.map((t) => {
        const pagamentos = (t.pagamentos || []).map((p) => ({
          pessoa: p.pessoa,
          valor: p.valor,
          tags: p.tags || {}
        }));
        return {
          importacao: novaImportacao._id,
          usuario: usuarioId,
          descricao: t.descricao,
          valor: t.valor,
          data: t.data,
          tipo: t.tipo,
          categoria: t.categoria,
          pagamentos: pagamentos.length ? pagamentos : [{ pessoa: 'Titular', valor: t.valor, tags: {} }],
          observacao: t.observacao || '',
          dadosOriginais: t.dadosOriginais || { ...t },
          status: 'pendente',
          erro: null,
          isInstallment: t.isInstallment || false,
          installmentGroupId: t.installmentGroupId || null,
          installmentNumber: t.installmentNumber != null ? t.installmentNumber : null,
          installmentTotal: t.installmentTotal != null ? t.installmentTotal : null,
          installmentIntervalMonths: t.installmentIntervalMonths != null ? t.installmentIntervalMonths : null,
          installmentIntervalDays: t.installmentIntervalDays != null ? t.installmentIntervalDays : (t.installmentIntervalMonths != null ? t.installmentIntervalMonths * 30 : null)
        };
      });

      await TransacaoImportada.insertMany(transacoesMapeadas, { session });

      novaImportacao.totalProcessado = transacoesMapeadas.length;
      novaImportacao.totalSucesso = transacoesMapeadas.length;
      novaImportacao.totalErro = 0;
      await novaImportacao.save({ session });

      await session.commitTransaction();

      return novaImportacao;
    } catch (erro) {
      await session.abortTransaction();
      throw erro;
    } finally {
      session.endSession();
    }
  }

  /**
   * @deprecated Mantido por compatibilidade. Use parserRegistry (`./parsers`).
   * Detecta apenas Fatura/Extrato Nubank hardcoded.
   */
  static parseCSV(conteudo) {
    const linhas = conteudo.trim().split('\n');
    if (linhas.length < 2) {
      return []; // Retorna vazio se não houver dados ou apenas cabeçalho
    }
    const cabecalho = linhas[0].split(',').map(col => col.trim());

    // Detecta o formato baseado no cabeçalho
    let formato;
    const isFormatoFatura = cabecalho.includes('date') && cabecalho.includes('title') && cabecalho.includes('amount');
    const isFormatoExtrato = cabecalho.includes('Data') && cabecalho.includes('Valor') && (cabecalho.includes('Descrição') || cabecalho.includes('DescriÃ§Ã£o') || cabecalho.includes('Descricao'));

    if (isFormatoFatura) {
      formato = 'fatura';
      console.log('[DEBUG] Formato CSV detectado: Fatura Nubank');
    } else if (isFormatoExtrato) {
      formato = 'extrato';
      console.log('[DEBUG] Formato CSV detectado: Extrato Nubank');
    } else {
      throw new Error('Formato de cabeçalho CSV não reconhecido. Esperado formato de Extrato ou Fatura Nubank.');
    }

    return linhas
      .slice(1)
      .filter(linha => linha.trim())
      .map(linha => {
        const valores = linha.split(',').map(val => val.trim());
        const registro = {};

        // Mapeia os valores para o cabeçalho
        cabecalho.forEach((coluna, index) => {
          registro[coluna] = valores[index];
        });

        let descricao, valor, data, tipo, categoria, identificador, observacao;

        if (formato === 'fatura') {
          // Processamento para formato Fatura (date, title, amount)
          const [ano, mes, dia] = registro['date'].split('-');
          data = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0)); // Usar UTC para consistência
          valor = Math.abs(parseFloat(registro['amount']) || 0);
          descricao = registro['title'] || 'Transação Fatura';
          tipo = 'gasto'; // Faturas geralmente são gastos
          categoria = null;
          identificador = null; // Formato fatura não possui identificador
          observacao = `Importado da Fatura Nubank`;

        } else { // formato === 'extrato'
          // Processamento para formato Extrato (existente)
          const valorStr = registro['Valor'] ? registro['Valor'].toString() : '0';
          const valorOriginal = parseFloat(valorStr.replace(',', '.')) || 0;
          valor = Math.abs(valorOriginal);
          
          const dataStr = registro['Data'];
          const [diaExt, mesExt, anoExt] = dataStr ? dataStr.split('/') : [null, null, null];
          data = diaExt && mesExt && anoExt ? new Date(Date.UTC(anoExt, mesExt - 1, diaExt, 12, 0, 0)) : new Date(Date.UTC(1970, 0, 1, 12, 0, 0)); // Data padrão em caso de erro

          tipo = valorOriginal < 0 ? 'gasto' : 'recebivel';
          descricao = registro['Descrição'] || registro['DescriÃ§Ã£o'] || registro['Descricao'] || 'Transação Extrato';
          categoria = null; // Mantém como null inicialmente
          identificador = registro['Identificador'];
          observacao = `Importado do Extrato Nubank - ID: ${identificador}`;
        }

        // Colunas opcionais para parcelamento (Grupo, Parcela, TotalParcelas)
        let grupo = registro['Grupo'] || registro['installmentGroupId'] || null;
        const parcelaNum = registro['Parcela'] != null ? parseInt(registro['Parcela'], 10) : null;
        const totalParcelas = registro['TotalParcelas'] != null ? parseInt(registro['TotalParcelas'], 10) : null;
        const isInstallment = grupo != null && parcelaNum != null && totalParcelas != null;
        // Se grupo não for ObjectId válido (24 hex), gera um a partir do hash para consistência
        if (isInstallment && grupo && typeof grupo === 'string' && !/^[a-fA-F0-9]{24}$/.test(grupo)) {
          const hash = crypto.createHash('md5').update(grupo).digest('hex');
          grupo = hash.substring(0, 24);
        }

        // Monta o objeto no mesmo formato que o JSON espera
        const obj = {
          descricao,
          valor,
          data,
          tipo,
          categoria,
          identificador,
          observacao,
          dadosOriginais: registro,
          pagamentos: [{
            pessoa: 'Titular',
            valor,
            tags: {}
          }]
        };
        if (isInstallment) {
          obj.isInstallment = true;
          obj.installmentGroupId = grupo;
          obj.installmentNumber = parcelaNum;
          obj.installmentTotal = totalParcelas;
          // Coluna opcional IntervaloDias; default 30 dias quando parcelado
          const intervalDias = registro['IntervaloDias'] != null ? parseInt(registro['IntervaloDias'], 10) : null;
          obj.installmentIntervalDays = (intervalDias != null && intervalDias >= 1) ? intervalDias : 30;
        }
        return obj;
      });
  }
}

ImportacaoService.gerarDeduplicationKey = gerarDeduplicationKey;
module.exports = ImportacaoService;
module.exports.classificarTransacoes = classificarTransacoes;
module.exports.JANELA_POSSIVEL_DUPLICATA_DIAS = JANELA_POSSIVEL_DUPLICATA_DIAS;
module.exports.TOLERANCIA_VALOR = TOLERANCIA_VALOR;