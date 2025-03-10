import React from 'react';
import { FaUserCog, FaMoneyBillWave, FaChartLine, FaClipboardList, FaUserTie, FaInfoCircle } from 'react-icons/fa';
import './HowToUse.css';

const HowToUse = () => {
  return (
    <div className="how-to-use-container">
      <header className="how-to-use-header">
        <FaInfoCircle className="header-icon" />
        <h1>Como Utilizar o Sistema</h1>
        <p>Siga este guia passo a passo para aproveitar ao máximo nosso sistema de controle de gastos</p>
      </header>

      <div className="steps-container">
        <div className="step-card">
          <div className="step-icon">
            <FaUserCog />
          </div>
          <h2>1. Configure seu Perfil</h2>
          <p>Acesse as configurações do seu perfil e preencha suas informações básicas.</p>
          <div className="step-details">
            <h3>Como fazer:</h3>
            <ul>
              <li>Clique no ícone do seu perfil no canto superior direito</li>
              <li>Selecione "Perfil"</li>
              <li>Preencha seus dados pessoais</li>
              <li>Salve as alterações</li>
            </ul>
          </div>
        </div>

        <div className="step-card">
          <div className="step-icon">
            <FaUserTie />
          </div>
          <h2>2. Defina o Proprietário</h2>
          <p>Configure o proprietário principal do sistema para gerenciar as transações.</p>
          <div className="step-details">
            <h3>Como fazer:</h3>
            <ul>
              <li>Acesse seu perfil</li>
              <li>Vá para a aba "Preferências"</li>
              <li>Digite o nome do proprietário</li>
              <li>Salve as alterações</li>
            </ul>
          </div>
        </div>

        <div className="step-card">
          <div className="step-icon">
            <FaMoneyBillWave />
          </div>
          <h2>3. Registre Transações</h2>
          <p>Comece a registrar suas transações financeiras.</p>
          <div className="step-details">
            <h3>Como fazer:</h3>
            <ul>
              <li>Clique em "Nova Transação" no dashboard</li>
              <li>Selecione o tipo: Gasto ou Recebível</li>
              <li>Preencha o valor e a descrição</li>
              <li>Adicione os participantes e seus valores</li>
              <li>Confirme a transação</li>
            </ul>
          </div>
        </div>

        <div className="step-card">
          <div className="step-icon">
            <FaChartLine />
          </div>
          <h2>4. Acompanhe seu Dashboard</h2>
          <p>Monitore suas finanças através do dashboard interativo.</p>
          <div className="step-details">
            <h3>O que você encontra:</h3>
            <ul>
              <li>Resumo mensal de gastos e recebíveis</li>
              <li>Gráfico de evolução financeira</li>
              <li>Calendário com marcações de transações</li>
              <li>Lista das últimas transações</li>
            </ul>
          </div>
        </div>

        <div className="step-card">
          <div className="step-icon">
            <FaClipboardList />
          </div>
          <h2>5. Utilize as Notas</h2>
          <p>Mantenha suas anotações importantes sempre à mão.</p>
          <div className="step-details">
            <h3>Como usar:</h3>
            <ul>
              <li>Localize a seção "Notas Rápidas" no dashboard</li>
              <li>Digite sua nota no campo de texto</li>
              <li>Pressione enter ou clique no botão para salvar</li>
              <li>Gerencie suas notas conforme necessário</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="tips-section">
        <h2>💡 Dicas Importantes</h2>
        <ul>
          <li>Mantenha suas transações sempre atualizadas para um controle mais preciso</li>
          <li>Utilize as tags para melhor organização das transações</li>
          <li>Confira regularmente o relatório mensal para acompanhar sua evolução</li>
          <li>Mantenha o proprietário configurado corretamente para visualizar todas as transações</li>
        </ul>
      </div>
    </div>
  );
};

export default HowToUse; 