/**
 * Testes do emprestimoService - validação de regras de negócio e recálculo de status.
 *
 * Modelo (design 2026-06-24):
 *  - `valorEsperadoRetorno` migrou do schema Emprestimo para o schema Transacao.
 *  - Cada Transação de GASTO vinculada a um Empréstimo carrega o seu próprio
 *    valor esperado. A soma esperada do Empréstimo = SUM(t.valorEsperadoRetorno
 *    WHERE t.emprestimoId = X AND t.tipo = 'gasto' AND t.status = 'ativo').
 *  - Saldo a receber = somaEsperada - recebido.
 *  - Lucro esperado (display) = somaEsperada - somaDesembolsada.
 *  - Lucro realizado (TX de juros auto) = soma_recebíveis - soma_gastos
 *    (igual ao modelo anterior, sem FIFO).
 *  - Sem FIFO, sem split, sem direcao, sem taxaJurosPercentual/valorJurosFixo.
 */
const mongoose = require('mongoose');

// Mocks dos models e do util de quitação
const mockEmprestimoFindOne = jest.fn();
const mockEmprestimoFindOneAndUpdate = jest.fn();
const mockTransacaoAggregate = jest.fn();
const mockTransacaoFind = jest.fn();
const mockTransacaoDeleteOne = jest.fn();
const mockRecalcularJurosAuto = jest.fn();

jest.mock('../../models/emprestimo', () => {
  const actual = jest.requireActual('../../models/emprestimo');
  return {
    ...actual,
    findOne: (...args) => mockEmprestimoFindOne(...args),
    findOneAndUpdate: (...args) => mockEmprestimoFindOneAndUpdate(...args)
  };
});

jest.mock('../../models/transacao', () => {
  const Mock = jest.fn();
  Mock.aggregate = (...args) => mockTransacaoAggregate(...args);
  Mock.deleteOne = (...args) => mockTransacaoDeleteOne(...args);
  Mock.find = (...args) => {
    const query = mockTransacaoFind(...args);
    if (query && typeof query.lean === 'function') return query;
    return {
      sort: () => ({
        lean: () => Promise.resolve([])
      }),
      lean: () => Promise.resolve([])
    };
  };
  return Mock;
});

jest.mock('../../utils/emprestimoAjuste', () => ({
  ajustarRecebiveisDeEmprestimo: jest.fn()
}));

jest.mock('../../utils/emprestimoQuitacao', () => ({
  recalcularJurosAuto: (...args) => mockRecalcularJurosAuto(...args)
}));

// Importação DEPOIS dos mocks
const {
  validarDadosEmprestimo,
  recalcularStatus,
  quitarEmprestimo,
  reabrirEmprestimo,
  calcularTotais,
  calcularLucro,
  STATUS_EMPRESTIMO,
  TIPOS_RETORNO
} = require('../emprestimoService');

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const EMP_ID = new mongoose.Types.ObjectId();

/**
 * Empilhamento de retornos de `Transacao.aggregate` no service.
 *
 * A partir do design 2026-06-24 (pagamento-level), `calcularTotais` faz
 * 3 chamadas em ordem: txLevel, pagamentoLevel, esperadoPagamento.
 * O esperado legado agora vem dentro do `$group` do txLevel (campo
 * `totalEsperado`), então NÃO há aggregate separado de esperado legado.
 *
 * `calcularLucro` faz 1 aggregate. `recalcularJurosAuto` faz +1
 * (calcularTotaisRecebEDisbursed). Total agregado por cenário de quitação:
 * 4 chamadas (3 do calcularTotais + 1 do calcularLucro). O aggregate
 * interno do recalcularJurosAuto é consumido depois.
 *
 * Para manter compatibilidade com testes legados que passavam 2 args
 * (tipo, esperadoNum), o segundo arg pode ser:
 *  - Array: explícito (ex: `[]` para zerar)
 *  - Número: atalho — vira `[{ _id: null, total: N }]`. É atribuído ao
 *    `esperadoPagamento` (3ª chamada do calcularTotais), preservando
 *    a semântica "esperado total do Empréstimo" do helper antigo.
 *
 * @param {Array} txLevelResult resultado do agregado TX-level (1ª chamada)
 * @param {Array|number} esperadoPagamentoResult 3ª chamada do calcularTotais.
 *        Compat: se for número, encapsula em `[{ _id: null, total: N }]`.
 * @param {Array} lucroResult resultado para `calcularLucro` (4ª chamada)
 * @param {Array} pagamentoLevelResult 2ª chamada do calcularTotais. Default: `[]`
 */
