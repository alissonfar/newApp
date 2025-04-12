import React from 'react';
import { Link } from 'react-router-dom';
import NotesManager from '../../components/Everest/NotesManager';
import './EverestPage.css';

const NotesPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center text-sm text-gray-500 mb-4">
        <Link to="/everest" className="hover:text-blue-600">Ferramentas Everest</Link>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-blue-600 font-medium">Gerenciador de Notas</span>
      </nav>

      {/* Page header */}
      <header className="border-b border-blue-200 pb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-lg mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-700">
            Gerenciador de Notas
          </h1>
        </div>
        <p className="text-gray-600 mt-2 ml-11">
          Crie e organize suas anotações de trabalho para consulta rápida.
        </p>
      </header>

      {/* Main content */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <NotesManager />
      </section>
    </div>
  );
};

export default NotesPage; 