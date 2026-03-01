import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUsers, FaPlus, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { listarVinculosConjuntos, criarVinculoConjunto } from '../../api';
import Button from '../../components/shared/Button';
import Card, { CardContent } from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
import './ConjuntoPage.css';

const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ConjuntoPage = () => {
  const navigate = useNavigate();
  const [vinculos, setVinculos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [participante, setParticipante] = useState('');
  const [descricao, setDescricao] = useState('');

  const carregar = async () => {
    try {
      setCarregando(true);
      const data = await listarVinculosConjuntos();
      setVinculos(Array.isArray(data) ? data : []);
      setErro(null);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar contas conjuntas');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const handleCriarVinculo = async (e) => {
    e.preventDefault();
    if (!nome.trim() || !participante.trim()) {
      toast.error('Nome e participante são obrigatórios.');
      return;
    }
    try {
      setSalvando(true);
      await criarVinculoConjunto({ nome: nome.trim(), participante: participante.trim(), descricao: descricao.trim() });
      toast.success('Vínculo criado com sucesso.');
      setModalNovo(false);
      setNome('');
      setParticipante('');
      setDescricao('');
      carregar();
    } catch (err) {
      toast.error(err.message || 'Erro ao criar vínculo.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="conjunto-page">
        <div className="conjunto-loading">
          <FaSpinner className="spinner" />
          <p>Carregando contas conjuntas...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="conjunto-page">
        <div className="conjunto-erro">
          <FaExclamationTriangle />
          <p>{erro}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conjunto-page">
      <div className="conjunto-header">
        <h1><FaUsers /> Contas Conjuntas</h1>
        <Button variant="primary" icon={<FaPlus size={14} />} onClick={() => setModalNovo(true)}>
          Novo
        </Button>
      </div>

      {vinculos.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              message="Nenhuma conta conjunta cadastrada. Clique em 'Novo' para criar um vínculo."
              icon={<FaUsers size={48} />}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="conjunto-lista">
          {vinculos.map((v) => (
            <Card key={v._id} className="conjunto-card">
              <div className="conjunto-card-content">
                <div className="conjunto-card-info">
                  <h3>{v.nome}</h3>
                  <p className="conjunto-participante">{v.participante}</p>
                  <p className={`conjunto-saldo ${(v.saldo || 0) >= 0 ? 'positivo' : 'negativo'}`}>
                    {(v.saldo || 0) >= 0 ? 'Te devem: ' : 'Você deve: '}
                    {formatarMoeda(Math.abs(v.saldo || 0))}
                  </p>
                </div>
                <Button variant="primary" size="sm" onClick={() => navigate(`/conjunto/${v._id}`)}>
                  Ver detalhes
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalNovo && (
        <div className="modal-overlay" onClick={() => !salvando && setModalNovo(false)}>
          <div className="modal-content conjunto-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Novo Vínculo</h3>
            <form onSubmit={handleCriarVinculo}>
              <div className="form-group">
                <label>Nome (ex: Conta com João)</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Conta com João"
                  required
                />
              </div>
              <div className="form-group">
                <label>Participante</label>
                <input
                  type="text"
                  value={participante}
                  onChange={(e) => setParticipante(e.target.value)}
                  placeholder="João"
                  required
                />
              </div>
              <div className="form-group">
                <label>Descrição (opcional)</label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder=""
                />
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={() => setModalNovo(false)} disabled={salvando}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Criar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConjuntoPage;
