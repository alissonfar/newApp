import React, { useState, useEffect, useCallback } from 'react';
import { obterCategorias, obterTags } from '../../api';
import { getTodayBR, getYesterdayBR, toISOStringBR } from '../../utils/dateUtils';
import { toast } from 'react-toastify';
import TagSelector from './TagSelector';
import DateFieldWithShortcuts from './DateFieldWithShortcuts';
import EmprestimoSecao from '../Emprestimos/EmprestimoSecao';
import useEmprestimoForm from '../../hooks/useEmprestimoForm';
import './NovaTransacaoForm.css';
import './EditarTransacaoItem.css';

const EditarTransacaoItem = ({ transacao, onSave, onClose, index }) => {
  const [tipo, setTipo] = useState(transacao ? transacao.tipo : 'gasto');
  const [descricao, setDescricao] = useState(transacao ? transacao.descricao : '');
  const [data, setData] = useState(transacao ? (transacao.data.includes('T') ? transacao.data.split('T')[0] : transacao.data) : '');
  const [valorTotal, setValorTotal] = useState(transacao ? String(transacao.valor) : '');
  const [observacao, setObservacao] = useState(transacao ? transacao.observacao : '');

  const [pagamentos, setPagamentos] = useState(
    transacao?.pagamentos?.length > 0
      ? transacao.pagamentos.map(p => ({ ...p, paymentTags: p.tags || {} }))
      : [{ pessoa: '', valor: '', paymentTags: {} }]
  );

  const [categorias, setCategorias] = useState([]);
  const [allTags, setAllTags] = useState([]);

  const emprestimoForm = useEmprestimoForm({
    transacao,
    tipoTransacao: tipo,
    valorTotal: parseFloat(valorTotal) || 0
  });

  useEffect(() => {
    (async () => {
      try {
        const [cats, tgs] = await Promise.all([obterCategorias(), obterTags()]);
        setCategorias(cats);
        setAllTags(tgs);
      } catch (error) {
        console.error('Erro ao carregar categorias ou tags:', error);
      }
    })();
  }, []);

  const handlePagamentoChange = useCallback((indexP, field, value) => {
    setPagamentos(prev => {
      const novos = [...prev];
      novos[indexP] = { ...novos[indexP], [field]: value };
      return novos;
    });
  }, []);

  const addPagamento = useCallback(() => {
    setPagamentos(prev => [...prev, { pessoa: '', valor: '', paymentTags: {} }]);
  }, []);

  const removePagamento = useCallback((idx) => {
    setPagamentos(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleValorTotalChange = useCallback((e) => {
    const raw = e.target.value;
    setValorTotal(raw);
    setPagamentos(prev => {
      if (prev.length !== 1) return prev;
      const novos = [...prev];
      novos[0] = { ...novos[0], valor: raw };
      return novos;
    });
  }, []);

  const validatePagamentos = useCallback(() => {
    const soma = pagamentos.reduce((acc, pag) => {
      const v = parseFloat(pag.valor || 0);
      return acc + (isNaN(v) ? 0 : v);
    }, 0);
    return parseFloat(valorTotal || 0) === soma;
  }, [pagamentos, valorTotal]);

  const consolidarEmprestimo = useCallback(() => {
    const st = emprestimoForm.state;
    if (!st.ativo) {
      return { emprestimoId: null, emprestimoConfig: null };
    }
    if (st.modo === 'vincular') {
      return {
        emprestimoId: st.emprestimoId || null,
        emprestimoConfig: null
      };
    }
    return {
      emprestimoId: null,
      emprestimoConfig: {
        criarEmprestimo: true,
        pessoaId: st.pessoaId || null,
        pessoaNomeSnapshot: st.pessoas?.find((p) => p._id === st.pessoaId)?.nome || null,
        valorEsperadoRetorno: st.novoValorEsperado !== '' && st.novoValorEsperado != null
          ? Number(st.novoValorEsperado)
          : null,
        tipoRetorno: st.novoTipoRetorno,
        prazoFinal: st.novoPrazoFinal || null,
        observacao: null,
        empEmprestimoIdExistente: null
      }
    };
  }, [emprestimoForm]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (!descricao.trim() || !valorTotal || isNaN(parseFloat(valorTotal)) || parseFloat(valorTotal) <= 0 || !data) {
      toast.error('Por favor, preencha todos os campos obrigatorios.');
      return false;
    }

    const pagamentosValidos = pagamentos.every(p =>
      p.pessoa.trim() && !isNaN(parseFloat(p.valor)) && parseFloat(p.valor) > 0
    );

    if (!pagamentosValidos || !validatePagamentos()) {
      toast.error('Por favor, verifique os valores dos pagamentos.');
      return false;
    }

    const empError = emprestimoForm.validar();
    if (empError) {
      toast.error(empError);
      return false;
    }

    const { emprestimoId, emprestimoConfig } = consolidarEmprestimo();

    const transacaoAtualizada = {
      tipo,
      descricao,
      data: data.includes('T') ? data : toISOStringBR(data),
      valor: Number(parseFloat(valorTotal).toFixed(2)),
      observacao,
      pagamentos: pagamentos.map(p => ({
        pessoa: p.pessoa,
        valor: Number(parseFloat(p.valor).toFixed(2)),
        tags: p.paymentTags || {}
      })),
      identificador: transacao.identificador || `import-${Date.now()}-${index}`,
      dataImportacao: transacao.dataImportacao || new Date().toISOString(),
      usuario: transacao.usuario,
      emprestimoId,
      emprestimoConfig
    };

    onSave(index, transacaoAtualizada);
    return true;
  }, [tipo, descricao, data, valorTotal, observacao, pagamentos, transacao, index, onSave, validatePagamentos, emprestimoForm, consolidarEmprestimo]);

  const setHoje = useCallback(() => setData(getTodayBR()), []);
  const setOntem = useCallback(() => setData(getYesterdayBR()), []);

  return (
    <div className="editar-transacao-item">
      <div className="transacao-numero">
        <span className="transacao-badge">Transacao #{index + 1}</span>
      </div>

      <form className="nova-transacao-form-container" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="left-column">
            <div className="edit-item-form-section">
              <label>Tipo:</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} required>
                <option value="gasto">Gasto</option>
                <option value="recebivel">Recebivel</option>
              </select>
            </div>
            <div className="edit-item-form-section">
              <label>Descricao:</label>
              <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)} required />
            </div>
            <DateFieldWithShortcuts value={data} onChange={setData} onToday={setHoje} onYesterday={setOntem} />
            <div className="edit-item-form-section">
              <label>Valor Total:</label>
              <input type="number" step="0.01" min="0" value={valorTotal} onChange={handleValorTotalChange} required />
            </div>
            <div className="edit-item-form-section">
              <label>Observacao:</label>
              <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="right-column">
            <div className="edit-item-form-section payment-section">
              <h3>Pagamentos</h3>
              {pagamentos.map((pag, idx) => (
                <div key={idx} className="payment-item">
                  <div className="payment-header">
                    <h4>Pagamento {idx + 1}</h4>
                    {pagamentos.length > 1 && (
                      <button type="button" onClick={() => removePagamento(idx)} className="remove-payment">Remover</button>
                    )}
                  </div>
                  <div className="payment-fields">
                    <div className="edit-item-form-section">
                      <label>Pessoa:</label>
                      <input type="text" value={pag.pessoa} onChange={e => handlePagamentoChange(idx, 'pessoa', e.target.value)} required />
                    </div>
                    <div className="edit-item-form-section">
                      <label>Valor:</label>
                      <input type="number" step="0.01" min="0" value={pag.valor} onChange={e => handlePagamentoChange(idx, 'valor', e.target.value)} required />
                    </div>
                  </div>
                  <TagSelector
                    categorias={categorias}
                    allTags={allTags}
                    paymentTags={pag.paymentTags}
                    onTagsChange={(newTags) => handlePagamentoChange(idx, 'paymentTags', newTags)}
                  />
                </div>
              ))}
              <button type="button" onClick={addPagamento} className="add-payment">Adicionar Pagamento</button>
            </div>

            <EmprestimoSecao form={emprestimoForm} valorTotal={parseFloat(valorTotal) || 0} />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit">Salvar</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </div>
  );
};

export default EditarTransacaoItem;
