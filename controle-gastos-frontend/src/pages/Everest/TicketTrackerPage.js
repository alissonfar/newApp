import React from 'react';
import { Link } from 'react-router-dom';
import { FaTicketAlt, FaSearch, FaPlus, FaClipboardList, FaInfo, FaExchangeAlt } from 'react-icons/fa';
import TicketInfoTracker from '../../components/Everest/TicketInfoTracker';
import './EverestPage.css';

const TicketTrackerPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center text-sm text-gray-500 mb-4 breadcrumb-nav">
        <Link to="/everest" className="hover:text-blue-600 breadcrumb-link">Ferramentas Everest</Link>
        <span className="mx-2 breadcrumb-separator">›</span>
        <span className="text-blue-600 font-medium breadcrumb-current">Rastreador de Informações</span>
      </nav>

      {/* Banner de cabeçalho estilizado */}
      <div className="ticket-header-banner">
        <div className="ticket-header-decoration"></div>
        <div className="ticket-header-decoration-2"></div>
        
        <div className="ticket-icon-container">
          <div className="ticket-icon">
            <FaTicketAlt size={28} />
          </div>
        </div>
        
        <div className="ticket-header-content">
          <h1>Rastreador de Informações</h1>
          <p>
            Acompanhe informações importantes de tickets e mantenha-se organizado.
            Registre status, passos de reprodução e detalhes de chamados em um só lugar.
          </p>
          
          <div className="ticket-header-features">
            <div className="ticket-header-feature">
              <FaInfo className="ticket-feature-icon" />
              <span>Registre detalhes</span>
            </div>
            <div className="ticket-header-feature">
              <FaExchangeAlt className="ticket-feature-icon" />
              <span>Acompanhe status</span>
            </div>
            <div className="ticket-header-feature">
              <FaClipboardList className="ticket-feature-icon" />
              <span>Organize chamados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Container principal e TicketInfoTracker */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <TicketInfoTracker />
      </section>
    </div>
  );
};

export default TicketTrackerPage; 