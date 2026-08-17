import React, { useState, useMemo } from 'react';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import { useData } from '../../context/DataContext';
import usePagamentos from '../../hooks/usePagamentos';
import TabPagamentos from '../../components/Transaction/TabPagamentos';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import '../../components/Transaction/NovaTransacaoForm.css';
import '../../components/Transaction/TransacaoTabs.css';
import '../../components/Transaction/TabResumo.css';
import './ContaFixaFormModal.css';

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
  const [form, setForm] = useState(() => ({
    nome: contaFixa?.nome || '',
    tipo: contaFixa?.tipo || 'gasto',
    valorEsperado: contaFixa?.valorEsperado ?? '',
    diaLancamento: contaFixa?.diaLancamento ?? 1,
    diaVencimento: contaFixa?.diaVencimento ?? 1,
    vencimentoMesSeguinte: contaFixa?.vencimentoMesSeguinte || false,
    modo: contaFixa?.modo || 'automatico',
    dataFim: contaFixa?.dataFim || '',
    totalRepeticoes: contaFixa?.totalRepeticoes || ''
  }));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [activeTab, setActiveTab] = useState('principal');

  const transacaoParaPagamentos = useMemo(
    () => (contaFixa ? { pagamentos: contaFixa.pagamentosTemplate } : null),
    [contaFixa]
  );

  const pagamentos = usePagamentos({
    transacao: transacaoParaPagamentos,
    proprietarioPadrao: '',
    valorTotal: form.valorEsperado
  });

  const resumoIssues = [];
  if (!pagamentos.isValid()) {
    resumoIssues.push({ type: 'error', msg: `Soma dos pagamentos é R$ ${pagamentos.soma.toFixed(2).replace('.', ',')}, deveria ser R$ ${pagamentos.valorEsperadoParaSoma.toFixed(2).replace('.', ',')}` });
  }
  const pessoasVazias = pagamentos.pagamentos.filter(p => !p.pessoa || !p.pessoa.trim());
  if (pessoasVazias.length > 0) resumoIssues.push({ type: 'error', msg: `${pessoasVazias.length} pagamento(s) sem pessoa` });
  const pessoasPreenchidas = pagamentos.pagamentos.map(p => (p.pessoa || '').trim()).filter(Boolean);
  const hasDuplicatePeople = new Set(pessoasPreenchidas).size !== pessoasPreenchidas.length;
  if (hasDuplicatePeople) resumoIssues.push({ type: 'warn', msg: 'Pessoas duplicadas nos pagamentos' });

  const handleSalvar = async () => {
    if (!pagamentos.isValid()) {
      setErro('A soma dos pagamentos deve ser igual ao valor esperado.');
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
        dataFim: form.dataFim || null,
        pagamentosTemplate: pagamentos.buildPagamentosPayload()
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

        <TabPagamentos
          pagamentos={pagamentos.pagamentos}
          handlePagamentoChange={pagamentos.handlePagamentoChange}
          addPagamento={pagamentos.addPagamento}
          removePagamento={pagamentos.removePagamento}
          splitEqually={pagamentos.splitEqually}
          splitInto={pagamentos.splitInto}
          applyPreset={pagamentos.applyPreset}
          duplicatePagamento={pagamentos.duplicatePagamento}
          toggleFixed={pagamentos.toggleFixed}
          fillRemaining={pagamentos.fillRemaining}
          distributeRemaining={pagamentos.distributeRemaining}
          categorias={categorias}
          allTags={tags}
          proprietarioPadrao=""
          valorTotal={form.valorEsperado}
          showValidationWarning={pagamentos.showValidationWarning}
          soma={pagamentos.soma}
          saldoRestante={pagamentos.saldoRestante}
          enableEmprestimo={false}
        />
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
            <h4 className="resumo-block-title">Divisão de pagamento <Badge ok={pagamentos.isValid()} error={!pagamentos.isValid()} label={pagamentos.isValid() ? 'OK' : 'Divergente'} /></h4>
            <div className="resumo-grid">
              <div className="resumo-field"><span className="resumo-label">Soma dos pagamentos</span><span className="resumo-value" style={!pagamentos.isValid() ? { color: '#ff9800' } : {}}>R$ {pagamentos.soma.toFixed(2).replace('.', ',')}</span></div>
              <div className="resumo-field"><span className="resumo-label">Qtd. pagamentos</span><span className="resumo-value">{pagamentos.pagamentos.length}</span></div>
            </div>
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
