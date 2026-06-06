// src/pages/Pessoas/PessoasPage.js
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { listarPessoas, criarPessoa, atualizarPessoa, excluirPessoa } from '../../api';
import './PessoasPage.css';

const PessoasPage = () => {
  const [pessoas, setPessoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPessoa, setEditingPessoa] = useState(null);
  const [form, setForm] = useState({ nome: '', contato: '', observacoes: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listarPessoas();
      setPessoas(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error('Erro ao carregar pessoas.');
      setPessoas([]);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (pessoa = null) => {
    if (pessoa) {
      setEditingPessoa(pessoa);
      setForm({
        nome: pessoa.nome || '',
        contato: pessoa.contato || '',
        observacoes: pessoa.observacoes || ''
      });
    } else {
      setEditingPessoa(null);
      setForm({ nome: '', contato: '', observacoes: '' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPessoa(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }
    try {
      if (editingPessoa) {
        await atualizarPessoa(editingPessoa._id, form);
        toast.success('Pessoa atualizada.');
      } else {
        await criarPessoa(form);
        toast.success('Pessoa criada.');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar pessoa.');
    }
  };

  const handleExcluir = async (pessoa) => {
    const result = await Swal.fire({
      title: 'Excluir pessoa?',
      text: `A pessoa "${pessoa.nome}" será removida.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await excluirPessoa(pessoa._id);
        toast.success('Pessoa excluída.');
        load();
      } catch (err) {
        toast.error(err.message || 'Erro ao excluir.');
      }
    }
  };

  if (loading) return <div className="pessoas-loading">Carregando pessoas...</div>;

  return (
    <div className="pessoas-container">
      <div className="pessoas-header">
        <h2>Pessoas</h2>
        <p className="pessoas-desc">
          Cadastre as pessoas para quem você empresta dinheiro. Use nos empréstimos para
          vincular transações e controlar quem te deve.
        </p>
        <button className="pessoas-btn-novo" onClick={() => openModal()}>+ Nova Pessoa</button>
      </div>

      {pessoas.length === 0 ? (
        <div className="pessoas-empty">
          <p>Nenhuma pessoa cadastrada.</p>
          <p>Cadastre a primeira para começar a registrar empréstimos.</p>
        </div>
      ) : (
        <div className="pessoas-grid">
          {pessoas.map((p) => (
            <div key={p._id} className="pessoa-card">
              <div className="pessoa-card-header">
                <h3>{p.nome}</h3>
                {p.ativo === false && <span className="pessoa-inativa">inativa</span>}
              </div>
              {p.contato && <p className="pessoa-contato">📞 {p.contato}</p>}
              {p.observacoes && <p className="pessoa-obs">{p.observacoes}</p>}
              <div className="pessoa-card-actions">
                <button onClick={() => openModal(p)}>Editar</button>
                <button className="pessoa-btn-excluir" onClick={() => handleExcluir(p)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="pessoas-modal-overlay" onClick={closeModal}>
          <div className="pessoas-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingPessoa ? 'Editar Pessoa' : 'Nova Pessoa'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="pessoas-form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: João Silva"
                  autoFocus
                />
              </div>
              <div className="pessoas-form-group">
                <label>Contato (opcional)</label>
                <input
                  type="text"
                  value={form.contato}
                  onChange={(e) => setForm({ ...form, contato: e.target.value })}
                  placeholder="Telefone, e-mail..."
                />
              </div>
              <div className="pessoas-form-group">
                <label>Observações (opcional)</label>
                <textarea
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  rows={3}
                  placeholder="Anotações livres..."
                />
              </div>
              <div className="pessoas-modal-actions">
                <button type="button" onClick={closeModal} className="pessoas-btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="pessoas-btn-salvar">
                  {editingPessoa ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PessoasPage;
