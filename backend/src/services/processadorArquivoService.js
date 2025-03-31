const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parse');
const iconv = require('iconv-lite');
const chardet = require('chardet');

class ProcessadorArquivoService {
  /**
   * Lê um arquivo e detecta sua codificação
   * @param {string} caminhoArquivo - Caminho do arquivo
   * @returns {Promise<string>} Conteúdo do arquivo
   */
  async lerArquivo(caminhoArquivo) {
    try {
      // Ler o arquivo como buffer para detectar codificação
      const buffer = await fs.readFile(caminhoArquivo);
      const encoding = chardet.detect(buffer);

      // Converter para UTF-8 se necessário
      if (encoding && encoding.toLowerCase() !== 'utf-8') {
        return iconv.decode(buffer, encoding);
      }

      return buffer.toString('utf-8');
    } catch (error) {
      throw new Error(`Erro ao ler arquivo: ${error.message}`);
    }
  }

  /**
   * Mapeia os campos do arquivo para o formato padrão
   * @param {Object} dados - Dados do arquivo
   * @param {Object} mapeamento - Mapeamento de campos
   * @returns {Object} Dados mapeados
   */
  mapearCampos(dados, mapeamento) {
    const resultado = {};

    for (const [campoDestino, campoOrigem] of Object.entries(mapeamento)) {
      if (Array.isArray(campoOrigem)) {
        // Tentar múltiplos campos de origem
        for (const campo of campoOrigem) {
          if (dados[campo] !== undefined) {
            resultado[campoDestino] = dados[campo];
            break;
          }
        }
      } else {
        resultado[campoDestino] = dados[campoOrigem];
      }
    }

    return resultado;
  }

  /**
   * Valida a estrutura dos dados do arquivo
   * @param {Object} dados - Dados do arquivo
   * @param {string} tipo - Tipo do arquivo (json/csv)
   * @throws {Error} Se a estrutura for inválida
   */
  validarDados(dados, tipo) {
    if (tipo === 'json') {
      if (!dados.transacoes || !Array.isArray(dados.transacoes)) {
        throw new Error('Formato JSON inválido. Esperado: { transacoes: [] }');
      }

      if (dados.transacoes.length === 0) {
        throw new Error('O arquivo não contém transações');
      }
    } else if (tipo === 'csv') {
      if (!Array.isArray(dados)) {
        throw new Error('Formato CSV inválido');
      }

      if (dados.length === 0) {
        throw new Error('O arquivo não contém transações');
      }

      // Validar cabeçalho
      const cabecalho = Object.keys(dados[0]);
      const camposEsperados = ['descricao', 'valor', 'data', 'tipo'];
      const camposFaltantes = camposEsperados.filter(campo => 
        !cabecalho.some(c => c.toLowerCase() === campo.toLowerCase())
      );

      if (camposFaltantes.length > 0) {
        throw new Error(`Campos obrigatórios faltando no CSV: ${camposFaltantes.join(', ')}`);
      }
    }
  }

  /**
   * Processa um arquivo CSV
   * @param {string} conteudo - Conteúdo do arquivo
   * @param {Object} opcoes - Opções de processamento
   * @returns {Promise<Array>} Registros processados
   */
  async processarCSV(conteudo, opcoes = {}) {
    return new Promise((resolve, reject) => {
      const registros = [];
      const parser = csv.parse(conteudo, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        ...opcoes
      });

      parser.on('readable', () => {
        let registro;
        while ((registro = parser.read()) !== null) {
          registros.push(registro);
        }
      });

      parser.on('error', (err) => {
        reject(new Error(`Erro ao processar CSV: ${err.message}`));
      });

      parser.on('end', () => {
        resolve(registros);
      });
    });
  }

  /**
   * Processa um arquivo JSON
   * @param {string} conteudo - Conteúdo do arquivo
   * @returns {Object} Dados do JSON
   */
  processarJSON(conteudo) {
    try {
      return JSON.parse(conteudo);
    } catch (error) {
      throw new Error(`Erro ao processar JSON: ${error.message}`);
    }
  }

  /**
   * Detecta o delimitador do CSV
   * @param {string} conteudo - Conteúdo do arquivo
   * @returns {string} Delimitador detectado
   */
  detectarDelimitadorCSV(conteudo) {
    const delimitadores = [',', ';', '\t', '|'];
    const primeiraLinha = conteudo.split('\n')[0];
    
    let melhorDelimitador = ',';
    let maxColunas = 0;

    for (const delimitador of delimitadores) {
      const colunas = primeiraLinha.split(delimitador).length;
      if (colunas > maxColunas) {
        maxColunas = colunas;
        melhorDelimitador = delimitador;
      }
    }

    return melhorDelimitador;
  }

  /**
   * Processa um arquivo
   * @param {string} caminhoArquivo - Caminho do arquivo
   * @param {string} tipo - Tipo do arquivo (json/csv)
   * @param {Object} opcoes - Opções de processamento
   * @returns {Promise<Object>} Resultado do processamento
   */
  async processarArquivo(caminhoArquivo, tipo, opcoes = {}) {
    const conteudo = await this.lerArquivo(caminhoArquivo);
    let dados;

    if (tipo === 'json') {
      dados = this.processarJSON(conteudo);
    } else if (tipo === 'csv') {
      const delimitador = opcoes.delimitador || this.detectarDelimitadorCSV(conteudo);
      dados = await this.processarCSV(conteudo, { delimiter: delimitador, ...opcoes });
    } else {
      throw new Error('Tipo de arquivo não suportado');
    }

    this.validarDados(dados, tipo);

    return {
      dados,
      tipo,
      totalRegistros: tipo === 'json' ? dados.transacoes.length : dados.length
    };
  }
}

module.exports = new ProcessadorArquivoService(); 