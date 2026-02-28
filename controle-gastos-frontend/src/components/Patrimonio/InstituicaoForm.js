import React, { useState, useEffect } from 'react';
import './PatrimonioForm.css';

const TIPOS = [
  { value: 'banco_digital', label: 'Banco Digital' },
  { value: 'banco_tradicional', label: 'Banco Tradicional' },
  { value: 'carteira_digital', label: 'Carteira Digital' },
  { value: 'corretora', label: 'Corretora' }
];

const InstituicaoForm = ({ instituicao, onSalvar, onFechar }) => {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('banco_digital');
  const [cor, setCor] = useState('#2196f3');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (instituicao) {
      setNome(instituicao.nome || '');
      setTipo(instituicao.tipo || 'banco_digital');
      setCor(instituicao.cor || '#2196f3');
    } else {
      setNome('');
      setTipo('banco_digital');
      setCor('#2196f3');
    }
  }, [instituicao]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) {
      setErro('Nome é obrigatório.');
      return;
    }
    try {
      await onSalvar({ nome: nome.trim(), tipo, cor });
      onFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || err.message || 'Erro ao salvar.');
    }
  };

  return (
    <div className="patrimonio-modal-overlay" onClick={onFechar}>
      <div className="patrimonio-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{instituicao ? 'Editar Instituição' : 'Nova Instituição'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Nubank, Itaú"
            />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Cor</label>
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              style={{ width: 60, height: 36, padding: 2, cursor: 'pointer' }}
            />
          </div>
          {erro && <p className="form-erro">{erro}</p>}
          <div className="form-actions">
            <button type="button" onClick={onFechar}>Cancelar</button>
            <button type="submit">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InstituicaoForm;
