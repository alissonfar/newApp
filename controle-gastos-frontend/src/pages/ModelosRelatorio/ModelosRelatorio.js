// src/pages/ModelosRelatorio/ModelosRelatorio.js
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
  listarModelosRelatorio,
  criarModeloRelatorio,
  atualizarModeloRelatorio,
  excluirModeloRelatorio
} from '../../api';
import { useData } from '../../context/DataContext';
import './ModelosRelatorio.css';

const EFFECT_OPTIONS = [
  { value: '', label: 'Padrão (somar)' },
  { value: 'add', label: 'Somar' },
  { value: 'subtract', label: 'Subtrair' },
  { value: 'ignore', label: 'Ignorar' }
];

const AGGREGATION_OPTIONS = [
  { value: 'default', label: 'Padrão (Total, Gastos, Recebíveis, Saldo)' },
  { value: 'devedor', label: 'Devedor (Total Bruto, Pago, Devido)' }
];

const ModelosRelatorio = () => {
  const { tags, categorias, loadingData, errorData } = useData();
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState(null);
  const [form, setForm] = useState({
    nome: '',
    descricao: '',
    aggregation: 'default',
    regrasPorTag: {}
  });

  const tagsPorCategoria = useMemo(() => {
    return (tags || []).reduce((acc, tag) => {
      const catId = typeof tag.categoria === 'object' ? tag.categoria._id : tag.categoria;
      const cat = categorias.find(c => c._id === catId);
      if (cat) {
        if (!acc[cat._id]) acc[cat._id] = { nome: cat.nome, tags: [] };
        acc[cat._id].tags.push(tag);
      }
      return acc;
    }, {});
  }, [tags, categorias]);

  useEffect(() => {
    loadModelos();
  }, []);

  const loadModelos = async () => {
    setLoading(true);
    try {
      const data = await listarModelosRelatorio();
      setModelos(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Erro ao carregar modelos.');
      setModelos([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (modelo = null) => {
    if (modelo) {
      const regrasPorTag = {};
      (modelo.regras || []).forEach(r => {
        const tagId = r.tag?._id || r.tag;
        if (tagId) regrasPorTag[tagId] = r.effect || '';
      });
      setForm({
        nome: modelo.nome,
        descricao: modelo.descricao || '',
        aggregation: modelo.aggregation || 'default',
        regrasPorTag
      });
      setEditingModelo(modelo);
    } else {
      setForm({
        nome: '',
        descricao: '',
        aggregation: 'default',
        regrasPorTag: {}
      });
      setEditingModelo(null);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingModelo(null);
  };

  const handleRegraChange = (tagId, effect) => {
    setForm(prev => ({
      ...prev,
      regrasPorTag: {
        ...prev.regrasPorTag,
        [tagId]: effect
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome?.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    const regras = [];
    Object.entries(tagsPorCategoria).forEach(([, { tags: catTags }]) => {
      catTags.forEach(tag => {
        const effect = form.regrasPorTag[tag._id];
        if (effect && effect !== '') {
          regras.push({ tag: tag._id, effect });
        }
      });
    });

    try {
      if (editingModelo) {
        await atualizarModeloRelatorio(editingModelo._id, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          aggregation: form.aggregation,
          regras
        });
        toast.success('Modelo atualizado com sucesso!');
      } else {
        await criarModeloRelatorio({
          nome: form.nome.trim(),
          descricao: form.descricao.trim(),
          aggregation: form.aggregation,
          regras
        });
        toast.success('Modelo criado com sucesso!');
      }
      closeModal();
      loadModelos();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar modelo.');
    }
  };

  const handleExcluir = async (modelo) => {
    const result = await Swal.fire({
      title: 'Excluir modelo?',
      text: `O modelo "${modelo.nome}" será excluído.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await excluirModeloRelatorio(modelo._id);
        toast.success('Modelo excluído.');
        loadModelos();
      } catch (err) {
        toast.error(err.message || 'Erro ao excluir.');
      }
    }
  };

  if (loadingData || loading) {
    return <div className="modelos-relatorio-loading">Carregando modelos...</div>;
  }

  if (errorData) {
    return <div className="modelos-relatorio-error">Erro ao carregar dados. {errorData.message}</div>;
  }

  return (
    <div className="modelos-relatorio-container">
      <div className="modelos-relatorio-header">
        <h2>Modelos de Relatório</h2>
        <p className="modelos-relatorio-desc">
          Configure quais tags somam, subtraem ou são ignoradas em cada modelo. Depois selecione o modelo na página de Relatórios.
        </p>
        <button className="modelos-relatorio-btn-novo" onClick={() => openModal()}>
          + Novo Modelo
        </button>
      </div>

      <div className="modelos-relatorio-list">
        {modelos.length === 0 ? (
          <p className="modelos-relatorio-empty">Nenhum modelo criado. Clique em "Novo Modelo" para começar.</p>
        ) : (
          <table className="modelos-relatorio-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th>Regras</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {modelos.map(m => (
                <tr key={m._id}>
                  <td><strong>{m.nome}</strong></td>
                  <td>{m.descricao || '—'}</td>
                  <td>{m.aggregation === 'devedor' ? 'Devedor' : 'Padrão'}</td>
                  <td>{m.regras?.length || 0} regras</td>
                  <td>
                    <button className="modelos-relatorio-btn-edit" onClick={() => openModal(m)}>Editar</button>
                    <button className="modelos-relatorio-btn-delete" onClick={() => handleExcluir(m)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="modelos-relatorio-modal-overlay" onClick={closeModal}>
          <div className="modelos-relatorio-modal" onClick={e => e.stopPropagation()}>
            <h3>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="modelos-relatorio-form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Relatório de Débitos"
                  required
                />
              </div>
              <div className="modelos-relatorio-form-group">
                <label>Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição opcional"
                  rows={2}
                />
              </div>
              <div className="modelos-relatorio-form-group">
                <label>Tipo de Agregação</label>
                <select
                  value={form.aggregation}
                  onChange={e => setForm(prev => ({ ...prev, aggregation: e.target.value }))}
                >
                  {AGGREGATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="modelos-relatorio-regras-section">
                <h4>Regras por Tag</h4>
                <p className="modelos-relatorio-regras-hint">
                  Defina o efeito de cada tag no cálculo. Padrão = soma o valor. Ordem = prioridade (primeira que bater).
                </p>
                {Object.entries(tagsPorCategoria).map(([catId, { nome, tags: catTags }]) => (
                  <div key={catId} className="modelos-relatorio-categoria-block">
                    <h5>{nome}</h5>
                    <div className="modelos-relatorio-tags-grid">
                      {catTags.map(tag => (
                        <div key={tag._id} className="modelos-relatorio-tag-row">
                          <span
                            className="modelos-relatorio-tag-chip"
                            style={{
                              backgroundColor: `${tag.cor || '#ccc'}20`,
                              color: tag.cor || '#666',
                              border: `1px solid ${tag.cor || '#ccc'}`
                            }}
                          >
                            {tag.nome}
                          </span>
                          <select
                            value={form.regrasPorTag[tag._id] || ''}
                            onChange={e => handleRegraChange(tag._id, e.target.value)}
                          >
                            {EFFECT_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {Object.keys(tagsPorCategoria).length === 0 && (
                  <p className="modelos-relatorio-no-tags">Crie categorias e tags em "Gerenciar Tags" primeiro.</p>
                )}
              </div>

              <div className="modelos-relatorio-modal-actions">
                <button type="button" className="modelos-relatorio-btn-cancel" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" className="modelos-relatorio-btn-save">
                  {editingModelo ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelosRelatorio;
