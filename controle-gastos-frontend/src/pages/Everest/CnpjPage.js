import React from 'react';
import { Link } from 'react-router-dom';
import CnpjAccessTool from '../../components/Everest/CnpjAccessTool';
import './EverestPage.css';

const CnpjPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center text-sm text-gray-500 mb-4">
        <Link to="/everest" className="hover:text-blue-600">Ferramentas Everest</Link>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-blue-600 font-medium">Consulta de CNPJ</span>
      </nav>

      {/* Page header */}
      <header className="border-b border-blue-200 pb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-lg mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-700">
            Consulta de CNPJ
          </h1>
        </div>
        <p className="text-gray-600 mt-2 ml-11">
          Acesse informações de empresas através do número de CNPJ.
        </p>
      </header>

      {/* Main content */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <CnpjAccessTool />
      </section>
    </div>
  );
};

export default CnpjPage; 