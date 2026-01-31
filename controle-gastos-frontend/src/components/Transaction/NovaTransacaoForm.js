// src/components/Transaction/NovaTransacaoForm.js

import React, { useEffect, useState, useRef } from 'react';
import Select from 'react-select'; // Import do React-Select
import { toast } from 'react-toastify'; // Import do toast do React Toastify
import { Tooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { criarTransacao, atualizarTransacao } from '../../api';
import { useData } from '../../context/DataContext';
import IconRenderer from '../shared/IconRenderer';
import './NovaTransacaoForm.css';
import { getTodayBR, getYesterdayBR, toISOStringBR } from '../../utils/dateUtils';

// Componente do Modal de Atalhos
const ShortcutsHelp = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="shortcuts-help-overlay" onClick={onClose}>
      <div className="shortcuts-help-content" onClick={e => e.stopPropagation()}>
        <h3>Atalhos de Teclado</h3>
        <div className="shortcuts-list">
          <div className="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Space</kbd>
            <span>Salvar e Continuar</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
            <span>Salvar e Fechar</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>H</kbd>
            <span>Definir data como Hoje</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>Y</kbd>
            <span>Definir data como Ontem</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>P</kbd>
            <span>Adicionar novo pagamento</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>R</kbd>
            <span>Remover último pagamento</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>D</kbd>
            <span>Focar na Descrição</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>V</kbd>
            <span>Focar no Valor Total</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>T</kbd>
            <span>Focar no Tipo</span>
          </div>
          <div className="shortcut-item">
            <kbd>Esc</kbd>
            <span>Fechar modal</span>
          </div>
        </div>
        <button className="close-shortcuts-btn" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
};

