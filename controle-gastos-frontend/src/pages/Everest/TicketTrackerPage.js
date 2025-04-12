import React from 'react';
import { Link } from 'react-router-dom';
import TicketInfoTracker from '../../components/Everest/TicketInfoTracker';
import './EverestPage.css';

const TicketTrackerPage = () => {
  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-6 everest-page">
      {/* Breadcrumb navigation */}
      <nav className="flex items-center text-sm text-gray-500 mb-4">
        <Link to="/everest" className="hover:text-blue-600">Ferramentas Everest</Link>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-blue-600 font-medium">Rastreador de Informações</span>
      </nav>

      {/* Page header */}
      <header className="border-b border-blue-200 pb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-lg mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-700">
            Rastreador de Informações
          </h1>
        </div>
        <p className="text-gray-600 mt-2 ml-11">
          Acompanhe informações importantes de tickets e mantenha-se organizado.
        </p>
      </header>

      {/* Main content */}
      <section className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
        <TicketInfoTracker />
      </section>
    </div>
  );
};

export default TicketTrackerPage; 