import React from 'react';
import Select from 'react-select';
import { useRecebimentos } from '../context/RecebimentosContext';
import { useData } from '../../../context/DataContext';
import RecebimentoCard from './RecebimentoCard';
import TagBadge from './TagBadge';
import IconRenderer from '../../../components/shared/IconRenderer';
import { formatDateBR } from '../../../utils/dateUtils';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TabConfiguracao = () => {
  const {
    recebimentosDisponiveis,
    loadingRecebimentos,
    recebimentoSelecionado,
    tagSelecionada,
    draftFiltrosRecebimentos,
    hasBuscadoRecebimentos,
    setRecebimentoSelecionado,
    setTagSelecionada,
    setDraftFiltrosRecebimentos,
    applyFiltrosRecebimentos
  } = useRecebimentos();
  const { tags } = useData();

  const pessoaRecebimento = recebimentoSelecionado?.pagamentos?.[0]?.pessoa || '-';

  const mensagemVazio = !hasBuscadoRecebimentos
    ? 'Utilize os filtros e clique em Filtrar para buscar transações.'
    : 'Nenhum recebimento disponível para conciliação.';

  return (
    <div className="tab-configuracao">
      <div className="tab-configuracao-grid">
        <div className="tab-configuracao-col">
          <h3>Selecione o recebimento</h3>
          <p className="dica">Transações do tipo recebível que ainda não foram conciliadas.</p>
          <div className="filtros-row">
            <input
              type="date"
              value={draftFiltrosRecebimentos?.dataInicio || ''}
              onChange={(e) => setDraftFiltrosRecebimentos({ dataInicio: e.target.value })}
              placeholder="Data início"
            />
            <input
              type="date"
              value={draftFiltrosRecebimentos?.dataFim || ''}
              onChange={(e) => setDraftFiltrosRecebimentos({ dataFim: e.target.value })}
              placeholder="Data fim"
            />
            <button onClick={applyFiltrosRecebimentos} disabled={loadingRecebimentos}>
              {loadingRecebimentos ? 'Carregando...' : 'Filtrar'}
            </button>
          </div>
          <div className="lista-recebimentos">
            {loadingRecebimentos ? (
              <p>Carregando...</p>
            ) : recebimentosDisponiveis.length === 0 ? (
              <p className="sem-dados">{mensagemVazio}</p>
            ) : (
              recebimentosDisponiveis.map((t) => (
                <RecebimentoCard
                  key={t._id}
                  transacao={t}
                  selecionado={recebimentoSelecionado?._id === t._id}
                  onClick={() => setRecebimentoSelecionado(t)}
                />
              ))
            )}
          </div>
        </div>

        <div className="tab-configuracao-col">
          {recebimentoSelecionado ? (
            <>
              <h3>Tag para aplicar</h3>
              <p className="dica">Tag que será aplicada às transações quitadas (ex: Conta Paga).</p>
              <Select
                value={(() => {
                  const tag = (tags || []).find((t) => t._id === tagSelecionada);
                  return tag ? { value: tag._id, label: tag.nome, cor: tag.cor, icone: tag.icone } : null;
                })()}
                onChange={(opt) => setTagSelecionada(opt?.value || '')}
                options={(tags || []).map((tag) => ({ value: tag._id, label: tag.nome, cor: tag.cor, icone: tag.icone }))}
                placeholder="-- Escolha uma tag --"
                isClearable
                className="tag-select-recebimentos"
                classNamePrefix="tag-select"
                formatOptionLabel={({ label, cor, icone }) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconRenderer nome={icone || 'tag'} size={18} cor={cor || '#64748b'} />
                    <span>{label}</span>
                  </div>
                )}
              />
              {tagSelecionada && (tags || []).find((t) => t._id === tagSelecionada) && (
                <div className="tag-selecionada-preview" style={{ marginTop: '0.75rem' }}>
                  <TagBadge tag={(tags || []).find((t) => t._id === tagSelecionada)} size={16} />
                </div>
              )}
              {tags?.length === 0 && (
                <p className="aviso">Configure tags em Gerenciar Tags antes de conciliar.</p>
              )}

              <div className="resumo-transacao">
                <h4>Resumo da transação</h4>
                <div className="resumo-transacao-item">
                  <span>Valor total:</span>
                  <strong>R$ {formatarValor(recebimentoSelecionado.valor)}</strong>
                </div>
                <div className="resumo-transacao-item">
                  <span>Data:</span>
                  <strong>{formatDateBR(recebimentoSelecionado.data)}</strong>
                </div>
                <div className="resumo-transacao-item">
                  <span>Pessoa:</span>
                  <strong>{pessoaRecebimento}</strong>
                </div>
                <div className="resumo-transacao-item">
                  <span>Tipo:</span>
                  <strong>{recebimentoSelecionado.tipo || 'recebível'}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="tab-configuracao-placeholder">
              <p>Selecione um recebimento à esquerda para configurar a conciliação.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TabConfiguracao;
