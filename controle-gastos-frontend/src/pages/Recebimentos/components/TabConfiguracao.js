import React from 'react';
import Select from 'react-select';
import { FaReceipt } from 'react-icons/fa';
import { CircularProgress } from '@mui/material';
import { useRecebimentos } from '../context/RecebimentosContext';
import { useData } from '../../../context/DataContext';
import RecebimentoCard from './RecebimentoCard';
import TagBadge from './TagBadge';
import IconRenderer from '../../../components/shared/IconRenderer';
import Card, { CardContent } from '../../../components/shared/Card';
import SectionHeader from '../../../components/shared/SectionHeader';
import Button from '../../../components/shared/Button';
import EmptyState from '../../../components/shared/EmptyState';
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
        <Card className="tab-configuracao-card">
          <CardContent>
            <SectionHeader title="Selecione o recebimento" icon={<FaReceipt size={18} />} />
            <p className="dica">Transações do tipo recebível que ainda não foram conciliadas.</p>
            <div className="filtros-row">
              <input
                type="date"
                className="input-field"
                value={draftFiltrosRecebimentos?.dataInicio || ''}
                onChange={(e) => setDraftFiltrosRecebimentos({ dataInicio: e.target.value })}
                placeholder="Data início"
              />
              <input
                type="date"
                className="input-field"
                value={draftFiltrosRecebimentos?.dataFim || ''}
                onChange={(e) => setDraftFiltrosRecebimentos({ dataFim: e.target.value })}
                placeholder="Data fim"
              />
              <Button
                variant="primary"
                onClick={applyFiltrosRecebimentos}
                disabled={loadingRecebimentos}
              >
                {loadingRecebimentos ? 'Carregando...' : 'Filtrar'}
              </Button>
            </div>
            <div className="lista-recebimentos">
              {loadingRecebimentos ? (
                <div className="tab-loading">
                  <CircularProgress size={32} />
                  <p>Carregando...</p>
                </div>
              ) : recebimentosDisponiveis.length === 0 ? (
                <EmptyState message={mensagemVazio} icon={<FaReceipt size={48} />} />
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
          </CardContent>
        </Card>

        <Card className="tab-configuracao-card">
          <CardContent>
            {recebimentoSelecionado ? (
              <>
                <SectionHeader title="Tag para aplicar" icon={<IconRenderer nome="tag" size={18} />} />
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
              <EmptyState
                message="Selecione um recebimento à esquerda para configurar a conciliação."
                icon={<FaReceipt size={48} />}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TabConfiguracao;
