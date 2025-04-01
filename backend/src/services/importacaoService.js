const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parse');
const Importacao = require('../models/importacao');
const TransacaoImportada = require('../models/transacaoImportada');

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

      const importacao = await Importacao.findById(importacaoId);
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
      const importacao = await Importacao.findById(importacaoId);
      importacao.status = 'erro';
      importacao.erro = error.message;
      await importacao.save();
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

      const importacao = await Importacao.findById(importacaoId);
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
      const importacao = await Importacao.findById(importacaoId);
      importacao.status = 'erro';
      importacao.erro = error.message;
      await importacao.save();
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
    return new Date(ano, mes - 1, dia);
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

  static async processarArquivo(importacaoId) {
    try {
      // Busca a importação
      const importacao = await Importacao.findById(importacaoId);
      if (!importacao) {
        throw new Error('Importação não encontrada');
      }

      console.log('[DEBUG] Iniciando processamento do arquivo:', importacao.nomeArquivo);

      // Atualiza status para processando
      importacao.status = 'processando';
      await importacao.save();

      // Lê o arquivo
      const conteudoArquivo = await fs.readFile(importacao.caminhoArquivo, 'utf8');
      let transacoes;

      // Parse do arquivo baseado no tipo
      if (importacao.caminhoArquivo.endsWith('.json')) {
        console.log('[DEBUG] Processando arquivo JSON');
        transacoes = JSON.parse(conteudoArquivo);
        // Se for um objeto com propriedade transacoes, use ela
        if (transacoes.transacoes && Array.isArray(transacoes.transacoes)) {
          transacoes = transacoes.transacoes;
        }
        // Se não for um array, converta para array com um item
        if (!Array.isArray(transacoes)) {
          transacoes = [transacoes];
        }
      } else if (importacao.caminhoArquivo.endsWith('.csv')) {
        console.log('[DEBUG] Processando arquivo CSV');
        console.log('[DEBUG] Conteúdo do arquivo:', conteudoArquivo);
        transacoes = ImportacaoService.parseCSV(conteudoArquivo);
        console.log('[DEBUG] Transações extraídas do CSV:', transacoes);
      } else {
        throw new Error('Formato de arquivo não suportado');
      }

      // Processa cada transação
      console.log('[DEBUG] Iniciando processamento das transações');
      const resultados = await Promise.all(
        transacoes.map(async (transacao) => {
          try {
            console.log('[DEBUG] Processando transação:', transacao);
            const transacaoImportada = new TransacaoImportada({
              data: new Date(transacao.data),
              tipo: transacao.tipo,
              valor: transacao.valor,
              descricao: transacao.descricao,
              categoria: transacao.categoria,
              importacao: importacaoId,
              usuario: importacao.usuario,
              dadosOriginais: transacao,
              pagamentos: transacao.pagamentos || [{
                pessoa: 'Titular',
                valor: transacao.valor,
                tags: {}
              }]
            });

            await transacaoImportada.validate();
            await transacaoImportada.save();
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
      importacao.status = falhas > 0 ? 'erro' : 'validado';
      importacao.erros = resultados
        .filter(r => !r.sucesso)
        .map(r => ({
          mensagem: r.erro,
          dados: r.dadosOriginais
        }));

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
      
      // Atualiza status da importação para erro
      const importacao = await Importacao.findById(importacaoId);
      if (importacao) {
        importacao.status = 'erro';
        importacao.erro = erro.message;
        await importacao.save();
      }

      throw erro;
    }
  }

  static parseCSV(conteudo) {
    const linhas = conteudo.split('\n');
    const cabecalho = linhas[0].split(',').map(col => col.trim());
    
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

        // Processa o valor (remove caracteres não numéricos e converte para número)
        const valorStr = registro['Valor'].toString();
        const valor = Math.abs(parseFloat(valorStr.replace(',', '.')) || 0);
        
        // Converte a data do formato DD/MM/YYYY para Date
        const [dia, mes, ano] = registro['Data'].split('/');
        const data = new Date(ano, mes - 1, dia);

        // Determina o tipo baseado no valor original (com sinal)
        const valorOriginal = parseFloat(valorStr.replace(',', '.')) || 0;
        const tipo = valorOriginal < 0 ? 'gasto' : 'recebivel';

        // Extrai a descrição
        const descricao = registro['Descrição'] || registro['DescriÃ§Ã£o'] || registro['Descricao'] || '';

        // Extrai o identificador
        const identificador = registro['Identificador'];

        // Monta o objeto no mesmo formato que o JSON espera
        return {
          descricao: descricao || 'Transação Nubank',
          valor,
          data,
          tipo,
          categoria: null,
          identificador,
          observacao: `Importado do Nubank - ID: ${identificador}`,
          dadosOriginais: registro,
          pagamentos: [{
            pessoa: 'Titular',
            valor,
            tags: {}
          }]
        };
      });
  }
}

module.exports = ImportacaoService; 