// src/controllers/controladorRelatorio.js
const Transacao = require('../models/transacao');

exports.gerarRelatorio = async (req, res) => {
  try {
    // Busca transações ativas do usuário autenticado
    const transacoes = await Transacao.find({ status: 'ativo', usuario: req.userId });
    
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
        transacao.pagamentos.forEach(pag => {
          inicializarPessoa(pag.pessoa);
          relatorioPorPessoa[pag.pessoa].gasto += pag.valor;
        });
      } else if (transacao.tipo === 'recebivel') {
        totalRecebimentos += transacao.valor;
        transacao.pagamentos.forEach(pag => {
          inicializarPessoa(pag.pessoa);
          relatorioPorPessoa[pag.pessoa].recebido += pag.valor;
        });
      }
    });

    // Calcula saldo por pessoa
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
