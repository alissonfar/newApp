// src/pages/Home/Home.js
import React, { useEffect, useState } from 'react';
import { obterTransacoes, obterRelatorio } from '../../api';
import TransactionCard from '../../components/Transaction/TransactionCard';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import './Home.css';

const Home = () => {
  const [transacoes, setTransacoes] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  const carregarRelatorio = async () => {
    try {
      const dados = await obterRelatorio();
      setRelatorio(dados);
    } catch (error) {
      console.error('Erro ao carregar relatório:', error);
    }
  };

  useEffect(() => {
    carregarTransacoes();
    carregarRelatorio();
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
            <span className="user-name">Olá, Alisson</span>
          </div>
        </div>
      </header>

      {/* Cartões de Resumo */}
      <section className="dashboard-cards">
        <div className="card">
          <h3>Gastos</h3>
          <p className="card-value">
            R${relatorio ? Number(relatorio.totalGastos).toFixed(2) : '0.00'}
          </p>
          <p className="card-detail">Variação: +10%</p>
        </div>
        <div className="card">
          <h3>Recebimentos</h3>
          <p className="card-value">
            R${relatorio ? Number(relatorio.totalRecebimentos).toFixed(2) : '0.00'}
          </p>
          <p className="card-detail">Variação: +5%</p>
        </div>
        <div className="card">
          <h3>Saldo</h3>
          <p className="card-value">
            R${relatorio ? Number(relatorio.saldoGeral).toFixed(2) : '0.00'}
          </p>
          <p className="card-detail">Atualizado</p>
        </div>
      </section>

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
