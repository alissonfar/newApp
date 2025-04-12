import React from 'react';
import { Link } from 'react-router-dom';
import './EverestPage.css';

// Página principal para as Ferramentas Everest (agora como hub de navegação)
const EverestPage = () => {
  // Lista de ferramentas disponíveis
  const ferramentas = [
    {
      id: 'notes',
      title: 'Gerenciador de Notas',
      description: 'Crie e organize suas anotações de trabalho.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      ),
    },
    {
      id: 'links',
      title: 'Repositório de Links',
      description: 'Salve e acesse links importantes rapidamente.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'ticket-tracker',
      title: 'Rastreador de Informações',
      description: 'Acompanhe informações importantes de tickets.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'cnpj',
      title: 'Consulta de CNPJ',
      description: 'Acesse informações de empresas através do CNPJ.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'xml',
      title: 'Processador de XML',
      description: 'Extraia e processe informações de arquivos XML.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-8 everest-page">
      {/* Cabeçalho da página */}
      <header className="border-b border-blue-200 pb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-blue-700">
          Ferramentas Everest
        </h1>
        <p className="text-gray-600 mt-2">
          Utilitários e ferramentas para aumentar sua produtividade na plataforma.
        </p>
      </header>
      
      {/* Grid de cards de navegação para as ferramentas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {ferramentas.map((ferramenta) => (
          <Link 
            key={ferramenta.id}
            to={`/everest/${ferramenta.id}`}
            className="group no-underline"
          >
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 hover:shadow-lg transition-all duration-300 h-full flex flex-col hover:border-blue-300 group-hover:scale-[1.02]">
              <div className="flex items-center mb-3">
                <span className="text-blue-600 bg-blue-100 p-2 rounded-lg mr-3">
                  {ferramenta.icon}
                </span>
                <h2 className="text-xl font-semibold text-blue-600">
                  {ferramenta.title}
                </h2>
              </div>
              <p className="text-gray-600 mt-2 flex-grow">
                {ferramenta.description}
              </p>
              <div className="mt-4 text-blue-600 font-medium flex items-center">
                <span>Acessar</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Rodapé com informações adicionais */}
      <footer className="mt-10 text-center text-gray-500 text-sm">
        <p>Ferramentas Everest v1.0 - Para suporte, contate o administrador do sistema</p>
      </footer>
    </div>
  );
};

export default EverestPage; 