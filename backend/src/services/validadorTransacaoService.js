class ValidadorTransacaoService {
  /**
   * Valida os campos obrigatórios de uma transação
   * @param {Object} dados - Dados da transação
   * @throws {Error} Se algum campo obrigatório estiver faltando
   */
  async validarCamposObrigatorios(dados) {
    const camposObrigatorios = ['descricao', 'valor', 'data', 'tipo'];
    const camposFaltantes = camposObrigatorios.filter(campo => !dados[campo]);

    if (camposFaltantes.length > 0) {
      throw new Error(`Campos obrigatórios faltando: ${camposFaltantes.join(', ')}`);
    }
  }

  /**
   * Valida os formatos dos campos de uma transação
   * @param {Object} dados - Dados da transação
   * @throws {Error} Se algum campo estiver com formato inválido
   */
  async validarFormatos(dados) {
    // Validar descrição
    if (typeof dados.descricao !== 'string' || dados.descricao.trim().length === 0) {
      throw new Error('Descrição inválida');
    }

    // Validar valor
    if (typeof dados.valor !== 'number' || isNaN(dados.valor)) {
      throw new Error('Valor deve ser um número válido');
    }

    // Validar data
    const data = new Date(dados.data);
    if (isNaN(data.getTime())) {
      throw new Error('Data inválida');
    }

    // Validar tipo
    if (!['gasto', 'recebivel'].includes(dados.tipo.toLowerCase())) {
      throw new Error('Tipo deve ser "gasto" ou "recebivel"');
    }

    // Validar categoria (opcional)
    if (dados.categoria !== undefined && 
        (typeof dados.categoria !== 'string' || dados.categoria.trim().length === 0)) {
      throw new Error('Categoria inválida');
    }
  }

  /**
   * Valida as regras de negócio para uma transação
   * @param {Object} dados - Dados da transação
   * @throws {Error} Se alguma regra de negócio for violada
   */
  async validarRegrasNegocio(dados) {
    // Validar valor positivo
    if (dados.valor <= 0) {
      throw new Error('O valor deve ser maior que zero');
    }

    // Validar data não futura
    const data = new Date(dados.data);
    const hoje = new Date();
    if (data > hoje) {
      throw new Error('A data não pode ser futura');
    }

    // Validar data não muito antiga (por exemplo, mais de 5 anos)
    const cincoAnosAtras = new Date();
    cincoAnosAtras.setFullYear(hoje.getFullYear() - 5);
    if (data < cincoAnosAtras) {
      throw new Error('A data não pode ser mais antiga que 5 anos');
    }

    // Validar tamanho máximo da descrição
    if (dados.descricao.length > 200) {
      throw new Error('A descrição não pode ter mais de 200 caracteres');
    }

    // Validar valor máximo
    const valorMaximo = 1000000; // 1 milhão
    if (dados.valor > valorMaximo) {
      throw new Error(`O valor não pode ser maior que ${valorMaximo}`);
    }
  }

  /**
   * Valida uma transação completa
   * @param {Object} dados - Dados da transação
   * @throws {Error} Se a validação falhar
   */
  async validarTransacao(dados) {
    await this.validarCamposObrigatorios(dados);
    await this.validarFormatos(dados);
    await this.validarRegrasNegocio(dados);
  }
}

module.exports = new ValidadorTransacaoService(); 