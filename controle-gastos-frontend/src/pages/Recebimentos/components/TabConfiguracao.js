import React, { useState } from 'react';
import Select from 'react-select';
import { FaReceipt, FaCheckCircle, FaEdit, FaTimes } from 'react-icons/fa';
import { CircularProgress } from '@mui/material';
import { useRecebimentos } from '../context/RecebimentosContext';
import { useData } from '../../../context/DataContext';
import { useAuth } from '../../../context/AuthContext';
import RecebimentoCard from './RecebimentoCard';
import TagBadge from './TagBadge';
import IconRenderer from '../../../components/shared/IconRenderer';
import Card, { CardContent } from '../../../components/shared/Card';
import SectionHeader from '../../../components/shared/SectionHeader';
import Button from '../../../components/shared/Button';
import EmptyState from '../../../components/shared/EmptyState';
import PeriodQuickFilter from '../../../components/shared/PeriodQuickFilter';
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
    removeTagSelecionada,
    draftFiltrosRecebimentos,
    hasBuscadoRecebimentos,
    setRecebimentoSelecionado,
    setTagSelecionada,
    setRemoveTagSelecionada,
    setDraftFiltrosRecebimentos,
    applyFiltrosRecebimentos,
    aplicarDefaultsSeVazio
  } = useRecebimentos();
  const { tags } = useData();
  const { usuario } = useAuth();

  // Defaults configurados (podem ser null se não configurados)
  const tagReceberPadraoId = usuario?.preferencias?.tagReceberPadraoId || null;
  const tagRemoverPadraoId = usuario?.preferencias?.tagRemoverPadraoId || null;

  // "Pré-preenchido pelas suas configurações" aparece quando o valor atual bate com o default salvo
  const tagReceberEhDefault = !!(tagReceberPadraoId && tagSelecionada === tagReceberPadraoId);
  const tagRemoverEhDefault = !!(tagRemoverPadraoId && removeTagSelecionada === tagRemoverPadraoId);

  // Se o default existe e o usuário não escolheu nada diferente, escondemos o select detalhado.
  // Só expandimos se o usuário clicar em "Alterar" ou se não houver default configurado.
  const [editandoTag, setEditandoTag] = useState(false);
  const [editandoRemoveTag, setEditandoRemoveTag] = useState(false);
  const tagReceberObrigatoria = !tagReceberPadraoId;
  const showTagSelect = editandoTag || tagReceberObrigatoria || !tagSelecionada;
  const showRemoveTagSelect = editandoRemoveTag || (removeTagSelecionada && !tagRemoverPadraoId) || (!removeTagSelecionada && !tagRemoverPadraoId && editandoRemoveTag);

  const tagObj = (id) => (tags || []).find((t) => t._id === id) || null;
  const tagSelecionadaObj = tagObj(tagSelecionada);
  const removeTagSelecionadaObj = tagObj(removeTagSelecionada);

  const pessoasRecebimento = (recebimentoSelecionado?.pagamentos || []).map((p) => p?.pessoa).filter(Boolean);
  const pessoaRecebimento = pessoasRecebimento.length > 0 ? pessoasRecebimento.join(', ') : '-';

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
            <div className="filtros-recebimentos">
              <PeriodQuickFilter
                dataInicio={draftFiltrosRecebimentos?.dataInicio || ''}
                dataFim={draftFiltrosRecebimentos?.dataFim || ''}
                onChange={(range) => {
                  setDraftFiltrosRecebimentos(range);
                }}
                onPeriodSelect={({ dataInicio, dataFim }) => {
                  if (dataInicio && dataFim) {
                    applyFiltrosRecebimentos({ dataInicio, dataFim });
                  }
                }}
                showCustomInputs={true}
              />
              <div className="filtros-row filtros-row--action">
                <Button
                  variant="primary"
                  onClick={applyFiltrosRecebimentos}
                  disabled={loadingRecebimentos}
                >
                  {loadingRecebimentos ? 'Carregando...' : 'Filtrar'}
                </Button>
              </div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <SectionHeader title="Tag para aplicar" icon={<IconRenderer nome="tag" size={18} />} />
                </div>
                <p className="dica">Tag que será aplicada às transações quitadas (ex: Conta Paga).</p>

                {tagSelecionadaObj && !showTagSelect ? (
                  <div className="tag-compacta-pill">
                    <TagBadge tag={tagSelecionadaObj} size={16} />
                    {tagReceberEhDefault && (
                      <span className="tag-compacta-pill__badge" title="Padrão das configurações de Recebimentos">
                        <FaCheckCircle size={10} /> padrão
                      </span>
                    )}
                    <button
                      type="button"
                      className="tag-compacta-pill__btn"
                      onClick={() => setEditandoTag(true)}
                      title="Escolher outra tag"
                    >
                      <FaEdit size={11} /> Alterar
                    </button>
                    {!tagReceberEhDefault && (
                      <button
                        type="button"
                        className="tag-compacta-pill__btn tag-compacta-pill__btn--danger"
                        onClick={() => {
                          setTagSelecionada('');
                          aplicarDefaultsSeVazio();
                        }}
                        title="Voltar para a tag padrão"
                      >
                        <FaTimes size={11} /> Limpar
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <Select
                      autoFocus={editandoTag}
                      value={tagSelecionadaObj ? { value: tagSelecionadaObj._id, label: tagSelecionadaObj.nome, cor: tagSelecionadaObj.cor, icone: tagSelecionadaObj.icone } : null}
                      onChange={(opt) => {
                        setTagSelecionada(opt?.value || '');
                        setEditandoTag(false);
                      }}
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
                    {tagReceberPadraoId && tagSelecionada && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          className="tag-link-button"
                          onClick={() => {
                            setEditandoTag(false);
                            setTagSelecionada('');
                            aplicarDefaultsSeVazio();
                          }}
                        >
                          Cancelar e voltar para o padrão
                        </button>
                      </div>
                    )}
                  </>
                )}

                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <SectionHeader title="Tag para remover (opcional)" icon={<IconRenderer nome="tag" size={18} />} />
                  </div>
                  <p className="dica">Tag que será removida dos pagamentos ao conciliar.</p>
                  {removeTagSelecionadaObj && !showRemoveTagSelect ? (
                    <div className="tag-compacta-pill">
                      <TagBadge tag={removeTagSelecionadaObj} size={16} />
                      {tagRemoverEhDefault && (
                        <span className="tag-compacta-pill__badge" title="Padrão das configurações de Recebimentos">
                          <FaCheckCircle size={10} /> padrão
                        </span>
                      )}
                      <button
                        type="button"
                        className="tag-compacta-pill__btn"
                        onClick={() => setEditandoRemoveTag(true)}
                        title="Escolher outra tag"
                      >
                        <FaEdit size={11} /> Alterar
                      </button>
                      <button
                        type="button"
                        className="tag-compacta-pill__btn tag-compacta-pill__btn--danger"
                        onClick={() => {
                          setRemoveTagSelecionada('');
                          aplicarDefaultsSeVazio();
                        }}
                        title="Remover a tag selecionada"
                      >
                        <FaTimes size={11} /> Limpar
                      </button>
                    </div>
                  ) : (
                    <Select
                      autoFocus={editandoRemoveTag}
                      value={removeTagSelecionadaObj ? { value: removeTagSelecionadaObj._id, label: removeTagSelecionadaObj.nome, cor: removeTagSelecionadaObj.cor, icone: removeTagSelecionadaObj.icone } : null}
                      onChange={(opt) => {
                        setRemoveTagSelecionada(opt?.value || '');
                        setEditandoRemoveTag(false);
                      }}
                      options={(tags || []).map((tag) => ({ value: tag._id, label: tag.nome, cor: tag.cor, icone: tag.icone }))}
                      placeholder="-- Nenhuma (opcional) --"
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
                  )}
                </div>

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
