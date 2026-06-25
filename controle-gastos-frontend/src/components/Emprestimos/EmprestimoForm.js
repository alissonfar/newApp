// src/components/Emprestimos/EmprestimoForm.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { listarPessoas } from '../../api';

// A partir do design 2026-06-24, `valorEsperadoRetorno` migrou para a Transação.
// Este formulário do Empréstimo agora cuida apenas de: pessoa, tipo de retorno,
// prazo final e observação. O valor esperado de cada gasto é preenchido na
// seção de Empréstimo do formulário da Transação (`EmprestimoSecao`).
const ESTADO_INICIAL = {
  pessoaId: '',
  tipoRetorno: 'valor_fixo',
  prazoFinal: '',
  observacao: ''
};

const EmprestimoForm = ({ inicial, onSubmit, onCancel, somenteEdicaoParcial = false }) => {
  const [form, setForm] = useState({ ...ESTADO_INICIAL, ...(inicial || {}) });
  const [pessoas, setPessoas] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelado = false;
    listarPessoas(true)
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
    if (!form.prazoFinal) {
      toast.error('Informe o prazo final.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        pessoaId: form.pessoaId,
        tipoRetorno: form.tipoRetorno,
        prazoFinal: form.prazoFinal,
        observacao: form.observacao || null
        // valorEsperadoRetorno removido — agora é campo da Transação.
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
          <option value="valor_fixo">Valor fixo (juros embutidos no esperado)</option>
          <option value="sem_juros">Sem juros</option>
        </select>
      </div>

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
