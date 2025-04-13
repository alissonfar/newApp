import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import NotesManager from '../../components/Everest/NotesManager';
import './EverestPage.css';

const NotesPage = () => {
  // Função para remover SVGs indesejados
  useEffect(() => {
    const removeLargeSVGs = () => {
      // Remove SVGs gigantes de acordo com seletores específicos
      const svgSelectors = [
        // Seletores mais específicos para SVGs problemáticos
        'svg[width="298.38"][height="596.75"]',
        'svg[viewBox="0 0 24 20"]'
      ];

      svgSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(svg => {
          if (!svg.closest('.notes-icon, .notes-add-button, .notes-search-icon, .note-action-button, .everest-tool-icon')) {
            // Oculta o SVG em vez de removê-lo completamente
            svg.style.display = 'none';
            svg.style.visibility = 'hidden';
            svg.style.opacity = '0';
          }
        });
      });
    };

    // Executa imediatamente
    removeLargeSVGs();

    // Configura um MutationObserver para continuar removendo conforme a página muda
    const observer = new MutationObserver(removeLargeSVGs);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation com botão de voltar destacado */}
      <div className="flex items-center justify-between mb-4">
        <nav className="breadcrumb-nav">
          <Link to="/everest" className="breadcrumb-link">Ferramentas Everest</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Gerenciador de Notas</span>
        </nav>
        
        <Link 
          to="/everest" 
          className="back-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style={{width: '16px', height: '16px', minWidth: '16px', minHeight: '16px'}}>
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          <span>Voltar</span>
        </Link>
      </div>

      {/* Banner header aprimorado com decorações e elementos visuais */}
      <div className="notes-header-banner">
        <div className="notes-header-decoration"></div>
        <div className="notes-header-decoration-2"></div>
        
        <div className="notes-icon-container">
          <div className="notes-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 20 20" fill="currentColor" style={{width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', maxWidth: '32px', maxHeight: '32px'}}>
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </div>
        </div>
        
        <div className="notes-header-content">
          <h1>Gerenciador de Notas</h1>
          <p>
            Crie e organize suas anotações de trabalho para consulta rápida. 
            Adicione tags para categorizar e encontre facilmente o que precisa com a busca integrada.
          </p>
          <div className="notes-header-features">
            <div className="notes-header-feature">
              <span className="notes-feature-icon">🔍</span>
              <span>Busca rápida</span>
            </div>
            <div className="notes-header-feature">
              <span className="notes-feature-icon">🏷️</span>
              <span>Organização por tags</span>
            </div>
            <div className="notes-header-feature">
              <span className="notes-feature-icon">💾</span>
              <span>Salvamento automático</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content - Container com sombra e cantos arredondados */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <NotesManager />
      </section>
    </div>
  );
};

export default NotesPage; 