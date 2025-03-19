import React, { useState, useContext } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import ImportarTransacoesForm from '../../components/Transaction/ImportarTransacoesForm';
import './ImportacaoEmMassa.css';

const ImportacaoEmMassa = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  // Handler para quando a importação for concluída com sucesso
  const handleImportacaoSuccess = () => {
    toast.success('Transações importadas com sucesso!');
    navigate('/transacoes'); // Redireciona para a página de transações após sucesso
  };

  return (
    <div className="importacao-em-massa-container">
      <h1>Importação em Massa de Transações</h1>
      
      <div className="importacao-descricao">
        <p>
          Importe várias transações de uma só vez usando arquivos CSV, JSON ou criando manualmente.
          Edite cada transação com a mesma interface utilizada no lançamento individual antes do envio final.
        </p>
      </div>
      
      <div className="importacao-form-container">
        <ImportarTransacoesForm 
          onSuccess={handleImportacaoSuccess}
          onClose={() => navigate('/transacoes')}
          standalonePage={true}
        />
      </div>
    </div>
  );
};

export default ImportacaoEmMassa; 