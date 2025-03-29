import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useImportacao } from '../../../contexts/ImportacaoContext';
import './ListaTransacoesImportadas.css';

const ListaTransacoesImportadas = ({ importacaoId }) => {
  const { 
    transacoes, 
    carregarTransacoes, 
    atualizarTransacao, 
    removerTransacao,
    validarTransacao 
  } = useImportacao();
  
  const [loading, setLoading] = useState(true);
  const [transacaoEditando, setTransacaoEditando] = useState(null);
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    data: '',
    categoria: '',
    tipo: 'despesa'
  });

  useEffect(() => {
    const fetchTransacoes = async () => {
      try {
        await carregarTransacoes(importacaoId);
      } catch (error) {
        toast.error('Erro ao carregar transações.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransacoes();
  }, [importacaoId, carregarTransacoes]);

  const handleEditarClick = (transacao) => {
    setTransacaoEditando(transacao.id);
    setFormData({
      descricao: transacao.descricao,
      valor: transacao.valor.toString(),
      data: transacao.data,
      categoria: transacao.categoria,
      tipo: transacao.tipo
    });
  };

  const handleCancelarEdicao = () => {
    setTransacaoEditando(null);
    setFormData({
      descricao: '',
      valor: '',
      data: '',
      categoria: '',
      tipo: 'despesa'
    });
  };

  const handleSalvarEdicao = async (transacaoId) => {
    try {
      const transacaoAtualizada = {
        ...formData,
        valor: parseFloat(formData.valor)
      };

      await atualizarTransacao(importacaoId, transacaoId, transacaoAtualizada);
      toast.success('Transação atualizada com sucesso!');
      setTransacaoEditando(null);
    } catch (error) {
      toast.error('Erro ao atualizar transação.');
    }
  };

  const handleRemoverTransacao = async (transacaoId) => {
    if (window.confirm('Tem certeza que deseja remover esta transação?')) {
      try {
        await removerTransacao(importacaoId, transacaoId);
        toast.success('Transação removida com sucesso!');
      } catch (error) {
        toast.error('Erro ao remover transação.');
      }
    }
  };

  const handleValidarTransacao = async (transacaoId) => {
    try {
      await validarTransacao(importacaoId, transacaoId);
      toast.success('Transação validada com sucesso!');
    } catch (error) {
      toast.error('Erro ao validar transação.');
    }
  };

  const formatarValor = (valor) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="loading-state">
        <FaSpinner className="spinner" />
        <p>Carregando transações...</p>
      </div>
    );
  }

  return (
    <div className="lista-transacoes">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {transacoes.map((transacao) => (
              <tr key={transacao.id} className={transacao.validada ? 'validada' : ''}>
                <td>
                  {transacaoEditando === transacao.id ? (
                    <input
                      type="text"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                      className="edit-input"
                    />
                  ) : (
                    transacao.descricao
                  )}
                </td>
                <td>
                  {transacaoEditando === transacao.id ? (
                    <input
                      type="number"
                      value={formData.valor}
                      onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                      className="edit-input"
                      step="0.01"
                    />
                  ) : (
                    formatarValor(transacao.valor)
                  )}
                </td>
                <td>
                  {transacaoEditando === transacao.id ? (
                    <input
                      type="date"
                      value={formData.data}
                      onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                      className="edit-input"
                    />
                  ) : (
                    formatarData(transacao.data)
                  )}
                </td>
                <td>
                  {transacaoEditando === transacao.id ? (
                    <input
                      type="text"
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      className="edit-input"
                    />
                  ) : (
                    transacao.categoria
                  )}
                </td>
                <td>
                  {transacaoEditando === transacao.id ? (
                    <select
                      value={formData.tipo}
                      onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                      className="edit-input"
                    >
                      <option value="despesa">Despesa</option>
                      <option value="receita">Receita</option>
                    </select>
                  ) : (
                    transacao.tipo.charAt(0).toUpperCase() + transacao.tipo.slice(1)
                  )}
                </td>
                <td>
                  <span className={`status-badge ${transacao.validada ? 'validada' : 'pendente'}`}>
                    {transacao.validada ? 'Validada' : 'Pendente'}
                  </span>
                </td>
                <td className="acoes">
                  {transacaoEditando === transacao.id ? (
                    <>
                      <button
                        className="btn-acao salvar"
                        onClick={() => handleSalvarEdicao(transacao.id)}
                        title="Salvar"
                      >
                        <FaCheck />
                      </button>
                      <button
                        className="btn-acao cancelar"
                        onClick={handleCancelarEdicao}
                        title="Cancelar"
                      >
                        <FaTimes />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-acao editar"
                        onClick={() => handleEditarClick(transacao)}
                        title="Editar"
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="btn-acao remover"
                        onClick={() => handleRemoverTransacao(transacao.id)}
                        title="Remover"
                      >
                        <FaTrash />
                      </button>
                      {!transacao.validada && (
                        <button
                          className="btn-acao validar"
                          onClick={() => handleValidarTransacao(transacao.id)}
                          title="Validar"
                        >
                          <FaCheck />
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListaTransacoesImportadas; 