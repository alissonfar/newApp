// src/controllers/controladorRelatorio.js
const Transacao = require('../models/transacao');

exports.gerarRelatorio = async (req, res) => {
  try {
    const transacoes = await Transacao.find({ status: 'ativo' });
    
    let totalGastos = 0;
    let totalRecebimentos = 0;
    let relatorioPorPessoa = {};

    const inicializarPessoa = (nome) => {
      if (!relatorioPorPessoa[nome]) {
        relatorioPorPessoa[nome] = { gasto: 0, recebido: 0 };
      }
    };

    transacoes.forEach(transacao => {
      if (transacao.tipo === 'gasto') {
        totalGastos += transacao.valor;
        // Em uma transação de gasto, cada pagamento indica quanto a pessoa deve pagar
        transacao.pagamentos.forEach(pag => {
          inicializarPessoa(pag.pessoa);
          relatorioPorPessoa[pag.pessoa].gasto += pag.valor;
        });
      } else if (transacao.tipo === 'recebivel') {
        totalRecebimentos += transacao.valor;
        // Em uma transação de recebível, cada pagamento indica quanto a pessoa recebeu
        transacao.pagamentos.forEach(pag => {
          inicializarPessoa(pag.pessoa);
          relatorioPorPessoa[pag.pessoa].recebido += pag.valor;
        });
      }
    });

    // Calcular saldo por pessoa: (recebido - gasto)
    let relatorioFinal = {};
    Object.keys(relatorioPorPessoa).forEach(nome => {
      const dados = relatorioPorPessoa[nome];
      const saldo = dados.recebido - dados.gasto;
      relatorioFinal[nome] = { ...dados, saldo };
    });

    const saldoGeral = totalRecebimentos - totalGastos;

    res.json({
      totalGastos,
      totalRecebimentos,
      saldoGeral,
      relatorioPorPessoa: relatorioFinal
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ erro: 'Erro ao gerar relatório.' });
  }
};
