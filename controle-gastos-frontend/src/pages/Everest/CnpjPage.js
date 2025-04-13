import React from 'react';
import { Link } from 'react-router-dom';
import CnpjAccessTool from '../../components/Everest/CnpjAccessTool';
import { FaBuilding, FaArrowLeft } from 'react-icons/fa';
import './EverestPage.css';

const CnpjPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="breadcrumb-nav">
        <Link to="/everest" className="breadcrumb-link">Ferramentas Everest</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">Consulta de CNPJ</span>
      </nav>

      {/* Botão de voltar */}
      <Link to="/everest" className="back-button">
        <FaArrowLeft />
        <span>Voltar para Ferramentas</span>
      </Link>

      {/* Header Banner */}
      <div className="cnpj-header-banner">
        <div className="cnpj-header-decoration"></div>
        <div className="cnpj-header-decoration-2"></div>
        
        <div className="cnpj-icon-container">
          <div className="cnpj-icon">
            <FaBuilding />
          </div>
        </div>
        
        <div className="cnpj-header-content">
          <h1>Consulta de CNPJ</h1>
          <p>Acesse informações de empresas através do número de CNPJ ou atualize a base de dados.</p>
        </div>
      </div>

      {/* Main content */}
      <section>
        <CnpjAccessTool />
      </section>
    </div>
  );
};

export default CnpjPage; 