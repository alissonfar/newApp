import React from 'react';
import { Link } from 'react-router-dom';
import XmlProcessorTool from '../../components/Everest/XmlProcessorTool';
import { FaCode, FaArrowLeft } from 'react-icons/fa';
import './EverestPage.css';

const XmlPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="breadcrumb-nav">
        <Link to="/everest" className="breadcrumb-link">Ferramentas Everest</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">Processador de XML</span>
      </nav>

      {/* Botão de voltar */}
      <Link to="/everest" className="back-button">
        <FaArrowLeft />
        <span>Voltar para Ferramentas</span>
      </Link>

      {/* Header Banner */}
      <div className="xml-header-banner">
        <div className="xml-header-decoration"></div>
        <div className="xml-header-decoration-2"></div>
        
        <div className="xml-icon-container">
          <div className="xml-icon">
            <FaCode />
          </div>
        </div>
        
        <div className="xml-header-content">
          <h1>Processador de XML</h1>
          <p>Extraia e processe informações de arquivos XML de forma eficiente. Envie e obtenha um resumo completo das informações contidas nos documentos.</p>
        </div>
      </div>

      {/* Main content */}
      <section>
        <XmlProcessorTool />
      </section>
    </div>
  );
};

export default XmlPage; 