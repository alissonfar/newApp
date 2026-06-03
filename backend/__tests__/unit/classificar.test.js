// Mock dos models ANTES de require do service
// Mongoose queries encadeiam .lean() — o mock precisa expor essa cadeia.
// Estratégia: mockResolvedValue/setResolvedValueOnce controla o que .lean() resolve.
// O chainable garante que múltiplas chamadas seguidas funcionem.
function makeChainable() {
  const m = jest.fn();
  // chainable: cada chamada retorna um objeto com .lean() Promise-based
  m.mockImplementation(() => ({
    lean: () => {
      // Pega o último mockResolvedValue/setResolvedValueOnce configurado
      const result = m._lastResolved;
      return Promise.resolve(result != null ? result : null);
    }
  }));
  // Helper: seta valor para todas as chamadas futuras (até ser sobrescrito)
  m.setResolvedValue = (v) => { m._lastResolved = v; m.mockImplementation(() => ({ lean: () => Promise.resolve(v) })); };
  m.setNextResolvedValue = (v) => { m._lastResolved = v; m.mockImplementationOnce(() => ({ lean: () => Promise.resolve(v) })); };
  return m;
}

const mockFns = {
  Transacao: {
    findOne: makeChainable(),
    find: makeChainable()
  },
  TransacaoImportada: {
    findOne: makeChainable()
  },
  Importacao: {},
  Usuario: {}
};

jest.mock('../../src/models/transacao', () => mockFns.Transacao);
jest.mock('../../src/models/transacaoImportada', () => mockFns.TransacaoImportada);
jest.mock('../../src/models/importacao', () => mockFns.Importacao);
jest.mock('../../src/models/usuarios', () => mockFns.Usuario);

const { classificarTransacoes, JANELA_POSSIVEL_DUPLICATA_DIAS, TOLERANCIA_VALOR } = require('../../src/services/importacaoService');

const USUARIO_ID = 'user-123';
const DEDUP_QUERY_KEY = (t) => expect.objectContaining({ usuario: USUARIO_ID, deduplicationKey: expect.any(String) });

function mockTransacaoExiste(transacao) {
  return { _id: 'tx-existente', data: transacao.data, valor: transacao.valor, descricao: transacao.descricao, status: 'ativo' };
}

describe('classificarTransacoes — detecção de possível duplicata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('match exato: classifica como jaImportada (não duplicata)', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 50, descricao: 'iFood', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(mockTransacaoExiste(t));
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.jaImportadas).toHaveLength(1);
    expect(r.novas).toHaveLength(0);
    expect(r.possiveisDuplicatas).toHaveLength(0);
  });

  test('match fuzzy 1 dia de diferença: classifica como possivelDuplicata', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 89.9, descricao: 'Uber', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    const existente = { _id: 'tx-uber-antiga', data: new Date('2026-05-14T12:00:00Z'), valor: 89.9, descricao: 'Uber', status: 'ativo' };
    mockFns.Transacao.find.setResolvedValue([existente]);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.possiveisDuplicatas).toHaveLength(1);
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteId).toBe('tx-uber-antiga');
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteDistanciaDias).toBe(1);
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteDescricao).toBe('Uber');
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteValor).toBe(89.9);
    expect(r.novas).toHaveLength(0);
  });

  test('match fuzzy 7 dias (limite): ainda é possivelDuplicata', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 50, descricao: 'Spotify', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    const existente = { _id: 'tx-sp', data: new Date('2026-05-08T12:00:00Z'), valor: 50, descricao: 'Spotify', status: 'ativo' };
    mockFns.Transacao.find.setResolvedValue([existente]);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.possiveisDuplicatas).toHaveLength(1);
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteDistanciaDias).toBe(7);
  });

  test('fora da janela de 8 dias: classifica como nova (não duplicata)', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 50, descricao: 'Netflix', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    mockFns.Transacao.find.setResolvedValue([]);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.possiveisDuplicatas).toHaveLength(0);
    expect(r.novas).toHaveLength(1);
  });

  test('valor diferente: classifica como nova (não duplicata)', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 100, descricao: 'Amazon', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    mockFns.Transacao.find.setResolvedValue([]);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.possiveisDuplicatas).toHaveLength(0);
    expect(r.novas).toHaveLength(1);
  });

  test('descrição diferente: classifica como nova (não duplicata)', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 50, descricao: 'iFood', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    mockFns.Transacao.find.setResolvedValue([]);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.possiveisDuplicatas).toHaveLength(0);
    expect(r.novas).toHaveLength(1);
  });

  test('múltiplas candidatas: pega a mais próxima em data', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 30, descricao: 'Café', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    const candidatas = [
      { _id: 'tx-3dias', data: new Date('2026-05-12T12:00:00Z'), valor: 30, descricao: 'Café', status: 'ativo' },
      { _id: 'tx-1dia', data: new Date('2026-05-14T12:00:00Z'), valor: 30, descricao: 'Café', status: 'ativo' },
      { _id: 'tx-5dias', data: new Date('2026-05-10T12:00:00Z'), valor: 30, descricao: 'Café', status: 'ativo' }
    ];
    mockFns.Transacao.find.setResolvedValue(candidatas);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.possiveisDuplicatas).toHaveLength(1);
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteId).toBe('tx-1dia');
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteDistanciaDias).toBe(1);
  });

  test('valor com diferença < 0.01: ainda é possivelDuplicata (tolerância)', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 100, descricao: 'Loja', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    const existente = { _id: 'tx-loja', data: new Date('2026-05-14T12:00:00Z'), valor: 100.005, descricao: 'Loja', status: 'ativo' };
    mockFns.Transacao.find.setResolvedValue([existente]);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.possiveisDuplicatas).toHaveLength(1);
    expect(r.possiveisDuplicatas[0].transacaoSemelhanteValor).toBe(100.005);
  });

  test('data inválida: classifica como nova (sem fuzzy)', async () => {
    const t = { data: 'data-invalida', valor: 50, descricao: 'Teste', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.novas).toHaveLength(1);
    expect(r.possiveisDuplicatas).toHaveLength(0);
  });

  test('descrição vazia: classifica como nova (sem fuzzy)', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 50, descricao: '', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue(null);
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.novas).toHaveLength(1);
    expect(r.possiveisDuplicatas).toHaveLength(0);
  });

  test('já ignorada: classifica como jaIgnorada (não duplicata)', async () => {
    const t = { data: new Date('2026-05-15T12:00:00Z'), valor: 50, descricao: 'Já ignorada', tipo: 'gasto' };
    mockFns.Transacao.findOne.setResolvedValue(null);
    mockFns.TransacaoImportada.findOne.setResolvedValue({ _id: 'ti-1', status: 'ignorada' });
    const r = await classificarTransacoes([t], USUARIO_ID);
    expect(r.jaIgnoradas).toHaveLength(1);
    expect(r.possiveisDuplicatas).toHaveLength(0);
    expect(r.novas).toHaveLength(0);
  });

  test('constantes exportadas corretamente', () => {
    expect(JANELA_POSSIVEL_DUPLICATA_DIAS).toBe(7);
    expect(TOLERANCIA_VALOR).toBe(0.01);
  });
});
