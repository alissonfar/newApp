// src/pages/ModelosRelatorio/ModelosRelatorio.js
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  { value: '', label: '— Não configurar' },
  { value: 'subtract', label: 'Subtrair do total' },
  { value: 'ignore', label: 'Ignorar linha' }
];

const AGGREGATION_CARDS = [
  {
    value: 'default',
    title: 'Padrão',
    desc: 'Total, Gastos, Recebíveis, Saldo'
  },
  {
    value: 'devedor',
    title: 'Devedor',
    desc: 'Total Bruto, Pago, Devido'
  }
];

const ModelosRelatorio = () => {
  const { tags, categorias, loadingData, errorData } = useData();
  const [modelos, setModelos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
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

  const tagsOrdenados = useMemo(() => {
    const list = [];
    Object.entries(tagsPorCategoria).forEach(([, { nome, tags: catTags }]) => {
      catTags.forEach(tag => list.push({ ...tag, categoriaNome: nome }));
    });
    return list;
  }, [tagsPorCategoria]);

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
    setModalStep(1);
    if (modelo) {
      const regrasPorTag = {};
      (modelo.regras || []).forEach(r => {
        const tagId = r.tag?._id || r.tag;
        if (tagId) {
          const effect = r.effect;
          regrasPorTag[tagId] = effect === 'add' ? '' : effect;
        }
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
    setModalStep(1);
    setEditingModelo(null);
  };

  const nextStep = () => {
    if (!form.nome?.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    setModalStep(2);
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
    if (modalStep === 1) {
      nextStep();
      return;
    }
    if (!form.nome?.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    const regras = [];
    tagsOrdenados.forEach(tag => {
      const effect = form.regrasPorTag[tag._id];
      if (effect && effect !== '') {
        regras.push({ tag: tag._id, effect });
      }
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
          Defina como cada tag afeta os totais. Tags não configuradas entram como soma. Depois selecione o modelo na página de Relatórios.
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
            <div className="modelos-relatorio-modal-header">
              <h3>{editingModelo ? 'Editar Modelo' : 'Novo Modelo'}</h3>
              <span className="modelos-relatorio-step-indicator">Etapa {modalStep} de 2</span>
            </div>

            <form onSubmit={handleSubmit}>
              {modalStep === 1 ? (
                <>
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
                    <label>Qual resumo o relatório vai mostrar?</label>
                    <div className="modelos-relatorio-aggregation-cards">
                      {AGGREGATION_CARDS.map(card => (
                        <button
                          key={card.value}
                          type="button"
                          className={`modelos-relatorio-aggregation-card ${form.aggregation === card.value ? 'selected' : ''}`}
                          onClick={() => setForm(prev => ({ ...prev, aggregation: card.value }))}
                        >
                          <span className="modelos-relatorio-card-title">{card.title}</span>
                          <span className="modelos-relatorio-card-desc">{card.desc}</span>
                        </button>
                      ))}
                    </div>
                    {form.aggregation === 'devedor' && (
                      <p className="modelos-relatorio-devedor-hint">
                        Dica: para débitos, marque a tag PAGO como "Subtrair" e CANCELADO como "Ignorar".
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="modelos-relatorio-regras-section">
                  <h4>Regras por tag</h4>
                  <p className="modelos-relatorio-regras-hint">
                    Defina como cada tag afeta os totais. Tags não configuradas entram como soma.
                  </p>
                  {tagsOrdenados.length > 0 ? (
                    <div className="modelos-relatorio-regras-table-wrap">
                      <table className="modelos-relatorio-regras-table">
                        <thead>
                          <tr>
                            <th>Tag</th>
                            <th>Categoria</th>
                            <th>Efeito no cálculo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tagsOrdenados.map(tag => (
                            <tr key={tag._id}>
                              <td>
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
                              </td>
                              <td className="modelos-relatorio-categoria-cell">{tag.categoriaNome}</td>
                              <td>
                                <select
                                  value={form.regrasPorTag[tag._id] || ''}
                                  onChange={e => handleRegraChange(tag._id, e.target.value)}
                                  className="modelos-relatorio-effect-select"
                                >
                                  {EFFECT_OPTIONS.map(o => (
                                    <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="modelos-relatorio-no-tags">
                      <p>Crie tags em Gerenciar Tags primeiro. Depois volte para configurar as regras.</p>
                      <Link to="/tags" className="modelos-relatorio-link-tags" onClick={closeModal}>
                        Ir para Gerenciar Tags
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div className="modelos-relatorio-modal-actions">
                {modalStep === 1 ? (
                  <>
                    <button type="button" className="modelos-relatorio-btn-cancel" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="button" className="modelos-relatorio-btn-save" onClick={nextStep}>
                      Próximo: Definir regras
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="modelos-relatorio-btn-back" onClick={() => setModalStep(1)}>
                      Voltar
                    </button>
                    <button type="button" className="modelos-relatorio-btn-cancel" onClick={closeModal}>
                      Cancelar
                    </button>
                    <button type="submit" className="modelos-relatorio-btn-save">
                      {editingModelo ? 'Salvar' : 'Criar'}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelosRelatorio;
