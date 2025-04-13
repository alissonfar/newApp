import React from 'react';
import { Link } from 'react-router-dom';
import LinksManager from '../../components/Everest/LinksManager';
import './EverestPage.css';

const LinksPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center text-sm text-gray-500 mb-4">
        <Link to="/everest" className="hover:text-blue-600">Ferramentas Everest</Link>
        <span className="mx-2">›</span>
        <span className="text-blue-600 font-medium">Repositório de Links</span>
      </nav>

      {/* Page header */}
      <header className="border-b border-blue-200 pb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-lg mr-3">
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-700">
            Repositório de Links
          </h1>
        </div>
        <p className="text-gray-600 mt-2 ml-11">
          Salve e acesse links importantes rapidamente para uso futuro.
        </p>
      </header>

      {/* Main content */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <LinksManager />
      </section>
    </div>
  );
};

export default LinksPage; 