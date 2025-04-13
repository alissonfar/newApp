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
      description: 'Crie e organize suas anotações de trabalho para consulta rápida e eficiente. Categorize com tags e encontre rapidamente o que precisa.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
        </svg>
      ),
    },
    {
      id: 'links',
      title: 'Repositório de Links',
      description: 'Salve e acesse links importantes rapidamente. Nunca mais perca aquele recurso valioso que você encontrou online.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'ticket-tracker',
      title: 'Rastreador de Informações',
      description: 'Acompanhe informações importantes de tickets e mantenha-se organizado. Nunca mais perca o contexto de um atendimento importante.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'cnpj',
      title: 'Consulta de CNPJ',
      description: 'Acesse informações de empresas através do CNPJ. Upload de planilhas e consultas rápidas em uma única ferramenta.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'xml',
      title: 'Processador de XML',
      description: 'Extraia e processe informações de arquivos XML de forma eficiente. Visualize resumos e obtenha os dados que precisa rapidamente.',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-8 everest-page">
      {/* Banner de cabeçalho aprimorado */}
      <div className="header-banner">
        <div className="header-icon">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
            <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
          </svg>
        </div>
        <h1>Ferramentas Everest</h1>
        <p>
          Utilitários e ferramentas especializadas para aumentar sua produtividade na plataforma.
          Acesse recursos exclusivos para otimizar seu trabalho diário.
        </p>
      </div>
      
      {/* Grid de cards de navegação para as ferramentas */}
      <div className="everest-tools-grid">
        {ferramentas.map((ferramenta) => (
          <Link 
            key={ferramenta.id}
            to={`/everest/${ferramenta.id}`}
            className="no-underline"
          >
            <div className="everest-tool-card">
              <div className="everest-tool-icon">
                {ferramenta.icon}
              </div>
              <h3>{ferramenta.title}</h3>
              <p>{ferramenta.description}</p>
              <div className="everest-tool-footer">
                <span className="access-btn">
                  Acessar
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Rodapé com informações adicionais */}
      <footer className="page-footer">
        <p>Ferramentas Everest v1.0 - Acesso exclusivo para a equipe de suporte</p>
        <p className="mt-1 text-xs">Para suporte, contate o administrador do sistema</p>
      </footer>
    </div>
  );
};

export default EverestPage; 