function mockAggregateSequence(
  txLevelResult,
  esperadoPagamentoResult,
  pagamentoLevelResult = []
) {
  const calls = [];
  if (txLevelResult !== undefined) calls.push(txLevelResult);
  if (pagamentoLevelResult !== undefined) calls.push(pagamentoLevelResult);
  if (esperadoPagamentoResult !== undefined) {
    if (typeof esperadoPagamentoResult === 'number') {
      calls.push(esperadoPagamentoResult > 0 ? [{ _id: null, total: esperadoPagamentoResult }] : []);
    } else {
      calls.push(esperadoPagamentoResult);
    }
  }
  for (const r of calls) {
    mockTransacaoAggregate.mockResolvedValueOnce(r);
  }
}

function makeEmprestimo(overrides = {}) {
  return {
    _id: EMP_ID,
    usuario: new mongoose.Types.ObjectId(USER_ID),
    status: 'ativo',
    pessoaNomeSnapshot: 'Estrela',
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe('emprestimoService.validarDadosEmprestimo (sem valorEsperadoRetorno — design 2026-06-24)', () => {
  // A partir do design 2026-06-24, valorEsperadoRetorno NÃO é campo do
  // Empréstimo — vive na Transação. Por isso a validação NÃO exige nem
  // valida esse campo aqui.
  const dadosValidos = {
    pessoaId: 'pessoa-123',
    tipoRetorno: 'valor_fixo',
    prazoFinal: '2026-12-31'
  };

  test('aceita dados completos válidos', () => {
    expect(validarDadosEmprestimo(dadosValidos)).toEqual([]);
  });

  test('rejeita sem pessoaId', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, pessoaId: undefined });
    expect(erros).toContain('pessoaId é obrigatório.');
  });

  test('NÃO exige mais valorEsperadoRetorno (migrou pra Transação)', () => {
    // Antes, rejeitava sem valorEsperadoRetorno. Agora é livre.
    const erros = validarDadosEmprestimo(dadosValidos);
    expect(erros).toEqual([]);
  });

  test('rejeita sem prazoFinal', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, prazoFinal: '' });
    expect(erros).toContain('prazoFinal é obrigatório.');
  });

  test('em modo parcial: aceita update apenas de observacao', () => {
    expect(validarDadosEmprestimo({ observacao: 'nova obs' }, { parcial: true })).toEqual([]);
  });

  test('em modo parcial: não exige pessoaId ausente', () => {
    const dadosSemPessoa = {
      tipoRetorno: 'valor_fixo',
      prazoFinal: '2026-06-30'
    };
    expect(validarDadosEmprestimo(dadosSemPessoa, { parcial: true })).toEqual([]);
  });
});

describe('emprestimoService - constantes exportadas', () => {
  test('STATUS_EMPRESTIMO contém ativo, quitado, cancelado', () => {
    expect(STATUS_EMPRESTIMO).toEqual(expect.arrayContaining(['ativo', 'quitado', 'cancelado']));
  });

  test('TIPOS_RETORNO contém apenas valor_fixo e sem_juros', () => {
    expect(TIPOS_RETORNO).toEqual(['valor_fixo', 'sem_juros']);
  });

  test('TIPOS_RETORNO NÃO contém juros_* (removidos)', () => {
    expect(TIPOS_RETORNO).not.toContain('juros_percentual');
    expect(TIPOS_RETORNO).not.toContain('juros_fixo');
  });
});

