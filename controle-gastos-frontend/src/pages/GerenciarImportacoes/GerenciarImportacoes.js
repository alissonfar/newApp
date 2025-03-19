import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaTrash, FaEdit, FaUndo, FaDownload, FaEye } from 'react-icons/fa';
import api from '../../services/api';
import './GerenciarImportacoes.css';

const GerenciarImportacoes = () => {
  // Estados
  const [importacoes, setImportacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas'); // 'todas', 'recentes', 'antigas'
  
  // Função para carregar as importações do backend
  const carregarImportacoes = async () => {
    setLoading(true);
    try {
      // Aqui você chamaria sua API real
      // Por enquanto, vamos usar dados mockados
      const mockData = [
        {
          id: '1',
          dataImportacao: '2023-10-15T10:30:00Z',
          usuario: 'João Silva',
          quantidadeTransacoes: 12,
          status: 'ativo',
          nome: 'Importação de Outubro',
          origem: 'CSV'
        },
        {
          id: '2',
          dataImportacao: '2023-09-20T14:15:00Z',
          usuario: 'João Silva',
          quantidadeTransacoes: 8,
          status: 'ativo',
          nome: 'Importação de Setembro',
          origem: 'JSON'
        },
        {
          id: '3',
          dataImportacao: '2023-08-05T09:45:00Z',
          usuario: 'João Silva',
          quantidadeTransacoes: 5,
          status: 'estornado',
          nome: 'Importação de Agosto',
          origem: 'Manual'
        }
      ];
      
      // Simulando um atraso de rede
      setTimeout(() => {
        setImportacoes(mockData);
        setLoading(false);
      }, 500);
      
      // Na implementação real, seria algo como:
      // const response = await api.get('/importacoes');
      // setImportacoes(response.data);
      // setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar importações:', error);
      toast.error('Erro ao carregar histórico de importações.');
      setLoading(false);
    }
  };
  
  // Carregar importações ao montar o componente
  useEffect(() => {
    carregarImportacoes();
  }, []);
  
  // Função para filtrar as importações
  const importacoesFiltradas = () => {
    if (filtro === 'todas') return importacoes;
    
    const hoje = new Date();
    const umMesAtras = new Date();
    umMesAtras.setMonth(hoje.getMonth() - 1);
    
    if (filtro === 'recentes') {
      return importacoes.filter(imp => new Date(imp.dataImportacao) >= umMesAtras);
    } else if (filtro === 'antigas') {
      return importacoes.filter(imp => new Date(imp.dataImportacao) < umMesAtras);
    }
    
    return importacoes;
  };
  
  // Função para estornar uma importação
  const estornarImportacao = async (id) => {
    if (!window.confirm('Tem certeza que deseja estornar esta importação? Todas as transações associadas serão marcadas como estornadas.')) {
      return;
    }
    
    try {
      // Na implementação real
      // await api.put(`/importacoes/${id}/estornar`);
      
      // Mock: atualiza o estado localmente
      setImportacoes(prev => 
        prev.map(imp => 
          imp.id === id ? { ...imp, status: 'estornado' } : imp
        )
      );
      
      toast.success('Importação estornada com sucesso!');
    } catch (error) {
      console.error('Erro ao estornar importação:', error);
      toast.error('Erro ao estornar importação.');
    }
  };
  
  // Função para baixar relatório da importação
  const baixarRelatorio = (id) => {
    toast.info('Relatório sendo gerado, aguarde o download...');
    // Na implementação real, isso chamaria a API que retornaria um arquivo
    // window.open(`/api/importacoes/${id}/relatorio`, '_blank');
  };
  
  // Função para formatar a data
  const formatarData = (dataString) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="gerenciar-importacoes-container">
      <h1>Gerenciamento de Importações</h1>
      
      <div className="importacoes-actions">
        <div className="filtros">
          <label>Filtrar por:</label>
          <select 
            value={filtro} 
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="todas">Todas as importações</option>
            <option value="recentes">Importações recentes</option>
            <option value="antigas">Importações antigas</option>
          </select>
        </div>
        
        <button onClick={carregarImportacoes} className="refresh-btn">
          Atualizar
        </button>
      </div>
      
      {loading ? (
        <div className="loading">Carregando histórico de importações...</div>
      ) : importacoesFiltradas().length === 0 ? (
        <div className="no-data">Nenhuma importação encontrada.</div>
      ) : (
        <div className="importacoes-list">
          <table className="importacoes-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Data</th>
                <th>Transações</th>
                <th>Origem</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {importacoesFiltradas().map(importacao => (
                <tr key={importacao.id} className={importacao.status === 'estornado' ? 'estornado' : ''}>
                  <td>{importacao.nome}</td>
                  <td>{formatarData(importacao.dataImportacao)}</td>
                  <td>{importacao.quantidadeTransacoes}</td>
                  <td>{importacao.origem}</td>
                  <td>
                    <span className={`status-badge ${importacao.status}`}>
                      {importacao.status === 'ativo' ? 'Ativo' : 'Estornado'}
                    </span>
                  </td>
                  <td className="acoes">
                    <button
                      title="Ver detalhes"
                      className="action-btn view-btn"
                      onClick={() => toast.info('Função de visualização detalhada em desenvolvimento')}
                    >
                      <FaEye />
                    </button>
                    
                    <button
                      title="Baixar relatório"
                      className="action-btn download-btn"
                      onClick={() => baixarRelatorio(importacao.id)}
                    >
                      <FaDownload />
                    </button>
                    
                    {importacao.status === 'ativo' && (
                      <button
                        title="Estornar importação"
                        className="action-btn undo-btn"
                        onClick={() => estornarImportacao(importacao.id)}
                      >
                        <FaUndo />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="info-section">
        <h3>Informações sobre importações</h3>
        <p>
          As importações em massa são agrupadas e podem ser gerenciadas por este painel. 
          Você pode estornar todas as transações de uma importação ou baixar relatórios detalhados.
        </p>
        <ul>
          <li><strong>Estornar importação:</strong> Marca todas as transações como estornadas, mas mantém o histórico.</li>
          <li><strong>Baixar relatório:</strong> Gera um arquivo CSV com todas as transações da importação.</li>
        </ul>
      </div>
    </div>
  );
};

export default GerenciarImportacoes; 