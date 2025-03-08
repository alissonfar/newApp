// src/components/Transaction/NovaTransacaoForm.js

import React, { useEffect, useState, useRef } from 'react';
import Select from 'react-select'; // Import do React-Select
import { toast } from 'react-toastify'; // Import do toast do React Toastify
import { criarTransacao, atualizarTransacao, obterCategorias, obterTags } from '../../api';
import './NovaTransacaoForm.css';

const NovaTransacaoForm = ({ onSuccess, onClose, transacao }) => {
  // Estados dos dados gerais
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(transacao ? transacao.data.split('T')[0] : '');
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  const [observacao, setObservacao] = useState(transacao ? transacao.observacao : '');
  
  const descricaoSuggestions = ['Compra de pizza', 'Pagamento de conta', 'Arbitragem'];
  
  // Pagamentos: usamos paymentTags para manipulação (mapeando p.tags do backend)
  const [pagamentos, setPagamentos] = useState(
    transacao && transacao.pagamentos && transacao.pagamentos.length > 0
      ? transacao.pagamentos.map(p => ({
          ...p,
          paymentTags: p.tags || {}
        }))
      : [{ pessoa: '', valor: '', paymentTags: {} }]
  );
  const pessoaSuggestions = ['Eu', 'Alisson', 'Emerson'];
  
  // Categorias e tags (usadas para os dropdowns dos pagamentos)
  const [categorias, setCategorias] = useState([]);
  const [allTags, setAllTags] = useState([]);
  
  // Refs para focar e rolagem
  const descricaoRef = useRef(null);
  const dataRef = useRef(null);
  const valorRef = useRef(null);
  
  // Centraliza o campo em foco
  const handleFocus = (e) => {
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  
  // Carrega categorias e tags do backend
  useEffect(() => {
    async function fetchData() {
      try {
        const cats = await obterCategorias();
        setCategorias(cats);
        const tgs = await obterTags();
        setAllTags(tgs);
      } catch (error) {
        console.error('Erro ao carregar categorias ou tags:', error);
        toast.error('Erro ao carregar categorias ou tags.');
      }
    }
    fetchData();
    if (!transacao) {
      const hoje = new Date().toISOString().split('T')[0];
      setData(hoje);
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
        setPagamentos(
          transacao.pagamentos.map(p => ({
            ...p,
            paymentTags: p.tags || {}
          }))
        );
      } else {
        setPagamentos([{ pessoa: '', valor: '', paymentTags: {} }]);
      }
    }
  }, [transacao]);

  // Agrupa as tags do backend por categoria para popular o React-Select
  const tagsPorCategoria = allTags.reduce((acc, tag) => {
    if (tag.categoria) {
      if (!acc[tag.categoria]) {
        acc[tag.categoria] = [];
      }
      acc[tag.categoria].push(tag.nome);
    }
    return acc;
  }, {});
  
  // Manipulação dos pagamentos
  const handlePagamentoChange = (index, field, value) => {
    const novosPagamentos = [...pagamentos];
    novosPagamentos[index][field] = value;
    setPagamentos(novosPagamentos);
  };
  
  const addPagamento = () => {
    setPagamentos([...pagamentos, { pessoa: '', valor: '', paymentTags: {} }]);
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
  
  // Atalho: Ctrl+S para salvar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSubmit(e, false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
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
  
  const setHoje = () => {
    const hoje = new Date().toISOString().split('T')[0];
    setData(hoje);
  };

  const setOntem = () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    setData(ontem);
  };

  const handleSubmit = async (e, closeModal = true) => {
    e.preventDefault();
    if (!validatePagamentos()) {
      toast.warn('A soma dos pagamentos deve ser igual ao valor total.');
      return;
    }
    // Monta o objeto para envio ao backend
    const transacaoData = {
      tipo,
      descricao,
      data: new Date(data).toISOString(),
      valor: Number(parseFloat(valorTotal).toFixed(2)),
      observacao,
      pagamentos: pagamentos.map((pag) => ({
        pessoa: pag.pessoa,
        valor: Number(parseFloat(pag.valor).toFixed(2)),
        tags: pag.paymentTags || {}
      }))
    };
    try {
      if (transacao && transacao.id) {
        await atualizarTransacao(transacao.id, transacaoData);
        toast.success('Transação atualizada com sucesso!');
      } else {
        await criarTransacao(transacaoData);
        toast.success('Transação criada com sucesso!');
      }
      if (onSuccess) onSuccess();
      if (closeModal) {
        onClose();
      } else {
        // Se for "Salvar e Continuar", limpa os campos
        setTipo('gasto');
        setDescricao('');
        const hoje = new Date().toISOString().split('T')[0];
        setData(hoje);
        setValorTotal('');
        setPagamentos([{ pessoa: '', valor: '', paymentTags: {} }]);
      }
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      toast.error('Erro ao salvar transação.');
    }
  };
  

  return (
    <div className="nova-transacao-form-container">
      <h2>{transacao ? 'Editar Transação' : 'Nova Transação'}</h2>
      <form onSubmit={(e) => handleSubmit(e, true)}>
        <div className="form-grid">
          <div className="left-column">
            <div className="form-section">
              <label>Tipo:</label>
              <select
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
                list="descricao-suggestions"
                onFocus={handleFocus}
                ref={descricaoRef}
              />
              <datalist id="descricao-suggestions">
                {descricaoSuggestions.map((sug, idx) => (
                  <option key={idx} value={sug} />
                ))}
              </datalist>
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
                <button type="button" onClick={setHoje}>Hoje</button>
                <button type="button" onClick={setOntem}>Ontem</button>
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
                      list="pessoa-suggestions"
                      onFocus={handleFocus}
                    />
                    <datalist id="pessoa-suggestions">
                      {pessoaSuggestions.map((sug, idx) => (
                        <option key={idx} value={sug} />
                      ))}
                    </datalist>
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

                  {/* Substituição do <select multiple> por React-Select para tags */}
                  <div className="form-section payment-tags">
                    <h4>Tags para Pagamento</h4>
                    {categorias.map((cat) => {
                      // Cria as opções no formato { value, label }
                      const options = (tagsPorCategoria[cat.nome] || []).map(tagName => ({
                        value: tagName,
                        label: tagName
                      }));
                      // Prepara os valores já selecionados
                      const selectedValues = ((pag.paymentTags && pag.paymentTags[cat.nome]) || [])
                        .map(tag => ({ value: tag, label: tag }));
                      return (
                        <div key={cat._id} className="tag-dropdown-group">
                          <label>{cat.nome}:</label>
                          <Select
                            isMulti
                            options={options}
                            value={selectedValues}
                            onChange={(selectedOptions) => {
                              const selectedTags = selectedOptions
                                ? selectedOptions.map(opt => opt.value)
                                : [];
                              const novos = [...pagamentos];
                              if (!novos[index].paymentTags) {
                                novos[index].paymentTags = {};
                              }
                              novos[index].paymentTags[cat.nome] = selectedTags;
                              setPagamentos(novos);
                            }}
                            classNamePrefix="mySelect"
                            onFocus={handleFocus}
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
              <button type="button" onClick={addPagamento}>
                Adicionar Pagamento
              </button>
            </div>
          </div>
        </div>
        <div className="form-buttons">
          <button
            type="submit"
            className="submit-btn"
            onClick={(e) => handleSubmit(e, true)}
          >
            {transacao ? 'Atualizar e Fechar' : 'Salvar e Fechar'}
          </button>
          <button
            type="button"
            className="submit-btn"
            onClick={(e) => handleSubmit(e, false)}
          >
            {transacao ? 'Atualizar e Continuar' : 'Salvar e Continuar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NovaTransacaoForm;
