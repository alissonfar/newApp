import React from 'react';
import NotesManager from '../../components/Everest/NotesManager';
import LinksManager from '../../components/Everest/LinksManager';
import TicketInfoTracker from '../../components/Everest/TicketInfoTracker';
import CnpjAccessTool from '../../components/Everest/CnpjAccessTool';
import XmlProcessorTool from '../../components/Everest/XmlProcessorTool';

// Página principal para as Ferramentas Everest
const EverestPage = () => {
  return (
    // Aumentar espaçamento geral e padding da página
    <div className="p-6 md:p-8 lg:p-10 space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
        Ferramentas Everest
      </h1>
      
      {/* Os componentes filhos terão mt-0 e p-6 */}
      <NotesManager />
      <LinksManager />
      <TicketInfoTracker />
      <CnpjAccessTool />
      <XmlProcessorTool />

      {/* Outros componentes de ferramentas serão adicionados abaixo */}
      {/* Exemplo:
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Outra Ferramenta</h2>
        <p>Conteúdo da outra ferramenta...</p>
      </div> 
      */}
    </div>
  );
};

export default EverestPage; 