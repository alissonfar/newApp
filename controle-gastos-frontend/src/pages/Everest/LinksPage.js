import React from 'react';
import { Link } from 'react-router-dom';
import { FaLink, FaSearch, FaPlus, FaClock, FaBookmark, FaTag } from 'react-icons/fa';
import LinksManager from '../../components/Everest/LinksManager';
import './EverestPage.css';

const LinksPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center text-sm text-gray-500 mb-4 breadcrumb-nav">
        <Link to="/everest" className="hover:text-blue-600 breadcrumb-link">Ferramentas Everest</Link>
        <span className="mx-2 breadcrumb-separator">›</span>
        <span className="text-blue-600 font-medium breadcrumb-current">Repositório de Links</span>
      </nav>

      {/* Banner de cabeçalho estilizado */}
      <div className="links-header-banner">
        <div className="links-header-decoration"></div>
        <div className="links-header-decoration-2"></div>
        
        <div className="links-icon-container">
          <div className="links-icon">
            <FaLink size={28} />
          </div>
        </div>
        
        <div className="links-header-content">
          <h1>Repositório de Links</h1>
          <p>
            Salve e acesse links importantes rapidamente para uso futuro.
            Organize com tags, adicione descrições e tenha tudo ao seu alcance.
          </p>
          
          <div className="links-header-features">
            <div className="links-header-feature">
              <FaBookmark className="links-feature-icon" />
              <span>Salve seus favoritos</span>
            </div>
            <div className="links-header-feature">
              <FaTag className="links-feature-icon" />
              <span>Organize com tags</span>
            </div>
            <div className="links-header-feature">
              <FaClock className="links-feature-icon" />
              <span>Acesso rápido</span>
            </div>
          </div>
        </div>
      </div>

      {/* Container principal e LinksManager */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <LinksManager />
      </section>
    </div>
  );
};

export default LinksPage; 