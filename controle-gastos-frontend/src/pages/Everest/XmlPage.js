import React from 'react';
import { Link } from 'react-router-dom';
import XmlProcessorTool from '../../components/Everest/XmlProcessorTool';
import './EverestPage.css';

const XmlPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center text-sm text-gray-500 mb-4">
        <Link to="/everest" className="hover:text-blue-600">Ferramentas Everest</Link>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-blue-600 font-medium">Processador de XML</span>
      </nav>

      {/* Page header */}
      <header className="border-b border-blue-200 pb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-lg mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-700">
            Processador de XML
          </h1>
        </div>
        <p className="text-gray-600 mt-2 ml-11">
          Extraia e processe informações de arquivos XML de forma eficiente.
        </p>
      </header>

      {/* Main content */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <XmlProcessorTool />
      </section>
    </div>
  );
};

export default XmlPage; 