import React, { useState, useEffect } from 'react';
import Button from '../shared/Button';
import InstituicaoSelect from '../shared/InstituicaoSelect';
import './PatrimonioForm.css';

const TIPOS = [
  { value: 'corrente', label: 'Corrente' },
  { value: 'rendimento_automatico', label: 'Rendimento Automático' },
  { value: 'caixinha', label: 'Caixinha' },
  { value: 'investimento_fixo', label: 'Investimento Fixo' }
];

const PROPOSITOS = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'reserva_emergencia', label: 'Reserva de Emergência' },
  { value: 'objetivo', label: 'Objetivo' },
  { value: 'guardado', label: 'Guardado' }
];

const SubcontaForm = ({ subconta, instituicoes, instituicaoPadrao, onSalvar, onFechar }) => {
  const [instituicao, setInstituicao] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('corrente');
  const [proposito, setProposito] = useState('disponivel');
  const [percentualCDI, setPercentualCDI] = useState('');
  const [saldoAtual, setSaldoAtual] = useState('');
  const [meta, setMeta] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    const instId = instituicaoPadrao?._id || instituicaoPadrao;
    if (subconta) {
      setInstituicao(subconta.instituicao?._id || subconta.instituicao || '');
      setNome(subconta.nome || '');
      setTipo(subconta.tipo || 'corrente');
      setProposito(subconta.proposito || 'disponivel');
      setPercentualCDI(subconta.percentualCDI != null ? String(subconta.percentualCDI) : '');
      setSaldoAtual(subconta.saldoAtual != null ? String(subconta.saldoAtual) : '');
      setMeta(subconta.meta != null ? String(subconta.meta) : '');
    } else {
      setInstituicao(instId || (instituicoes?.[0]?._id) || '');
      setNome('');
      setTipo('corrente');
      setProposito('disponivel');
      setPercentualCDI('');
      setSaldoAtual('');
      setMeta('');
    }
  }, [subconta, instituicoes, instituicaoPadrao]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!instituicao) {
      setErro('Selecione uma instituição.');
      return;
    }
    if (!nome.trim()) {
      setErro('Nome é obrigatório.');
      return;
    }
    const dados = {
      instituicao,
      nome: nome.trim(),
      tipo,
      proposito,
      percentualCDI: percentualCDI ? parseFloat(percentualCDI) : null,
      saldoAtual: saldoAtual ? parseFloat(saldoAtual) : 0,
      meta: meta ? parseFloat(meta) : null
    };
    try {
      await onSalvar(dados);
      onFechar();
    } catch (err) {
      setErro(err.response?.data?.erro || err.message || 'Erro ao salvar.');
    }
  };

  return (
    <div className="patrimonio-modal-overlay" onClick={onFechar}>
      <div className="patrimonio-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{subconta ? 'Editar Subconta' : 'Nova Subconta'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Instituição</label>
            <InstituicaoSelect
              instituicoes={instituicoes || []}
              value={instituicao}
              onChange={setInstituicao}
              placeholder="Selecione..."
              allowEmpty
              disabled={!!instituicaoPadrao && !subconta}
            />
          </div>
          <div className="form-group">
            <label>Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Conta Corrente, Caixinha Reserva"
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
            <label>Propósito</label>
            <select value={proposito} onChange={(e) => setProposito(e.target.value)}>
              {PROPOSITOS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>% CDI (opcional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={percentualCDI}
              onChange={(e) => setPercentualCDI(e.target.value)}
              placeholder="Ex: 100"
            />
          </div>
          {!subconta && (
            <div className="form-group">
              <label>Saldo Inicial (opcional)</label>
              <input
                type="number"
                step="0.01"
                value={saldoAtual}
                onChange={(e) => setSaldoAtual(e.target.value)}
                placeholder="0,00"
              />
            </div>
          )}
          <div className="form-group">
            <label>Meta (opcional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="0,00"
            />
          </div>
          {erro && <p className="form-erro">{erro}</p>}
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={onFechar}>Cancelar</Button>
            <Button type="submit" variant="primary">Salvar</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubcontaForm;