const NovaTransacaoForm = ({ onSuccess, onClose, transacao, proprietarioPadrao = '' }) => {
  // Estados dos dados gerais
  const [_id, set_Id] = useState(transacao?._id);
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(transacao ? transacao.data.split('T')[0] : '');
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  const [observacao, setObservacao] = useState(transacao ? transacao.observacao : '');
  
  // Novo estado para identificar se é uma transação importada
  const [isImportada, setIsImportada] = useState(transacao?.importacao ? true : false);
  const [importacaoId, setImportacaoId] = useState(transacao?.importacao || null);
  
  // Pagamentos: usamos paymentTags para manipulação (mapeando p.tags do backend)
  const [pagamentos, setPagamentos] = useState(
    transacao && transacao.pagamentos && transacao.pagamentos.length > 0
      ? transacao.pagamentos.map(p => ({
          ...p,
          paymentTags: p.tags || {}
        }))
      : [{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]
  );
  
  // Obter categorias e tags do DataContext
  const { categorias, tags: allTags, loadingData, errorData } = useData();
  
  // Refs para focar e rolagem
  const tipoRef = useRef(null);
  const descricaoRef = useRef(null);
  const dataRef = useRef(null);
  const valorRef = useRef(null);
  
  // Adicionar estado para controlar a visibilidade do modal de atalhos
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Estado para mostrar aviso de validação (não-bloqueante)
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  
  // Removido handleFocus - causava scroll excessivo durante navegação rápida por teclado
  
  // Ajustar useEffect para setar data inicial quando não for edição
  useEffect(() => {
    if (!transacao) {
      setData(getTodayBR());
    }
    // A dependência [transacao] permanece para garantir que execute quando o modo muda
  }, [transacao]);
  
  // Validação visual em tempo real (não-bloqueante)
  useEffect(() => {
    if (!valorTotal || pagamentos.length === 0) {
      setShowValidationWarning(false);
      return;
    }

    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);

    const total = parseFloat(valorTotal || 0);
    const diferenca = Math.abs(total - soma);

    // Mostra aviso se a diferença for > 0.01 (evita erros de arredondamento)
    setShowValidationWarning(diferenca > 0.01);
  }, [valorTotal, pagamentos]);

  // Sempre que "transacao" mudar (modo edição), preenche os estados
  useEffect(() => {
    if (transacao) {
      set_Id(transacao._id);
      setTipo(transacao.tipo);
      setDescricao(transacao.descricao);
      setData(transacao.data.split('T')[0]);
      setValorTotal(String(transacao.valor));
      setObservacao(transacao.observacao || '');
      
      // Atualiza os estados de importação
      setIsImportada(!!transacao.importacao);
      setImportacaoId(transacao.importacao || null);
      
      if (transacao.pagamentos && transacao.pagamentos.length > 0) {
        const pagamentosProcessados = transacao.pagamentos.map(p => ({
          pessoa: p.pessoa,
          valor: String(p.valor),
          paymentTags: p.tags || {}
        }));
        setPagamentos(pagamentosProcessados);
      } else {
        setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
      }
    }
  }, [transacao, proprietarioPadrao]);

  // Manipulação dos pagamentos
  const handlePagamentoChange = (index, field, value) => {
    const novosPagamentos = [...pagamentos];
    novosPagamentos[index][field] = value;
    setPagamentos(novosPagamentos);
  };
  
  const addPagamento = () => {
    setPagamentos([...pagamentos, { pessoa: '', valor: '', paymentTags: {} }]);
  };
  
  const removePagamento = (index = null) => {
    if (pagamentos.length <= 1) return;

    if (index !== null && index !== undefined) {
      // Remove pagamento específico
      const novosPagamentos = pagamentos.filter((_, i) => i !== index);
      setPagamentos(novosPagamentos);
    } else {
      // Remove o último (comportamento do atalho Alt+R)
      setPagamentos(pagamentos.slice(0, -1));
    }
  };
  
  // Se houver apenas 1 pagamento, replica o valor total
  const handleValorTotalChange = (e) => {
    const raw = e.target.value;
    setValorTotal(raw);
    if (pagamentos.length === 1) {
      handlePagamentoChange(0, 'valor', raw);
    }
  };
  
  // Validação: a soma dos pagamentos deve ser igual ao valor total
  const validatePagamentos = () => {
    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return parseFloat(valorTotal || 0) === soma;
  };
  
  // Atalhos de teclado consolidados
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC para fechar o modal
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // CTRL + ESPAÇO para salvar e continuar
      if (e.ctrlKey && e.keyCode === 32) {
        e.preventDefault();
        handleSubmit(new Event('submit'), false);
        return;
      }

      // CTRL + ENTER para salvar e fechar
      if (e.ctrlKey && e.keyCode === 13) {
        e.preventDefault();
        handleSubmit(new Event('submit'), true);
        return;
      }

      // ALT + H para definir data como hoje
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setHoje();
        return;
      }

      // ALT + Y para definir data como ontem
      if (e.altKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setOntem();
        return;
      }

      // ALT + P para adicionar novo pagamento
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        addPagamento();
        return;
      }

      // ALT + R para remover último pagamento
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        removePagamento();
        return;
      }

      // ALT + D para focar na descrição (campo mais usado)
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        descricaoRef.current?.focus();
        return;
      }

      // ALT + V para focar no valor total
      if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        valorRef.current?.focus();
        return;
      }

      // ALT + T para focar no tipo
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        tipoRef.current?.focus();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tipo, descricao, data, valorTotal, observacao, pagamentos, onClose]); // Dependências necessárias
  
  const setHoje = () => {
    setData(getTodayBR());
  };

  const setOntem = () => {
    setData(getYesterdayBR());
  };

  const handleSubmit = async (e, closeModal = true) => {
    e.preventDefault();
    
    if (!validatePagamentos()) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total da transação.');
      return;
    }
    
    try {
      const transacaoData = {
        _id,
        tipo,
        descricao,
        data: toISOStringBR(data),
        valor: parseFloat(valorTotal),
        observacao,
        pagamentos: pagamentos.map(p => ({
          pessoa: p.pessoa,
          valor: parseFloat(p.valor),
          tags: p.paymentTags
        }))
      };

      let response;

      // Se for uma transação importada
      if (isImportada && importacaoId) {
        // Importa o serviço de importação dinamicamente para evitar dependência circular
        const { default: importacaoService } = await import('../../services/importacaoService');
        
        console.log('[DEBUG] Atualizando transação importada:', {
          importacaoId,
          transacaoId: _id,
          dados: transacaoData
        });

        response = await importacaoService.atualizarTransacao(
          importacaoId,
          _id,
          transacaoData
        );
      } else if (_id) {
        // Transação normal - edição
        response = await atualizarTransacao(_id, transacaoData);
      } else {
        // Transação normal - criação
        response = await criarTransacao(transacaoData);
      }

      // Chama o callback de sucesso com a resposta
      await onSuccess(response);

      if (closeModal) {
        onClose();
      } else {
        // Limpa o formulário para nova entrada, MAS preserva o tipo (90% dos lançamentos são do mesmo tipo)
        const tipoAtual = tipo; // Preserva o tipo atual
        set_Id(null);
        // setTipo('gasto'); // NÃO resetar - mantém o tipo atual
        setDescricao('');
        setData(getTodayBR());
        setValorTotal('');
        setObservacao('');
        setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
        setIsImportada(false);
        setImportacaoId(null);
        // Foca no primeiro campo (Descrição, já que Tipo raramente muda)
        setTimeout(() => descricaoRef.current?.focus(), 50);
      }
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      toast.error(error.message || 'Erro ao salvar transação.');
    }
  };
  
  // Foca no campo apropriado quando o componente é montado
  useEffect(() => {
    // Se está editando, foca no tipo (pode precisar mudar)
    // Se é nova transação, foca na descrição (mais eficiente para lançamentos repetitivos)
    if (transacao && tipoRef.current) {
      tipoRef.current.focus();
    } else if (descricaoRef.current) {
      descricaoRef.current.focus();
    }
  }, []);

  // Adicionar tratamento para loading e erro dos dados do contexto
  if (loadingData) {
    return <div className="loading-indicator">Carregando dados essenciais...</div>; // Ou um spinner
  }

  if (errorData) {
    return <div className="error-message">Erro ao carregar categorias e tags. Tente atualizar a página.</div>;
  }

  return (
    <div className="nova-transacao-form-container">
      <h2>{transacao ? 'Editar Transação' : 'Nova Transação'}</h2>
      
      {/* Ícone de ajuda */}
      <IconButton 
        className="help-icon"
        onClick={() => setShowShortcuts(true)}
        color="primary"
      >
        <Tooltip title="Ver atalhos de teclado">
          <HelpOutlineIcon />
        </Tooltip>
      </IconButton>

      {/* Modal de atalhos */}
      <ShortcutsHelp 
        open={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />

      <form onSubmit={(e) => handleSubmit(e, true)}>
        <div className="form-grid">
          <div className="left-column">
            <div className="form-section">
              <label>Tipo:</label>
              <select
                ref={tipoRef}
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                required
                tabIndex={1}
              >
                <option value="gasto">Gasto</option>
                <option value="recebivel">Recebível</option>
              </select>
            </div>
            <div className="form-section">
              <label>Descrição:</label>
              <input
                type="text"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                required
                ref={descricaoRef}
                tabIndex={2}
              />
            </div>
            <div className="form-section">
              <label>Data:</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                required
                tabIndex={3}
              />
              <div className="date-shortcuts">
                <Tooltip title="Alt + H">
                  <button type="button" onClick={setHoje}>Hoje</button>
                </Tooltip>
                <Tooltip title="Alt + Y">
                  <button type="button" onClick={setOntem}>Ontem</button>
                </Tooltip>
              </div>
            </div>
            <div className="form-section">
              <label>Valor Total:</label>
              <input
                type="number"
                step="0.01"
                value={valorTotal}
                onChange={handleValorTotalChange}
                required
                ref={valorRef}
                tabIndex={4}
                style={showValidationWarning ? { borderColor: '#ff9800', borderWidth: '2px' } : {}}
              />
              {showValidationWarning && (
                <div style={{
                  color: '#ff9800',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  ⚠️ Soma dos pagamentos diferente do valor total
                </div>
              )}
            </div>
            <div className="form-section">
              <label>Observação:</label>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows="3"
                placeholder="Adicione uma observação (opcional)"
                tabIndex={90}
              />
            </div>
          </div>
          <div className="right-column">
            <div className="form-section pagamentos-section">
              <h3>Pagamentos</h3>
              {pagamentos.map((pag, index) => (
                <div key={index} className="pagamento-item">
                  <div className="form-section">
                    <label>Pessoa:</label>
                    <input
                      type="text"
                      value={pag.pessoa}
                      onChange={e => handlePagamentoChange(index, 'pessoa', e.target.value)}
                      required
                      tabIndex={5 + (index * 10)}
                          />
                  </div>
                  <div className="form-section">
                    <label>Valor:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pag.valor}
                      onChange={e => handlePagamentoChange(index, 'valor', e.target.value)}
                      required
                      tabIndex={6 + (index * 10)}
                          />
                  </div>

                  {/* Tags por Categoria */}
                  <div className="tags-section">
                    <h4>Tags para Pagamento</h4>
                    {categorias.map((cat) => {
                     
                      
                      const options = allTags.filter(t => t.categoria === cat._id).map(t => ({
                        value: t._id,
                        label: t.nome,
                        cor: t.cor,
                        icone: t.icone
                      }));
                      const selectedValues = ((pag.paymentTags && pag.paymentTags[cat._id]) || []).map(tagId => {
                        const tag = allTags.find(t => t._id === tagId);
                    
                        return tag ? {
                          value: tag._id,
                          label: tag.nome,
                          cor: tag.cor,
                          icone: tag.icone
                        } : null;
                      }).filter(Boolean);

                      return (
                        <div key={cat._id} className="tag-category-group">
                          <label>
                            <IconRenderer 
                              nome={cat.icone || 'folder'} 
                              size={20} 
                              cor={cat.cor || '#000'} 
                            />
                            {cat.nome}
                          </label>
                          <Select
                            isMulti
                            options={options}
                            value={selectedValues}
                            onChange={(selected) => {
                              const newPaymentTags = { ...pag.paymentTags };
                              newPaymentTags[cat._id] = selected.map(s => s.value);
                              handlePagamentoChange(index, 'paymentTags', newPaymentTags);
                            }}
                            onKeyDown={(e) => {
                              // Enter seleciona a opção focada
                              if (e.key === 'Enter') {
                                e.stopPropagation(); // Previne submit do form
                                // react-select já trata Enter nativamente
                              }
                              // Tab apenas navega (sem selecionar)
                              // tabSelectsValue={false} garante que não seleciona
                            }}
                            // Configurações otimizadas para navegação por teclado
                            tabIndex={50 + (index * 10) + categorias.indexOf(cat)}
                            blurInputOnSelect={false}
                            closeMenuOnSelect={false}
                            tabSelectsValue={false}
                            openMenuOnFocus={false}
                            backspaceRemovesValue={true}
                            components={{
                              DropdownIndicator: null, // Remove a setinha do dropdown
                              IndicatorSeparator: null // Remove o separador
                            }}
                            styles={{
                              control: (provided) => ({
                                ...provided,
                                border: '1px solid rgba(44, 62, 80, 0.2)',
                                borderRadius: 'var(--borda-radius)',
                                minHeight: '38px',
                                boxShadow: 'none',
                                '&:hover': {
                                  border: '1px solid var(--cor-primaria)'
                                }
                              }),
                              option: (provided, state) => ({
                                ...provided,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: state.data.cor || provided.color,
                                backgroundColor: state.isFocused ? '#f0f0f0' : 'white',
                                '&:hover': {
                                  backgroundColor: '#f0f0f0'
                                }
                              }),
                              multiValue: (provided, state) => ({
                                ...provided,
                                backgroundColor: state.data.cor + '20',
                                borderRadius: '12px',
                                padding: '2px'
                              }),
                              multiValueLabel: (provided, state) => ({
                                ...provided,
                                color: state.data.cor,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }),
                              menu: (provided) => ({
                                ...provided,
                                zIndex: 999
                              }),
                              menuList: (provided) => ({
                                ...provided,
                                maxHeight: '200px'
                              })
                            }}
                            formatOptionLabel={({ label, cor, icone }) => (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <IconRenderer nome={icone || 'tag'} size={20} cor={cor} />
                                <span>{label}</span>
                              </div>
                            )}
                            placeholder="Selecione as tags..."
                            className="tag-select"
                            classNamePrefix="tag-select"
                            isClearable={false}
                            isSearchable={true}
                            menuPlacement="auto"
                            noOptionsMessage={() => "Nenhuma tag encontrada"}
                            loadingMessage={() => "Carregando..."}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <button type="button" onClick={() => removePagamento(index)}>
                    Remover Pagamento
                  </button>
                  <hr />
                </div>
              ))}
              <Tooltip title="Alt + P">
                <button type="button" onClick={addPagamento}>
                  Adicionar Pagamento
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
        <div className="form-buttons">
          <Tooltip title="Ctrl + Enter">
            <button
              type="submit"
              className="submit-btn"
              onClick={(e) => handleSubmit(e, true)}
              tabIndex={91}
            >
              {transacao ? 'Atualizar e Fechar' : 'Salvar e Fechar'}
            </button>
          </Tooltip>
          <Tooltip title="Ctrl + Space">
            <button
              type="button"
              className="submit-btn"
              onClick={(e) => handleSubmit(e, false)}
              tabIndex={92}
            >
              {transacao ? 'Atualizar e Continuar' : 'Salvar e Continuar'}
            </button>
          </Tooltip>
        </div>
      </form>
    </div>
  );
};

export default NovaTransacaoForm;
