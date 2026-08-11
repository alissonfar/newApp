import React, { useState } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import { useData } from '../../context/DataContext';
import TagSelector from '../../components/Transaction/TagSelector';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import '../../components/Transaction/NovaTransacaoForm.css';
import '../../components/Transaction/TransacaoTabs.css';
import '../../components/Transaction/TabResumo.css';
import './ContaFixaFormModal.css';

const valorPadraoPagamento = () => ({ pessoa: '', percentual: 100, tagsOverride: null });

const Badge = ({ ok, warn, error, label }) => {
  const color = error ? '#d32f2f' : warn ? '#ff9800' : '#2ecc71';
  const bg = error ? '#d32f2f12' : warn ? '#ff980012' : '#2ecc7112';
  return (
    <span className="resumo-badge" style={{ color, backgroundColor: bg, borderColor: color + '30' }}>
      {label}
    </span>
  );
};

const MODO_LABEL = { automatico: 'Automático (lança sozinho)', confirmacao: 'Confirmação manual' };
const TIPO_LABEL = { gasto: 'Despesa', recebivel: 'Receita' };

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
  const [activeTab, setActiveTab] = useState('principal');

  const somaPercentual = form.pagamentosTemplate.reduce((acc, p) => acc + Number(p.percentual || 0), 0);
  const somaOk = Math.abs(somaPercentual - 100) < 0.01;

  const getPagamentoTags = (p) => {
    const tagsDoItem = p.tagsOverride || form.tagsPadrao || {};
    const result = [];
    Object.entries(tagsDoItem).forEach(([catId, tagIds]) => {
      if (!Array.isArray(tagIds) || tagIds.length === 0) return;
      const cat = categorias.find(c => c._id === catId);
      tagIds.forEach(tid => {
        const tag = tags.find(t => t._id === tid);
        if (tag) result.push({ catNome: cat?.nome || catId, tagNome: tag.nome, tagCor: tag.cor });
      });
    });
    return result;
  };

  const pessoas = form.pagamentosTemplate.map(p => p.pessoa.trim()).filter(Boolean);
  const pessoasVazias = form.pagamentosTemplate.filter(p => !p.pessoa.trim());
  const percentuaisZerados = form.pagamentosTemplate.filter(p => Number(p.percentual || 0) === 0);
  const hasDuplicatePeople = new Set(pessoas).size !== pessoas.length;
  const anyTagMissing = form.pagamentosTemplate.length > 0 && form.pagamentosTemplate.every(p => getPagamentoTags(p).length === 0);

  const resumoIssues = [];
  if (!somaOk) resumoIssues.push({ type: 'error', msg: `Soma dos percentuais é ${somaPercentual}%, deveria ser 100%` });
  if (pessoasVazias.length > 0) resumoIssues.push({ type: 'error', msg: `${pessoasVazias.length} pagamento(s) sem pessoa` });
  if (percentuaisZerados.length > 0) resumoIssues.push({ type: 'error', msg: `${percentuaisZerados.length} pagamento(s) com percentual zerado` });
  if (hasDuplicatePeople) resumoIssues.push({ type: 'warn', msg: 'Pessoas duplicadas nos pagamentos' });
  if (anyTagMissing) resumoIssues.push({ type: 'warn', msg: 'Nenhuma tag aplicada nos pagamentos' });

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
      <Card variant="glass" padding="md" className="conta-fixa-form-card">
      <h2 className="nova-transacao-form-title">{contaFixa ? 'Editar Conta Fixa' : 'Nova Conta Fixa'}</h2>

      <div className="transacao-tabs-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'principal'}
          className={`transacao-tab ${activeTab === 'principal' ? 'active' : ''}`}
          onClick={() => setActiveTab('principal')}
        >
          Principal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'resumo'}
          className={`transacao-tab ${activeTab === 'resumo' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumo')}
        >
          Resumo
        </button>
      </div>

      <div className="transacao-tab-content">
      {erro && <p className="error-message">{erro}</p>}

      {activeTab === 'principal' && (
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

              <div className="pagamento-tags-summary">
                <TagSelector
                  categorias={categorias}
                  allTags={tags}
                  paymentTags={p.tagsOverride || form.tagsPadrao || {}}
                  onTagsChange={(novasTags) => atualizarPagamento(index, 'tagsOverride', novasTags)}
                />
              </div>
            </div>
          ))}

          <button type="button" className="btn-adicionar-pagamento" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={adicionarPagamento}>
            <FaPlus /> Adicionar pessoa
          </button>
        </div>
      </div>
      )}

      {activeTab === 'resumo' && (
      <div className="tab-resumo">
        <div className="resumo-sections">

          <div className="resumo-block">
            <h4 className="resumo-block-title">Dados básicos</h4>
            <div className="resumo-grid">
              <div className="resumo-field"><span className="resumo-label">Nome</span><span className="resumo-value">{form.nome || '—'}</span></div>
              <div className="resumo-field"><span className="resumo-label">Tipo</span><span className="resumo-value">{TIPO_LABEL[form.tipo]}</span></div>
              <div className="resumo-field"><span className="resumo-label">Valor esperado</span><span className="resumo-value resumo-valor">R$ {(parseFloat(form.valorEsperado) || 0).toFixed(2).replace('.', ',')}</span></div>
              <div className="resumo-field"><span className="resumo-label">Modo</span><span className="resumo-value">{MODO_LABEL[form.modo]}</span></div>
              <div className="resumo-field"><span className="resumo-label">Dia de lançamento</span><span className="resumo-value">{form.diaLancamento}</span></div>
              <div className="resumo-field"><span className="resumo-label">Dia de vencimento</span><span className="resumo-value">{form.diaVencimento}{form.vencimentoMesSeguinte ? ' (mês seguinte)' : ''}</span></div>
              {form.dataFim && <div className="resumo-field"><span className="resumo-label">Data fim</span><span className="resumo-value">{form.dataFim}</span></div>}
              {form.totalRepeticoes && <div className="resumo-field"><span className="resumo-label">Total de repetições</span><span className="resumo-value">{form.totalRepeticoes}</span></div>}
            </div>
          </div>

          <div className="resumo-block">
            <h4 className="resumo-block-title">Divisão de pagamento <Badge ok={somaOk} error={!somaOk} label={somaOk ? 'OK' : 'Divergente'} /></h4>
            <div className="resumo-grid">
              <div className="resumo-field"><span className="resumo-label">Soma dos percentuais</span><span className="resumo-value" style={!somaOk ? { color: '#ff9800' } : {}}>{somaPercentual}%</span></div>
              <div className="resumo-field"><span className="resumo-label">Qtd. pagamentos</span><span className="resumo-value">{form.pagamentosTemplate.length}</span></div>
            </div>
          </div>

          <div className="resumo-block">
            <h4 className="resumo-block-title">Pagamentos</h4>
            {form.pagamentosTemplate.map((p, i) => {
              const valorCalculado = (parseFloat(form.valorEsperado) || 0) * (Number(p.percentual || 0) / 100);
              const paymentTags = getPagamentoTags(p);
              return (
                <div key={i} className="resumo-pagamento-row">
                  <div className="resumo-pag-header">
                    <span className="resumo-pag-pessoa">{p.pessoa || '(vazio)'}</span>
                    <span className="resumo-pag-valor">{p.percentual}% · R$ {valorCalculado.toFixed(2).replace('.', ',')}</span>
                    {!p.pessoa.trim() && <Badge error label="Sem pessoa" />}
                    {Number(p.percentual || 0) === 0 && <Badge error label="0%" />}
                  </div>
                  {paymentTags.length > 0 && (
                    <div className="resumo-pag-tags-list">
                      {paymentTags.map((t, ti) => (
                        <span key={ti} className="resumo-tag-chip" style={{ backgroundColor: (t.tagCor || '#666') + '18', color: t.tagCor || '#666', borderColor: (t.tagCor || '#666') + '30' }}>
                          {t.catNome}: {t.tagNome}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="resumo-block">
            <h4 className="resumo-block-title">Consistência</h4>
            {resumoIssues.length === 0 ? (
              <div className="resumo-row">
                <Badge ok label="Nenhum problema detectado" />
              </div>
            ) : (
              <div className="resumo-issues">
                {resumoIssues.map((issue, i) => (
                  <div key={i} className={`resumo-issue resumo-issue-${issue.type}`}>
                    <span className="resumo-issue-dot" />
                    <span>{issue.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
      </div>

      <div className="form-buttons">
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" onClick={handleSalvar} loading={salvando}>Salvar</Button>
      </div>
      </Card>
    </ModalTransacao>
  );
};

export default ContaFixaFormModal;
