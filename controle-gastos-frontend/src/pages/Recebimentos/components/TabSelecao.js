import React from 'react';
import { useRecebimentos } from '../context/RecebimentosContext';
import { useData } from '../../../context/DataContext';
import TagBadge from './TagBadge';
import { formatDateBR } from '../../../utils/dateUtils';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TabSelecao = () => {
  const { tags } = useData();
  const {
    recebimentoSelecionado,
    pendentes,
    loadingPendentes,
    transacoesSelecionadasSet,
    toggleSelecao,
    setTabAtiva
  } = useRecebimentos();

  const totalSelecionado = pendentes
    .filter((t) => transacoesSelecionadasSet.has(t._id))
    .reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
  const valorRecebimento = recebimentoSelecionado
    ? Math.abs(parseFloat(recebimentoSelecionado.valor) || 0)
    : 0;
  const diferenca = Math.round((valorRecebimento - totalSelecionado) * 100) / 100;

  let statusVisual = 'neutro';
  if (Math.abs(diferenca) < 0.01) statusVisual = 'exato';
  else if (diferenca > 0) statusVisual = 'falta';
  else statusVisual = 'sobra';

  if (!recebimentoSelecionado) {
    return (
      <div className="tab-selecao-placeholder">
        <p>Selecione um recebimento na aba Configuração e configure os filtros.</p>
      </div>
    );
  }

  return (
    <div className="tab-selecao">
      <div className="tab-selecao-totais">
        <div className="totais-item">
          <span>Total selecionado:</span>
          <strong>R$ {formatarValor(totalSelecionado)}</strong>
        </div>
        <div className={`totais-item diferenca ${statusVisual}`}>
          <span>
            {statusVisual === 'exato' && 'Valor exato'}
            {statusVisual === 'falta' && 'Falta valor'}
            {statusVisual === 'sobra' && 'Sobra valor'}
          </span>
          <strong>
            {statusVisual === 'exato' && '✓'}
            {statusVisual === 'falta' && `R$ ${formatarValor(diferenca)}`}
            {statusVisual === 'sobra' && `R$ ${formatarValor(Math.abs(diferenca))}`}
          </strong>
        </div>
      </div>

      <div className="tab-selecao-tabela-wrapper">
        {loadingPendentes ? (
          <p>Carregando gastos pendentes...</p>
        ) : pendentes.length === 0 ? (
          <p className="sem-dados">Nenhum gasto pendente para o filtro.</p>
        ) : (
          <table className="tabela-pendentes">
            <thead>
              <tr>
                <th></th>
                <th>Valor</th>
                <th>Data</th>
                <th>Pessoa</th>
                <th>Status</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((t) => {
                const pessoa = t.pagamentos?.[0]?.pessoa || '-';
                return (
                  <tr key={t._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={transacoesSelecionadasSet.has(t._id)}
                        onChange={() => toggleSelecao(t._id)}
                      />
                    </td>
                    <td>R$ {formatarValor(t.valor)}</td>
                    <td>{formatDateBR(t.data)}</td>
                    <td>{pessoa}</td>
                    <td>{t.status || 'ativo'}</td>
                    <td>
                      {(() => {
                        const pagTags = t.pagamentos?.[0]?.tags;
                        if (!pagTags || typeof pagTags !== 'object') return '-';
                        const tagIds = Object.keys(pagTags).filter((k) => pagTags[k]);
                        if (tagIds.length === 0) return '-';
                        return (
                          <span className="tags-cell">
                            {tagIds.map((tagId) => {
                              const tag = (tags || []).find((tg) => tg._id === tagId);
                              return tag ? <TagBadge key={tagId} tag={tag} size={12} /> : null;
                            })}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalSelecionado > valorRecebimento && (
        <p className="erro-total">O total selecionado excede o valor do recebimento. Desmarque algumas transações.</p>
      )}

      {transacoesSelecionadasSet.size > 0 && statusVisual !== 'sobra' && (
        <button className="btn-avancar" onClick={() => setTabAtiva(3)}>
          Ir para Resumo e Confirmação →
        </button>
      )}
    </div>
  );
};

export default TabSelecao;
