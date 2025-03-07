// src/pages/Home/Home.js
import React, { useContext, useEffect, useState } from 'react';
import { obterTransacoes } from '../../api';
import TransactionCard from '../../components/Transaction/TransactionCard';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import { AuthContext } from '../../context/AuthContext';
import './Home.css';

const Home = () => {
  const [transacoes, setTransacoes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const { usuario } = useContext(AuthContext);

  const carregarTransacoes = async () => {
    try {
      const dados = await obterTransacoes();
      const transacoesOrdenadas = (dados.transacoes || [])
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 10);
      setTransacoes(transacoesOrdenadas);
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
    }
  };

  useEffect(() => {
    carregarTransacoes();
  }, []);

  return (
    <div className="home-container">
      {/* Header */}
      <header className="home-header">
        <div className="home-header-left">
          <h1>Controle de Gastos</h1>
        </div>
        <div className="home-header-right">
          <div className="user-area">
            <img
              src="https://via.placeholder.com/36" 
              alt="Avatar do usuário"
              className="user-avatar"
            />
            <span className="user-name">
              Olá, {usuario ? usuario.nome : 'Usuário'}
            </span>
          </div>
        </div>
      </header>

      {/* Transações Recentes */}
      <section className="recent-transactions">
        <h2>Transações Recentes</h2>
        <div className="transactions-grid">
          {transacoes.map(transacao => (
            <TransactionCard key={transacao.id} transacao={transacao} />
          ))}
        </div>
      </section>

      {/* Floating Action Button para Nova Transação */}
      <button className="fab-new-transaction" onClick={() => setModalOpen(true)}>
        +
      </button>

      {modalOpen && (
        <ModalTransacao onClose={() => setModalOpen(false)}>
          <NovaTransacaoForm onClose={() => setModalOpen(false)} />
        </ModalTransacao>
      )}
    </div>
  );
};

export default Home;
