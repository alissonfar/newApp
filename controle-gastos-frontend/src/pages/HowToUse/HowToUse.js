import React from 'react';
import { FaUserCog, FaMoneyBillWave, FaChartLine, FaClipboardList, FaUserTie, FaInfoCircle, FaMagic } from 'react-icons/fa';
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

        <div className="step-card">
          <div className="step-icon">
            <FaMagic />
          </div>
          <h2>6. Automatize com Regras</h2>
          <p>Configure regras para automatizar a gestão de suas transações.</p>
          <div className="step-details">
            <h3>Como configurar regras:</h3>
            <ul>
              <li>Acesse a seção "Regras de Automação" no menu</li>
              <li>Clique em "Nova Regra" para criar uma automação</li>
              <li>Defina um nome e descrição para sua regra</li>
              <li>Configure as condições que ativam a regra:
                <ul>
                  <li>Escolha os campos (tipo, valor, data, tags, status, participante)</li>
                  <li>Selecione os operadores (igual, diferente, maior, menor, contém)</li>
                  <li>Defina os valores para comparação</li>
                </ul>
              </li>
              <li>Escolha as ações a serem executadas:
                <ul>
                  <li>Adicionar ou remover tags</li>
                  <li>Alterar o status da transação</li>
                  <li>Modificar o valor</li>
                </ul>
              </li>
            </ul>
            <h3>Como usar as regras:</h3>
            <ul>
              <li>Visualize a pré-execução clicando no ícone de "Prévia"</li>
              <li>Confirme a execução após revisar as alterações</li>
              <li>Desfaça a última execução se necessário</li>
              <li>Edite ou exclua regras existentes conforme necessário</li>
            </ul>
            <h3>Dicas de uso:</h3>
            <ul>
              <li>Crie regras para categorizar transações automaticamente</li>
              <li>Use regras para marcar pagamentos recorrentes</li>
              <li>Automatize a atualização de status de transações</li>
              <li>Combine múltiplas condições usando operadores "E" ou "OU"</li>
              <li>Sempre revise as alterações na prévia antes de executar</li>
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