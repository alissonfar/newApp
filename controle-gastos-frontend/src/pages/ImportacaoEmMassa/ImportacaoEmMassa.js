import React from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import ImportarTransacoesForm from '../../components/Transaction/ImportarTransacoesForm';
import './ImportacaoEmMassa.css';

const ImportacaoEmMassa = () => {
  const navigate = useNavigate();
  
  // Handler para quando a importação for concluída com sucesso
  const handleImportacaoSuccess = () => {
    toast.success('Transações importadas com sucesso!');
    navigate('/relatorio'); // Redireciona para a página de transações após sucesso
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