// src/components/Transaction/NovaTransacaoForm.js
import React, { useEffect, useState, useRef } from 'react';
import { criarTransacao, atualizarTransacao, obterCategorias, obterTags } from '../../api';
import './NovaTransacaoForm.css';

const NovaTransacaoForm = ({ onSuccess, onClose, transacao }) => {
  // Estados dos dados gerais
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(transacao ? transacao.data.split('T')[0] : '');
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  
  const descricaoSuggestions = ['Compra de pizza', 'Pagamento de conta', 'Arbitragem'];
  
  // Pagamentos: no estado, usamos "paymentTags" para manipular tags,
  // mas no backend a propriedade salva em cada pagamento costuma ser "tags".
  const [pagamentos, setPagamentos] = useState(
    transacao && transacao.pagamentos && transacao.pagamentos.length > 0
      ? transacao.pagamentos.map(p => ({
          ...p,
          // Mapeamos p.tags para paymentTags
          paymentTags: p.tags || {}
        }))
      : [{ pessoa: '', valor: '', paymentTags: {} }]
  );

  const pessoaSuggestions = ['Eu', 'Alisson', 'Emerson'];

  // Categorias e tags do backend (usadas para popular os selects de pagamento)
  const [categorias, setCategorias] = useState([]);
  const [allTags, setAllTags] = useState([]);

  // Refs para dar foco e scroll
  const descricaoRef = useRef(null);
  const dataRef = useRef(null);
  const valorRef = useRef(null);

  // Centraliza o campo em foco ao clicar
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
      }
    }
    fetchData();

    // Se for nova transação (sem "transacao"), define a data de hoje por padrão
    if (!transacao) {
      const hoje = new Date().toISOString().split('T')[0];
      setData(hoje);
    }
  }, [transacao]);

  // Sempre que "transacao" mudar (edição), pré-carregamos tudo:
  useEffect(() => {
    if (transacao) {
      setTipo(transacao.tipo);
      setDescricao(transacao.descricao);
      setData(transacao.data.split('T')[0]);
      setValorTotal(String(transacao.valor));

      // Mapeamos pag.tags -> pag.paymentTags
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

  // Agrupa as tags do backend por categoria (para popular o <select multiple> de pagamento)
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
  
  const handlePagamentoTagChange = (index, categoria, selectedOptions) => {
    const novosPagamentos = [...pagamentos];
    if (!novosPagamentos[index].paymentTags) {
      novosPagamentos[index].paymentTags = {};
    }
    novosPagamentos[index].paymentTags[categoria] = selectedOptions;
    setPagamentos(novosPagamentos);
  };

  const addPagamento = () => {
    setPagamentos([...pagamentos, { pessoa: '', valor: '', paymentTags: {} }]);
  };
  
  const removePagamento = (index) => {
    const novosPagamentos = pagamentos.filter((_, i) => i !== index);
    setPagamentos(novosPagamentos);
  };
  
  // Se houver apenas 1 pagamento, replicar o valor total automaticamente
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
  
  // Atalho Ctrl+S para salvar
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
  
  // Atalho Esc para fechar
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
      alert('A soma dos pagamentos deve ser igual ao valor total.');
      return;
    }

    // Monta o objeto para envio ao backend
    const transacaoData = {
      tipo,
      descricao,
      data: new Date(data).toISOString(), // Formato ISO
      valor: Number(parseFloat(valorTotal).toFixed(2)),
      // Não enviamos tags "pai" (removidas)
      pagamentos: pagamentos.map((pag) => ({
        pessoa: pag.pessoa,
        valor: Number(parseFloat(pag.valor).toFixed(2)),
        // "paymentTags" => "tags" no backend
        tags: pag.paymentTags || {}
      }))
    };

    try {
      if (transacao && transacao.id) {
        // Atualizar
        await atualizarTransacao(transacao.id, transacaoData);
        alert('Transação atualizada com sucesso!');
      } else {
        // Criar
        await criarTransacao(transacaoData);
        alert('Transação criada com sucesso!');
      }

      if (onSuccess) onSuccess();
      if (closeModal) {
        onClose();
      } else {
        // Se for "Salvar e Continuar", limpa o formulário
        setTipo('gasto');
        setDescricao('');
        const hoje = new Date().toISOString().split('T')[0];
        setData(hoje);
        setValorTotal('');
        setPagamentos([{ pessoa: '', valor: '', paymentTags: {} }]);
      }
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      alert('Erro ao salvar transação.');
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
                  <div className="form-section payment-tags">
                    <h4>Tags para Pagamento</h4>
                    {categorias.map(cat => (
                      <div key={cat._id} className="tag-dropdown-group">
                        <label>{cat.nome}:</label>
                        <select
                          multiple
                          // Se paymentTags[cat.nome] existir, já vem selecionado
                          value={(pag.paymentTags && pag.paymentTags[cat.nome]) || []}
                          onChange={e => {
                            const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                            const novos = [...pagamentos];
                            if (!novos[index].paymentTags) {
                              novos[index].paymentTags = {};
                            }
                            novos[index].paymentTags[cat.nome] = selected;
                            setPagamentos(novos);
                          }}
                          onFocus={handleFocus}
                        >
                          {(tagsPorCategoria[cat.nome] || []).map((tagName, idx) => (
                            <option key={idx} value={tagName}>
                              {tagName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
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
