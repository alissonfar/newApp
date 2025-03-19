import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { Tooltip } from '@mui/material';
import { obterCategorias, obterTags } from '../../api';
import { getTodayBR, getYesterdayBR, toISOStringBR } from '../../utils/dateUtils';
import { toast } from 'react-toastify';
import './NovaTransacaoForm.css';
import './EditarTransacaoItem.css';

const EditarTransacaoItem = ({ 
  transacao, 
  onSave, 
  onClose, 
  index 
}) => {
  // Estados dos dados gerais
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(transacao ? (transacao.data.includes('T') ? transacao.data.split('T')[0] : transacao.data) : '');
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  const [observacao, setObservacao] = useState(transacao ? transacao.observacao : '');
  
  // Pagamentos: mapeamento das tags para formato compatível
  const [pagamentos, setPagamentos] = useState(
    transacao && transacao.pagamentos && transacao.pagamentos.length > 0
      ? transacao.pagamentos.map(p => ({
          ...p,
          paymentTags: p.tags || {}
        }))
      : [{ pessoa: '', valor: '', paymentTags: {} }]
  );
  
  // Categorias e tags (usadas para os dropdowns dos pagamentos)
  const [categorias, setCategorias] = useState([]);
  const [allTags, setAllTags] = useState([]);
  
  // Refs para focar
  const descricaoRef = useRef(null);
  
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
  }, []);
  
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
  
  const setHoje = () => {
    setData(getTodayBR());
  };

  const setOntem = () => {
    setData(getYesterdayBR());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Valida os dados antes de salvar
    if (!descricao.trim() || 
        !valorTotal || 
        isNaN(parseFloat(valorTotal)) || 
        parseFloat(valorTotal) <= 0 ||
        !data) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return false;
    }
    
    // Validar pagamentos
    const pagamentosValidos = pagamentos.every(p => 
      p.pessoa.trim() && 
      !isNaN(parseFloat(p.valor)) && 
      parseFloat(p.valor) > 0
    );
    
    if (!pagamentosValidos || !validatePagamentos()) {
      toast.error('Por favor, verifique os valores dos pagamentos.');
      return false;
    }
    
    // Monta o objeto para envio
    const transacaoAtualizada = {
      tipo,
      descricao,
      data: data.includes('T') ? data : toISOStringBR(data),
      valor: Number(parseFloat(valorTotal).toFixed(2)),
      observacao,
      pagamentos: pagamentos.map((pag) => ({
        pessoa: pag.pessoa,
        valor: Number(parseFloat(pag.valor).toFixed(2)),
        tags: pag.paymentTags || {}
      })),
      // Mantém outros campos importantes que a transação já tinha
      identificador: transacao.identificador || `import-${Date.now()}-${index}`,
      dataImportacao: transacao.dataImportacao || new Date().toISOString(),
      usuario: transacao.usuario
    };
    
    try {
      // Passa a transação atualizada para o componente pai
      onSave(index, transacaoAtualizada);
      return true;
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      toast.error('Erro ao salvar transação.');
      return false;
    }
  };
  
  return (
    <div className="editar-transacao-item">
      <div className="transacao-numero">
        <span className="transacao-badge">Transação #{index + 1}</span>
      </div>
      
      <form className="nova-transacao-form-container" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="left-column">
            <div className="form-section">
              <label>Tipo:</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                required
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
              />
            </div>
            <div className="form-section">
              <label>Data:</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                required
              />
              <div className="date-shortcuts">
                <Tooltip title="Define como hoje">
                  <button type="button" onClick={setHoje}>Hoje</button>
                </Tooltip>
                <Tooltip title="Define como ontem">
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
              {pagamentos.map((pag, idx) => (
                <div key={idx} className="pagamento-item">
                  <div className="form-section">
                    <label>Pessoa:</label>
                    <input
                      type="text"
                      value={pag.pessoa}
                      onChange={e => handlePagamentoChange(idx, 'pessoa', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-section">
                    <label>Valor:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={pag.valor}
                      onChange={e => handlePagamentoChange(idx, 'valor', e.target.value)}
                      required
                    />
                  </div>

                  {/* Seletor de tags */}
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
                              if (!novos[idx].paymentTags) {
                                novos[idx].paymentTags = {};
                              }
                              novos[idx].paymentTags[cat.nome] = selectedTags;
                              setPagamentos(novos);
                            }}
                            classNamePrefix="mySelect"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <button 
                    type="button" 
                    onClick={() => removePagamento(idx)}
                    className="remove-btn"
                    disabled={pagamentos.length <= 1}
                  >
                    Remover Pagamento
                  </button>
                  <hr />
                </div>
              ))}
              <button type="button" onClick={addPagamento} className="add-btn">
                Adicionar Pagamento
              </button>
            </div>
          </div>
        </div>
        <div className="item-buttons">
          <button
            type="submit"
            className="save-btn"
          >
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditarTransacaoItem; 