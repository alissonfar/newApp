import React from 'react';
import NovaImportacaoForm from '../../components/ImportacaoMassa/NovaImportacao/NovaImportacaoForm';
import './NovaImportacaoPage.css';

const NovaImportacaoPage = () => {
  return (
    <div className="nova-importacao-page">
      <div className="page-header">
        <h1>Nova Importação</h1>
        <p>Importe suas transações a partir de arquivos JSON ou CSV.</p>
      </div>
      
      <NovaImportacaoForm />
    </div>
  );
};

export default NovaImportacaoPage; 