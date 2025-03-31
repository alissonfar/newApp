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
      const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
      const parser = csv.parse(conteudo, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      const importacao = await Importacao.findById(importacaoId);
      const linhas = conteudo.split('\n').length - 1; // -1 para excluir o cabeçalho
      importacao.totalRegistros = linhas;
      await importacao.save();

      for await (const registro of parser) {
        try {
          const transacao = this.mapearCamposCSV(registro);
          await this.processarTransacao(transacao, importacaoId, usuarioId);
          importacao.registrosProcessados++;
          await importacao.save();
        } catch (error) {
          importacao.registrosComErro++;
          await importacao.save();
          console.error('Erro ao processar registro CSV:', error);
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
   * Mapeia os campos do CSV para o formato padrão
   * @param {Object} registro - Registro do CSV
   * @returns {Object} Transação mapeada
   */
  mapearCamposCSV(registro) {
    return {
      descricao: registro.descricao,
      valor: parseFloat(registro.valor),
      data: new Date(registro.data),
      tipo: registro.tipo.toLowerCase(),
      categoria: registro.categoria
    };
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

      // Atualiza status para processando
      importacao.status = 'processando';
      await importacao.save();

      // Lê o arquivo
      const conteudoArquivo = await fs.readFile(importacao.caminhoArquivo, 'utf8');
      let transacoes;

      // Parse do arquivo baseado no tipo
      if (importacao.caminhoArquivo.endsWith('.json')) {
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
        transacoes = ImportacaoService.parseCSV(conteudoArquivo);
      } else {
        throw new Error('Formato de arquivo não suportado');
      }

      // Processa cada transação
      const resultados = await Promise.all(
        transacoes.map(async (transacao) => {
          try {
            const transacaoImportada = new TransacaoImportada({
              data: new Date(transacao.data),
              tipo: transacao.tipo,
              valor: transacao.valor,
              descricao: transacao.descricao,
              categoria: transacao.categoria,
              importacao: importacaoId,
              usuario: importacao.usuario,
              dadosOriginais: transacao
            });

            await transacaoImportada.validate();
            await transacaoImportada.save();
            return { sucesso: true, transacao: transacaoImportada };
          } catch (erro) {
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
      console.error('Erro ao processar importação:', erro);
      
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
        const transacao = {};
        
        cabecalho.forEach((coluna, index) => {
          transacao[coluna] = valores[index];
        });
        
        return transacao;
      });
  }
}

module.exports = ImportacaoService; 