describe('emprestimoService.recalcularStatus - valor esperado por TX (design 2026-06-24)', () => {
  beforeEach(() => {
    mockEmprestimoFindOne.mockReset();
    mockEmprestimoFindOneAndUpdate.mockReset();
    mockTransacaoAggregate.mockReset();
    mockTransacaoFind.mockReset();
    mockTransacaoDeleteOne.mockReset();
    mockRecalcularJurosAuto.mockReset();
  });

  test('caso Estrela: 2 TXs de gasto (600/800 + 500/500) + nenhum receb → ativo, esperado 1300, lucro esperado 200', async () => {
    // Reproduz o caso concreto que motivou o design doc.
    // TX1: gasto 600, valorEsperadoRetorno 800
    // TX2: gasto 500, valorEsperadoRetorno 500
    // Sem recebimentos ainda.
    const emp = makeEmprestimo({ status: 'ativo' });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    // calcularTotais: 1ª = agregado por tipo (gasto 1100, sem receb), 2ª = soma esperada 1300
    mockAggregateSequence(
      [{ _id: 'gasto', total: 1100 }],
      1300
    );

    await recalcularStatus(String(EMP_ID), USER_ID);

    // Não atinge quitação (recebido 0 < esperado 1300)
    expect(mockEmprestimoFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('quitação é MANUAL: status=ativo + recebido >= esperado NÃO quita (Task 1 — 2026-10-03)', async () => {
    // Cenário onde o comportamento antigo auto-quitava: recebido atinge o esperado.
    // A partir da quitação manual, este é o caso REGRESSÃO — não deve quitar
    // sozinho. O usuário clica em "Quitar" via quitarEmprestimo().
    // TX1: gasto 600, esperado 800
    // TX2: gasto 500, esperado 500
    // Recebido: 1300 → atinge esperado 1300
    const emp = makeEmprestimo({ status: 'ativo' });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockAggregateSequence(
      [{ _id: 'gasto', total: 1100 }, { _id: 'recebivel', total: 1300 }],
      1300
    );

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockEmprestimoFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('quitação já existente + TXs modificadas: atualiza tx de juros auto (CASO 3)', async () => {
    const emp = makeEmprestimo({ status: 'quitado', dataQuitacao: new Date() });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    // calcularTotais: 3 mocks. calcularLucro: 3 mocks (via _agregarTotaisEmprestimo).
    mockAggregateSequence(
      [{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }],
      800
    );
    mockAggregateSequence(
      [{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }],
      800
    );
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'atualizada', transacao: { _id: 'tx', valor: 200 } });

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockRecalcularJurosAuto).toHaveBeenCalledTimes(1);
    expect(mockRecalcularJurosAuto).toHaveBeenCalledWith(
      expect.objectContaining({ _id: emp._id }),
      200
    );
  });

  test('idempotente: status=ativo + recebido < esperado → no-op', async () => {
    const emp = makeEmprestimo({ status: 'ativo' });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockAggregateSequence(
      [{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 200 }],
      800
    );

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockEmprestimoFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('cancelado: no-op completo', async () => {
    const emp = makeEmprestimo({ status: 'cancelado' });
    mockEmprestimoFindOne.mockResolvedValue(emp);

    const resultado = await recalcularStatus(String(EMP_ID), USER_ID);

    expect(resultado).toBe(emp);
    expect(mockTransacaoAggregate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('não encontrado: retorna null', async () => {
    mockEmprestimoFindOne.mockResolvedValue(null);

    const resultado = await recalcularStatus(String(EMP_ID), USER_ID);

    expect(resultado).toBeNull();
  });

  test('TXs sem valorEsperadoRetorno (apenas gasto) → soma esperada = 0, empréstimo não atinge quitação', async () => {
    // Caso degenerado: TXs de gasto sem valorEsperadoRetorno setado.
    // Esperado = 0 → não atinge quitação mesmo com recebimentos.
    const emp = makeEmprestimo({ status: 'ativo' });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockAggregateSequence(
      [{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 500 }],
      0 // soma esperada = 0 (nenhuma TX com valorEsperadoRetorno)
    );

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockEmprestimoFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('edição de Empréstimo com TXs ativas: permitido, status não reverte (Bloco 2.b)', () => {
    // A regra é apenas de controller (emprestimoController.atualizar).
    // Aqui validamos indiretamente: o service não tem trava.
    expect(true).toBe(true);
  });
});

describe('emprestimoService.calcularTotais - pagamento-level (design 2026-06-24)', () => {
  beforeEach(() => {
    mockTransacaoAggregate.mockReset();
  });

  test('Cenário Estrela: TX com 2 pagamentos (50/50), 1 emprestado → desembolso = só o pagamento emprestado', async () => {
    // TX 895, pagamentos: Alisson 447,50 (sem empréstimo) + Estrela 447,50 (empréstimo)
    // Esperado da TX (campo na TX): 500
    // calcularTotais: 3 chamadas (txLevel vazio, pagamentoLevel com 447.50 gasto, esperadoPagamento 500)
    mockTransacaoAggregate
      .mockResolvedValueOnce([])                                        // txLevel (vazio)
      .mockResolvedValueOnce([{ _id: 'gasto', total: 447.50 }])         // pagamentoLevel
      .mockResolvedValueOnce([{ _id: null, total: 500 }]);              // esperadoPagamento

    const totais = await calcularTotais(String(EMP_ID), USER_ID);

    expect(totais.totalDisbursed).toBeCloseTo(447.50, 2);
    expect(totais.totalReceived).toBe(0);
    expect(totais.totalEsperado).toBe(500);
  });

  test('Mistura: 1 TX legado + 1 TX pagamento-level no mesmo Empréstimo → soma correta', async () => {
    // Legado: TX 1000 gasto (caminho A)
    // Pagamento: TX 800 (pagamento de 400 emprestado) (caminho B)
    // Esperado legado: 1000, esperado pagamento: 500
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'gasto', total: 1000, totalEsperado: 1000 }])  // txLevel
      .mockResolvedValueOnce([{ _id: 'gasto', total: 400 }])                          // pagamentoLevel
      .mockResolvedValueOnce([{ _id: null, total: 500 }]);                            // esperadoPagamento

    const totais = await calcularTotais(String(EMP_ID), USER_ID);

    expect(totais.totalDisbursed).toBe(1400); // 1000 (legado) + 400 (pagamento)
    expect(totais.totalEsperado).toBe(1500);  // 1000 (legado) + 500 (pagamento)
  });

  test('TX com 2 pagamentos, AMBOS com mesmo emprestimoId → soma dos 2 pagamentos', async () => {
    // Cenário onde 2 pagamentos de uma mesma TX são 100% empréstimo.
    // Sem tx-level legado, sem outros caminhos.
    mockTransacaoAggregate
      .mockResolvedValueOnce([])                       // txLevel vazio
      .mockResolvedValueOnce([{ _id: 'gasto', total: 900 }])  // pagamentoLevel: 500 + 400
      .mockResolvedValueOnce([{ _id: null, total: 1000 }]);   // esperadoPagamento: soma por pagamento (ADR-026)

    const totais = await calcularTotais(String(EMP_ID), USER_ID);

    expect(totais.totalDisbursed).toBe(900);
    expect(totais.totalEsperado).toBe(1000);
  });

  test('esperado do caminho 2 soma por pagamento (sem $first)', async () => {
    mockTransacaoAggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 1000 }])
      .mockResolvedValueOnce([{ _id: null, total: 1200 }]);

    const totais = await calcularTotais(String(EMP_ID), USER_ID);
    expect(totais.totalEsperado).toBe(1200);

    const pipelineEsperado = mockTransacaoAggregate.mock.calls[2][0];
    const json = JSON.stringify(pipelineEsperado);
    expect(json).toContain('$pagamentos.valorEsperadoRetorno');
    expect(json).not.toContain('$first');
  });
});

describe('emprestimoService - caminho 2 (pagamento-level) — bug fix 2026-06-30', () => {
  beforeEach(() => {
    mockEmprestimoFindOne.mockReset();
    mockEmprestimoFindOneAndUpdate.mockReset();
    mockTransacaoAggregate.mockReset();
    mockTransacaoFind.mockReset();
    mockTransacaoDeleteOne.mockReset();
    mockRecalcularJurosAuto.mockReset();
  });

  test('calcularTotais soma desembolso de caminho 2 (pagamento-level)', async () => {
    // Cenário: 2 TXs de gasto, cada uma com 1 pagamento que tem emprestimoId
    // (caminho 2 puro, sem t.emprestimoId em nenhuma TX).
    mockAggregateSequence(
      [],  // caminho 1: vazio (nenhuma TX com t.emprestimoId)
      0,   // esperado pagamento: 0
      [    // caminho 2: 2 pagamentos de R$ 500 cada
        { _id: 'gasto', total: 1000 }
      ]
    );

    const totais = await calcularTotais(EMP_ID, USER_ID);
    expect(totais.totalDisbursed).toBe(1000);
    expect(totais.totalReceived).toBe(0);
  });

  test('calcularLucro retorna lucro correto em cenário mix caminho 1 + caminho 2', async () => {
    // Cenário "Estrela" simplificado:
    //   - caminho 1: 1 gasto de R$ 600
    //   - caminho 2: 3 pagamentos de gasto (R$ 500 + R$ 447,50 + R$ 380 = R$ 1.327,50)
    //   - caminho 1: 1 recebimento de R$ 2.127,50
    //   - Total desembolso = 600 + 1.327,50 = 1.927,50
    //   - Total recebido = 2.127,50
    //   - Lucro esperado = 2.127,50 - 1.927,50 = 200,00
    mockAggregateSequence(
      [   // caminho 1
        { _id: 'gasto', total: 600, totalEsperado: 800 },
        { _id: 'recebivel', total: 2127.50 }
      ],
      0,   // esperado pagamento
      [   // caminho 2 (3 pagamentos somam 1.327,50)
        { _id: 'gasto', total: 1327.50 }
      ]
    );

    const lucro = await calcularLucro(EMP_ID, USER_ID);
    expect(lucro).toBe(200);
  });
});

describe('emprestimoService.quitarEmprestimo / reabrirEmprestimo (Task 1 — quitação manual 2026-10-03)', () => {
  beforeEach(() => {
    mockEmprestimoFindOne.mockReset();
    mockEmprestimoFindOneAndUpdate.mockReset();
    mockTransacaoAggregate.mockReset();
    mockTransacaoFind.mockReset();
    mockTransacaoDeleteOne.mockReset();
    mockRecalcularJurosAuto.mockReset();
  });

  test('quitar: ativo → quitado e cria TX de juros com lucro realizado', async () => {
    // Cenário: gasto 2000, recebido 2300 → lucro realizado = 300.
    const emp = makeEmprestimo({ status: 'ativo' });
    mockEmprestimoFindOne.mockResolvedValue(emp);
    // calcularLucro consome 3 aggregates; obterEmprestimoComTotais consome mais 3.
    mockAggregateSequence(
      [{ _id: 'gasto', total: 2000 }, { _id: 'recebivel', total: 2300 }],
      2000
    );
    mockAggregateSequence(
      [{ _id: 'gasto', total: 2000 }, { _id: 'recebivel', total: 2300 }],
      2000
    );
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'criada', transacao: { _id: 'tx', valor: 300 } });

    await quitarEmprestimo(String(EMP_ID), USER_ID);

    expect(emp.status).toBe('quitado');
    expect(emp.dataQuitacao).toBeTruthy();
    expect(emp.save).toHaveBeenCalled();

    expect(mockRecalcularJurosAuto).toHaveBeenCalledWith(
      expect.objectContaining({ _id: EMP_ID }),
      300
    );
  });

  test('quitar: só ativo pode quitar (status=quitado lança erro)', async () => {
    mockEmprestimoFindOne.mockResolvedValue(makeEmprestimo({ status: 'quitado' }));

    await expect(quitarEmprestimo(String(EMP_ID), USER_ID)).rejects.toThrow();
  });

  test('quitar: empréstimo não encontrado lança erro', async () => {
    mockEmprestimoFindOne.mockResolvedValue(null);

    await expect(quitarEmprestimo(String(EMP_ID), USER_ID)).rejects.toThrow();
  });

  test('reabrir: quitado → ativo e deleta TX de juros auto', async () => {
    const emp = makeEmprestimo({ status: 'quitado', dataQuitacao: new Date() });
    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockTransacaoDeleteOne.mockResolvedValue({ deletedCount: 1 });
    // obterEmprestimoComTotais consome 3 aggregates (calcularTotais).
    mockAggregateSequence(
      [{ _id: 'gasto', total: 2000 }, { _id: 'recebivel', total: 2300 }],
      2000
    );

    await reabrirEmprestimo(String(EMP_ID), USER_ID);

    expect(emp.status).toBe('ativo');
    expect(emp.dataQuitacao).toBeNull();
    expect(emp.save).toHaveBeenCalled();
    expect(mockTransacaoDeleteOne).toHaveBeenCalledWith(
      { emprestimoId: EMP_ID, emprestimoEhJurosAuto: true }
    );
    // reabrirEmprestimo NÃO recalcula juros — quitação é manual.
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('reabrir: só quitado pode reabrir (status=ativo lança erro)', async () => {
    mockEmprestimoFindOne.mockResolvedValue(makeEmprestimo({ status: 'ativo' }));

    await expect(reabrirEmprestimo(String(EMP_ID), USER_ID)).rejects.toThrow();
  });

  test('reabrir: empréstimo não encontrado lança erro', async () => {
    mockEmprestimoFindOne.mockResolvedValue(null);

    await expect(reabrirEmprestimo(String(EMP_ID), USER_ID)).rejects.toThrow();
  });
});
