const fs = require('fs');
const path = require('path');
const registry = require('../../src/services/parsers');
const ImportacaoService = require('../../src/services/importacaoService');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'importacao');

function ler(nome) {
  return fs.readFileSync(path.join(FIXTURES, nome), 'utf8');
}

describe('Parser Registry', () => {
  test('detecta Fatura Nubank', () => {
    const det = registry.detectar({ filename: 'nubank_fatura.csv', conteudo: ler('nubank_fatura.csv') });
    expect(det.parser.id).toBe('nubank_fatura');
    expect(det.score).toBeGreaterThan(0.9);
  });

  test('detecta Extrato Nubank', () => {
    const det = registry.detectar({ filename: 'nubank_extrato.csv', conteudo: ler('nubank_extrato.csv') });
    expect(det.parser.id).toBe('nubank_extrato');
    expect(det.score).toBeGreaterThan(0.9);
  });

  test('detecta CSV genérico (Lancamento/Valor/Data)', () => {
    const det = registry.detectar({ filename: 'relatorio.csv', conteudo: ler('generico.csv') });
    expect(det.parser.id).toBe('generico_csv');
  });

  test('detecta JSON por extensão', () => {
    const det = registry.detectar({ filename: 'padrao.json', conteudo: ler('padrao.json') });
    expect(det.parser.id).toBe('json');
  });

  test('parse Fatura Nubank retorna 3 transações do tipo gasto', () => {
    const det = registry.detectar({ filename: 'nubank_fatura.csv', conteudo: ler('nubank_fatura.csv') });
    const trans = det.parser.parse({ conteudo: ler('nubank_fatura.csv') });
    expect(trans).toHaveLength(3);
    expect(trans.every(t => t.tipo === 'gasto')).toBe(true);
    expect(trans[0].valor).toBe(89.9);
  });

  test('parse Extrato Nubank identifica gasto/recebível e parcela', () => {
    const det = registry.detectar({ filename: 'nubank_extrato.csv', conteudo: ler('nubank_extrato.csv') });
    const trans = det.parser.parse({ conteudo: ler('nubank_extrato.csv') });
    expect(trans).toHaveLength(3);
    expect(trans[0].tipo).toBe('gasto');
    expect(trans[1].tipo).toBe('recebivel');
    expect(trans[2].isInstallment).toBe(true);
    expect(trans[2].installmentNumber).toBe(2);
    expect(trans[2].installmentTotal).toBe(3);
  });

  test('registry.removeBOM não quebra detecção', () => {
    const sem = ler('nubank_extrato.csv');
    const com = '\uFEFF' + sem;
    const det = registry.detectar({ filename: 'nubank_extrato.csv', conteudo: com });
    expect(det.parser.id).toBe('nubank_extrato');
  });

  test('parse CSV genérico com delimitador ;', () => {
    const det = registry.detectar({ filename: 'rel.csv', conteudo: ler('generico.csv') });
    const trans = det.parser.parse({ conteudo: ler('generico.csv') });
    expect(trans).toHaveLength(3);
    expect(trans[1].tipo).toBe('gasto');
    expect(trans[0].descricao).toBe('Compra A');
  });

  test('parse JSON', () => {
    const det = registry.detectar({ filename: 'padrao.json', conteudo: ler('padrao.json') });
    const trans = det.parser.parse({ conteudo: ler('padrao.json') });
    expect(trans).toHaveLength(1);
    expect(trans[0].descricao).toBe('Teste');
  });

  test('parseCSV legado (Fatura Nubank) é equivalente ao parser registry', () => {
    const conteudo = ler('nubank_fatura.csv');
    const legado = ImportacaoService.parseCSV(conteudo);
    const novo = registry.parse({ conteudo, filename: 'nubank_fatura.csv' });
    expect(novo).toHaveLength(legado.length);
    legado.forEach((l, i) => {
      expect(l.tipo).toBe(novo[i].tipo);
      expect(l.valor).toBe(novo[i].valor);
      expect(l.descricao).toBe(novo[i].descricao);
    });
  });

  test('parseCSV legado (Extrato Nubank) é equivalente ao parser registry', () => {
    const conteudo = ler('nubank_extrato.csv');
    const legado = ImportacaoService.parseCSV(conteudo);
    const novo = registry.parse({ conteudo, filename: 'nubank_extrato.csv' });
    expect(novo).toHaveLength(legado.length);
    legado.forEach((l, i) => {
      expect(l.tipo).toBe(novo[i].tipo);
      expect(l.valor).toBe(novo[i].valor);
      expect(l.descricao).toBe(novo[i].descricao);
    });
  });
});
