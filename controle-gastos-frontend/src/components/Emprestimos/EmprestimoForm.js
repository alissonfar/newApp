// src/components/Emprestimos/EmprestimoForm.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { listarPessoas } from '../../api';

const ESTADO_INICIAL = {
  pessoaId: '',
  valorEsperadoRetorno: '',
  tipoRetorno: 'sem_juros',
  taxaJurosPercentual: '',
  valorJurosFixo: '',
  prazoFinal: '',
  observacao: ''
};

const EmprestimoForm = ({ inicial, onSubmit, onCancel, somenteEdicaoParcial = false }) => {
  const [form, setForm] = useState({ ...ESTADO_INICIAL, ...(inicial || {}) });
  const [pessoas, setPessoas] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarPessoas()
      .then((data) => { if (!cancelado) setPessoas(Array.isArray(data) ? data : []); })
      .catch(() => toast.error('Erro ao carregar pessoas.'));
    return () => { cancelado = true; };
  }, []);

  const isEdicao = !!inicial && !!inicial._id;

  const handleChange = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.pessoaId) {
      toast.error('Selecione uma pessoa.');
      return;
    }
    const valor = parseFloat(form.valorEsperadoRetorno);
    if (!valor || valor <= 0) {
      toast.error('Informe o valor esperado de retorno.');
      return;
    }
    if (!form.prazoFinal) {
      toast.error('Informe o prazo final.');
      return;
    }
    if (form.tipoRetorno === 'juros_percentual' && !form.taxaJurosPercentual) {
      toast.error('Informe o percentual de juros.');
      return;
    }
    if (form.tipoRetorno === 'juros_fixo' && !form.valorJurosFixo) {
      toast.error('Informe o valor de juros fixo.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        pessoaId: form.pessoaId,
        valorEsperadoRetorno: valor,
        tipoRetorno: form.tipoRetorno,
        taxaJurosPercentual: form.tipoRetorno === 'juros_percentual' ? parseFloat(form.taxaJurosPercentual) : null,
        valorJurosFixo: form.tipoRetorno === 'juros_fixo' ? parseFloat(form.valorJurosFixo) : null,
        prazoFinal: form.prazoFinal,
        observacao: form.observacao || null
      };
      await onSubmit(payload);
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar empréstimo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="emp-form">
      <div className="emp-form-group">
        <label>Pessoa *</label>
        <select
          value={form.pessoaId}
          onChange={(e) => handleChange('pessoaId', e.target.value)}
          disabled={isEdicao && somenteEdicaoParcial}
        >
          <option value="">Selecione...</option>
          {pessoas.map((p) => (
            <option key={p._id} value={p._id}>{p.nome}</option>
          ))}
        </select>
        {pessoas.length === 0 && (
          <small>Cadastre pessoas em /pessoas antes de criar um empréstimo.</small>
        )}
      </div>

      <div className="emp-form-row">
        <div className="emp-form-group">
          <label>Valor esperado de retorno *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valorEsperadoRetorno}
            onChange={(e) => handleChange('valorEsperadoRetorno', e.target.value)}
            placeholder="Ex: 850.00"
          />
        </div>
        <div className="emp-form-group">
          <label>Prazo final *</label>
          <input
            type="date"
            value={form.prazoFinal ? form.prazoFinal.split('T')[0] : ''}
            onChange={(e) => handleChange('prazoFinal', e.target.value)}
          />
        </div>
      </div>

      <div className="emp-form-group">
        <label>Tipo de retorno</label>
        <select
          value={form.tipoRetorno}
          onChange={(e) => handleChange('tipoRetorno', e.target.value)}
        >
          <option value="sem_juros">Sem juros</option>
          <option value="valor_fixo">Valor fixo (juros embutidos no esperado)</option>
          <option value="juros_percentual">Juros percentual</option>
          <option value="juros_fixo">Juros fixo (R$)</option>
        </select>
      </div>

      {form.tipoRetorno === 'juros_percentual' && (
        <div className="emp-form-group">
          <label>Percentual de juros (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.taxaJurosPercentual}
            onChange={(e) => handleChange('taxaJurosPercentual', e.target.value)}
            placeholder="Ex: 10"
          />
        </div>
      )}

      {form.tipoRetorno === 'juros_fixo' && (
        <div className="emp-form-group">
          <label>Valor de juros fixo (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valorJurosFixo}
            onChange={(e) => handleChange('valorJurosFixo', e.target.value)}
            placeholder="Ex: 50.00"
          />
        </div>
      )}

      <div className="emp-form-group">
        <label>Observação</label>
        <textarea
          value={form.observacao || ''}
          onChange={(e) => handleChange('observacao', e.target.value)}
          rows={3}
          placeholder="Anotações livres..."
        />
      </div>

      <div className="emp-form-actions">
        <button type="button" onClick={onCancel} className="emp-btn-cancelar" disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="emp-btn-salvar" disabled={submitting}>
          {submitting ? 'Salvando...' : (isEdicao ? 'Atualizar' : 'Criar')}
        </button>
      </div>
    </form>
  );
};

export default EmprestimoForm;
