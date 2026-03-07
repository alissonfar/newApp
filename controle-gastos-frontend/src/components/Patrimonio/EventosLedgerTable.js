import React from 'react';

const LABEL_POR_TIPO_EVENTO = {
  snapshot_inicial: 'Snapshot inicial',
  deposito: 'Depósito',
  saque: 'Saque',
  transferencia_saida: 'Transferência saída',
  transferencia_entrada: 'Transferência entrada',
  rendimento: 'Rendimento',
  aporte: 'Aporte',
  importacao_ofx: 'Importação OFX',
  importacao_csv: 'Importação CSV',
  ajuste_manual: 'Ajuste manual',
  correcao: 'Correção'
};

const EventosLedgerTable = ({ eventos, formatarMoeda, formatarData }) => {
  if (!eventos || eventos.length === 0) return null;

  return (
    <table className="tabela-historico tabela-eventos-ledger">
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Valor (delta)</th>
          <th>Origem</th>
          <th>Descrição</th>
        </tr>
      </thead>
      <tbody>
        {eventos.map((ev) => (
          <tr key={ev._id}>
            <td>{formatarData(ev.dataEvento)}</td>
            <td>{LABEL_POR_TIPO_EVENTO[ev.tipoEvento] || ev.tipoEvento}</td>
            <td className={ev.valor > 0 ? 'tabela-historico-variacao variacao-positiva' : ev.valor < 0 ? 'tabela-historico-variacao variacao-negativa' : ''}>
              {ev.valor > 0 ? '+' : ''}{formatarMoeda(ev.valor)}
            </td>
            <td>{ev.origemSistema}</td>
            <td>{ev.descricao || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default EventosLedgerTable;
export { LABEL_POR_TIPO_EVENTO };
