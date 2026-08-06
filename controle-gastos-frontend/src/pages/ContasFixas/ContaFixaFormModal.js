import React, { useState } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import { useData } from '../../context/DataContext';
import TagSelector from '../../components/Transaction/TagSelector';
import Button from '../../components/shared/Button';
import '../../components/Transaction/NovaTransacaoForm.css';
import '../../components/Transaction/TransacaoTabs.css';

const valorPadraoPagamento = () => ({ pessoa: '', percentual: 100, tagsOverride: null });

const ContaFixaFormModal = ({ contaFixa, onSave, onClose }) => {
  const { categorias, tags } = useData();
  const [form, setForm] = useState(() => contaFixa || {
    nome: '',
    tipo: 'gasto',
    valorEsperado: '',
    diaLancamento: 1,
    diaVencimento: 1,
    vencimentoMesSeguinte: false,
    modo: 'automatico',
    tagsPadrao: {},
    pagamentosTemplate: [valorPadraoPagamento()],
    dataFim: '',
    totalRepeticoes: ''
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const somaPercentual = form.pagamentosTemplate.reduce((acc, p) => acc + Number(p.percentual || 0), 0);
  const somaOk = Math.abs(somaPercentual - 100) < 0.01;

  const atualizarPagamento = (index, campo, valor) => {
    const novos = [...form.pagamentosTemplate];
    novos[index] = { ...novos[index], [campo]: valor };
    setForm({ ...form, pagamentosTemplate: novos });
  };

  const adicionarPagamento = () => {
    setForm({ ...form, pagamentosTemplate: [...form.pagamentosTemplate, valorPadraoPagamento()] });
  };

  const removerPagamento = (index) => {
    setForm({ ...form, pagamentosTemplate: form.pagamentosTemplate.filter((_, i) => i !== index) });
  };

  const handleSalvar = async () => {
    if (!somaOk) {
      setErro('A soma dos percentuais de divisão deve ser 100%.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await onSave({
        ...form,
        valorEsperado: Number(form.valorEsperado),
        diaLancamento: Number(form.diaLancamento),
        diaVencimento: Number(form.diaVencimento),
        totalRepeticoes: form.totalRepeticoes ? Number(form.totalRepeticoes) : null,
        dataFim: form.dataFim || null
      });
    } catch (err) {
      setErro(err.message || 'Erro ao salvar conta fixa.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalTransacao onClose={onClose}>
      <h2 className="nova-transacao-form-title">{contaFixa ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}</h2>

      <div className="transacao-tab-content">
      {erro && <p className="error-message">{erro}</p>}

      <div className="form-grid">
        <div className="form-section">
          <label>Nome</label>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </div>

        <div className="form-section">
          <label>Tipo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option value="gasto">Despesa</option>
            <option value="recebivel">Receita</option>
          </select>
        </div>

        <div className="form-section">
          <label>Valor esperado</label>
          <input
            type="number"
            step="0.01"
            value={form.valorEsperado}
            onChange={(e) => setForm({ ...form, valorEsperado: e.target.value })}
          />
        </div>

        <div className="form-section">
          <label>Modo</label>
          <select value={form.modo} onChange={(e) => setForm({ ...form, modo: e.target.value })}>
            <option value="automatico">Automático (lança sozinho)</option>
            <option value="confirmacao">Confirmação manual</option>
          </select>
        </div>

        <div className="form-section">
          <label>Dia de lançamento</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.diaLancamento}
            onChange={(e) => setForm({ ...form, diaLancamento: e.target.value })}
          />
        </div>

        <div className="form-section">
          <label>Dia de vencimento</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.diaVencimento}
            onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })}
          />
        </div>

        <div className="form-section">
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 0, cursor: 'pointer' }}>
            <input
              type="checkbox"
              style={{ width: 'auto', marginBottom: 0 }}
              checked={form.vencimentoMesSeguinte}
              onChange={(e) => setForm({ ...form, vencimentoMesSeguinte: e.target.checked })}
            />
            Vencimento cai no mês seguinte
          </label>
        </div>

        <div className="form-section">
          <label>Data fim (opcional)</label>
          <input type="date" value={form.dataFim || ''} onChange={(e) => setForm({ ...form, dataFim: e.target.value })} />
        </div>

        <div className="form-section">
          <label>Total de repetições (opcional)</label>
          <input
            type="number"
            min="1"
            value={form.totalRepeticoes || ''}
            onChange={(e) => setForm({ ...form, totalRepeticoes: e.target.value })}
          />
        </div>

        <div className="form-section pagamentos-section">
          <div className="pagamentos-header">
            <h3>Divisão de pagamento</h3>
            <span className={somaOk ? 'resumo-ok' : 'resumo-diff'}>Soma atual: {somaPercentual}%</span>
          </div>

          {form.pagamentosTemplate.map((p, index) => (
            <div className="pagamento-item" key={index}>
              <div className="pagamento-item-header">
                <span className="pagamento-numero">Pagamento {index + 1}</span>
                {form.pagamentosTemplate.length > 1 && (
                  <div className="pagamento-item-actions">
                    <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => removerPagamento(index)}>
                      <FaTrash /> Remover
                    </button>
                  </div>
                )}
              </div>
              <div className="pagamento-campos-principais">
                <div className="form-section pagamento-field-pessoa">
                  <label>Pessoa</label>
                  <input value={p.pessoa} onChange={(e) => atualizarPagamento(index, 'pessoa', e.target.value)} />
                </div>
                <div className="form-section pagamento-field-valor">
                  <label>%</label>
                  <input
                    type="number"
                    value={p.percentual}
                    onChange={(e) => atualizarPagamento(index, 'percentual', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="button" className="btn-adicionar-pagamento" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={adicionarPagamento}>
            <FaPlus /> Adicionar pessoa
          </button>
        </div>

        <div className="form-section pagamentos-section">
          <h3>Categoria/tags padrão</h3>
          <TagSelector
            categorias={categorias}
            allTags={tags}
            paymentTags={form.tagsPadrao}
            onTagsChange={(novasTags) => setForm({ ...form, tagsPadrao: novasTags })}
          />
        </div>
      </div>
      </div>

      <div className="form-buttons">
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" onClick={handleSalvar} loading={salvando}>Salvar</Button>
      </div>
    </ModalTransacao>
  );
};

export default ContaFixaFormModal;
