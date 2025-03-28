// src/components/Transaction/NovaTransacaoForm.js

import React, { useEffect, useState, useRef } from 'react';
import Select from 'react-select'; // Import do React-Select
import { toast } from 'react-toastify'; // Import do toast do React Toastify
import { Tooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { criarTransacao, atualizarTransacao, obterCategorias, obterTags } from '../../api';
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
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(transacao ? transacao.data.split('T')[0] : '');
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  const [observacao, setObservacao] = useState(transacao ? transacao.observacao : '');
  
  // Pagamentos: usamos paymentTags para manipulação (mapeando p.tags do backend)
  const [pagamentos, setPagamentos] = useState(
    transacao && transacao.pagamentos && transacao.pagamentos.length > 0
      ? transacao.pagamentos.map(p => ({
          ...p,
          paymentTags: p.tags || {}
        }))
      : [{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]
  );
  
  // Categorias e tags (usadas para os dropdowns dos pagamentos)
  const [categorias, setCategorias] = useState([]);
  const [allTags, setAllTags] = useState([]);
  
  // Refs para focar e rolagem
  const tipoRef = useRef(null);
  const descricaoRef = useRef(null);
  const dataRef = useRef(null);
  const valorRef = useRef(null);
  
  // Adicionar estado para controlar a visibilidade do modal de atalhos
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Centraliza o campo em foco
  const handleFocus = (e) => {
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  
  // Carrega categorias e tags do backend
  useEffect(() => {
    async function fetchData() {
      try {
        const cats = await obterCategorias();
        console.log('Categorias carregadas:', cats); // [LOG]
        setCategorias(cats);
        
        const tgs = await obterTags();
        console.log('Tags carregadas:', tgs); // [LOG]
        setAllTags(tgs);
      } catch (error) {
        console.error('Erro ao carregar categorias ou tags:', error);
        toast.error('Erro ao carregar categorias ou tags.');
      }
    }
    fetchData();
    if (!transacao) {
      setData(getTodayBR());
    }
  }, [transacao]);
  
  // Sempre que "transacao" mudar (modo edição), preenche os estados
  useEffect(() => {
    if (transacao) {
      setTipo(transacao.tipo);
      setDescricao(transacao.descricao);
      setData(transacao.data.split('T')[0]);
      setValorTotal(String(transacao.valor));
      if (transacao.pagamentos && transacao.pagamentos.length > 0) {
        // Converte as tags do formato antigo (nome) para o novo formato (_id)
        setPagamentos(
          transacao.pagamentos.map(p => {
            const paymentTags = {};
            // Converte as tags antigas (que usam nome da categoria) para usar _id da categoria
            if (p.tags) {
              Object.entries(p.tags).forEach(([categoriaNome, tagIds]) => {
                const categoria = categorias.find(cat => cat.nome === categoriaNome);
                if (categoria) {
                  paymentTags[categoria._id] = tagIds;
                }
              });
            }
            return {
              ...p,
              paymentTags: paymentTags
            };
          })
        );
      } else {
        setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
      }
    }
  }, [transacao, proprietarioPadrao, categorias]);

  // Estilo customizado para o React-Select
  const customStyles = {
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
      color: state.data.cor || '#000',
      backgroundColor: state.isSelected ? `${state.data.cor}20` : state.isFocused ? '#f0f0f0' : 'white',
      '&:hover': {
        backgroundColor: '#f0f0f0'
      }
    }),
    multiValue: (provided, state) => ({
      ...provided,
      backgroundColor: `${state.data.cor}20`,
      borderRadius: '12px',
      padding: '2px 6px'
    }),
    multiValueLabel: (provided, state) => ({
      ...provided,
      color: state.data.cor,
      fontSize: '0.9em'
    }),
    multiValueRemove: (provided, state) => ({
      ...provided,
      color: state.data.cor,
      '&:hover': {
        backgroundColor: `${state.data.cor}40`,
        color: state.data.cor
      }
    })
  };

  // Função para formatar a opção no Select
  const formatOptionLabel = ({ label, cor, icone }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <i className={`fas fa-${icone || 'tag'}`} style={{ color: cor || '#000' }}></i>
      <span>{label}</span>
    </div>
  );

  // Agrupa as tags por categoria usando o ID da categoria
  const tagsByCategory = {};
  allTags.forEach(tag => {
    console.log('Processando tag:', tag); // [LOG]
    // Usa o ID da categoria diretamente da tag
    const categoriaId = tag.categoria;
    if (categoriaId) {
      if (!tagsByCategory[categoriaId]) {
        tagsByCategory[categoriaId] = [];
      }
      tagsByCategory[categoriaId].push({
        value: tag._id,
        label: tag.nome,
        cor: tag.cor,
        icone: tag.icone,
        categoria: categoriaId
      });
    }
  });
  console.log('Tags agrupadas por categoria:', tagsByCategory); // [LOG]

  // Função para obter as tags selecionadas de um pagamento
  const getSelectedTags = (paymentTags, categoriaId) => {
    console.log('getSelectedTags - paymentTags:', paymentTags, 'categoriaId:', categoriaId); // [LOG]
    if (!paymentTags || !paymentTags[categoriaId]) return [];
    
    const tagIds = paymentTags[categoriaId];
    console.log('getSelectedTags - tagIds:', tagIds); // [LOG]
    return tagIds.map(tagId => {
      const tag = allTags.find(t => t._id === tagId);
      console.log('getSelectedTags - tag encontrada:', tag); // [LOG]
      if (!tag) return null;
      return {
        value: tag._id,
        label: tag.nome,
        cor: tag.cor,
        icone: tag.icone,
        categoria: tag.categoria
      };
    }).filter(Boolean);
  };

  // Inicializa os pagamentos após carregar categorias e tags
  useEffect(() => {
    if (categorias.length > 0 && allTags.length > 0 && transacao) {
      const pagamentosIniciais = transacao.pagamentos.map(p => {
        const paymentTags = {};
        // Converte as tags antigas (que usam nome da categoria) para usar _id da categoria
        if (p.tags) {
          Object.entries(p.tags).forEach(([categoriaNome, tagIds]) => {
            const categoria = categorias.find(cat => 
              cat.nome === categoriaNome || cat._id === categoriaNome
            );
            if (categoria) {
              paymentTags[categoria._id] = tagIds;
            }
          });
        }
        return {
          pessoa: p.pessoa,
          valor: p.valor,
          paymentTags: paymentTags
        };
      });

      setPagamentos(pagamentosIniciais);
    } else if (!transacao) {
      setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
    }
  }, [transacao, categorias, allTags, proprietarioPadrao]);

  // Manipulação dos pagamentos
  const handlePagamentoChange = (index, field, value) => {
    const novosPagamentos = [...pagamentos];
    novosPagamentos[index][field] = value;
    setPagamentos(novosPagamentos);
  };
  
  const addPagamento = () => {
    setPagamentos([...pagamentos, { pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
  };
  
  const removePagamento = (index) => {
    const novosPagamentos = pagamentos.filter((_, i) => i !== index);
    setPagamentos(novosPagamentos);
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
  
  // Atalho: Esc para fechar o modal
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  
  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      // CTRL + ESPAÇO para salvar e continuar
      if (e.ctrlKey && e.keyCode === 32) {
        e.preventDefault();
        handleSubmit(new Event('submit'), false);
      }
      
      // CTRL + ENTER para salvar e fechar
      if (e.ctrlKey && e.keyCode === 13) {
        e.preventDefault();
        handleSubmit(new Event('submit'), true);
      }

      // ALT + H para definir data como hoje
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setHoje();
      }

      // ALT + Y para definir data como ontem
      if (e.altKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setOntem();
      }

      // ALT + P para adicionar novo pagamento
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        addPagamento();
      }

      // ALT + R para remover último pagamento
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (pagamentos.length > 1) { // Mantém pelo menos um pagamento
          removePagamento(pagamentos.length - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tipo, descricao, data, valorTotal, observacao, pagamentos]); // Dependências necessárias para o handleSubmit
  
  const setHoje = () => {
    setData(getTodayBR());
  };

  const setOntem = () => {
    setData(getYesterdayBR());
  };

  const handleSubmit = async (e, closeModal = true) => {
    e.preventDefault();
    
    // Validar campos obrigatórios
    if (!descricao.trim()) {
      toast.warn('A descrição é obrigatória.');
      return;
    }
    
    if (!valorTotal || isNaN(parseFloat(valorTotal)) || parseFloat(valorTotal) <= 0) {
      toast.warn('Informe um valor total válido.');
      return;
    }
    
    // Validar pagamentos
    const pagamentosValidos = pagamentos.every(p => p.pessoa.trim() && !isNaN(parseFloat(p.valor)) && parseFloat(p.valor) > 0);
    if (!pagamentosValidos) {
      toast.warn('Todos os pagamentos devem ter pessoa e valor válido.');
      return;
    }
    
    if (!validatePagamentos()) {
      toast.warn('A soma dos pagamentos deve ser igual ao valor total.');
      return;
    }
    
    // Monta o objeto para envio ao backend
    const transacaoData = {
      tipo,
      descricao,
      data: toISOStringBR(data),
      valor: Number(parseFloat(valorTotal).toFixed(2)),
      observacao,
      pagamentos: pagamentos.map((pag) => {
        // Mantém os IDs das tags como estão para enviar ao backend
        return {
          pessoa: pag.pessoa,
          valor: Number(parseFloat(pag.valor).toFixed(2)),
          tags: pag.paymentTags // Já está no formato correto com IDs
        };
      })
    };
    try {
      if (transacao && transacao.id) {
        await atualizarTransacao(transacao.id, transacaoData);
        toast.success('Transação atualizada com sucesso!');
      } else {
        await criarTransacao(transacaoData);
        toast.success('Transação criada com sucesso!');
      }
      
      // Chama onSuccess apenas se vai fechar o modal
      if (closeModal) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        // Se for "Salvar e Continuar", limpa os campos
        setTipo('gasto');
        setDescricao('');
        setData(getTodayBR());
        setValorTotal('');
        setObservacao('');
        setPagamentos([{ pessoa: proprietarioPadrao || '', valor: '', paymentTags: {} }]);
        
        // Foca no campo de descrição após limpar
        setTimeout(() => {
          if (descricaoRef.current) {
            descricaoRef.current.focus();
          }
        }, 100);
      }
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      toast.error('Erro ao salvar transação.');
    }
  };
  
  // Foca no campo de tipo quando o componente é montado
  useEffect(() => {
    if (tipoRef.current) {
      tipoRef.current.focus();
    }
  }, []);

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
                onFocus={handleFocus}
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
                onFocus={handleFocus}
                ref={descricaoRef}
              />
            </div>
            <div className="form-section">
              <label>Data:</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                required
                onFocus={handleFocus}
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
                onFocus={handleFocus}
                ref={valorRef}
              />
            </div>
            <div className="form-section">
              <label>Observação:</label>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                rows="3"
                placeholder="Adicione uma observação (opcional)"
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
                      onFocus={handleFocus}
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
                      onFocus={handleFocus}
                    />
                  </div>

                  {/* Tags por Categoria */}
                  <div className="tags-section">
                    <h4>Tags para Pagamento</h4>
                    {categorias.map((cat) => {
                      console.log('Renderizando categoria:', cat, 'Tags disponíveis:', tagsByCategory[cat._id]); // [LOG]
                      return (
                        <div key={cat._id} className="tag-category-group">
                          <label>
                            <i 
                              className={`fas fa-${cat.icone || 'folder'}`} 
                              style={{ color: cat.cor || '#000' }}
                            ></i>
                            {cat.nome} {/* Nome apenas para exibição */}
                          </label>
                          <Select
                            isMulti
                            options={tagsByCategory[cat._id] || []}
                            value={getSelectedTags(pag.paymentTags, cat._id)}
                            onChange={(selected) => {
                              console.log('Select onChange - selected:', selected); // [LOG]
                              const newPaymentTags = { ...pag.paymentTags };
                              newPaymentTags[cat._id] = selected ? selected.map(s => s.value) : [];
                              handlePagamentoChange(index, 'paymentTags', newPaymentTags);
                            }}
                            styles={customStyles}
                            formatOptionLabel={formatOptionLabel}
                            placeholder="Selecione as tags..."
                            className="tag-select"
                            classNamePrefix="tag-select"
                            isClearable={true}
                            isSearchable={true}
                            closeMenuOnSelect={false}
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
            >
              {transacao ? 'Atualizar e Fechar' : 'Salvar e Fechar'}
            </button>
          </Tooltip>
          <Tooltip title="Ctrl + Space">
            <button
              type="button"
              className="submit-btn"
              onClick={(e) => handleSubmit(e, false)}
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
