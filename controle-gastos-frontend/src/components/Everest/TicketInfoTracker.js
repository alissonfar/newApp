import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaTimes, FaSpinner, FaTicketAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  obterInfosChamados,
  criarInfoChamado,
  atualizarInfoChamado,
  excluirInfoChamado
} from '../../api'; // Importar API

// Mock de status (pode vir da API no futuro)
const ticketStatuses = ['Novo', 'Em Análise', 'Aguardando Cliente', 'Resolvido', 'Fechado'];

// Componente Modal para Info Chamados
const TicketInfoModal = ({ isOpen, onClose, onSave, ticket }) => {
  const [externalId, setExternalId] = useState('');
  const [client, setClient] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState(ticketStatuses[0]); // Default to first status
  const [steps, setSteps] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({}); // Para validação

  useEffect(() => {
    if (ticket) {
      setExternalId(ticket.externalId || '');
      setClient(ticket.client || '');
      setSummary(ticket.summary || '');
      setStatus(ticket.status || ticketStatuses[0]);
      setSteps(ticket.steps || '');
      setErrors({}); // Limpa erros ao abrir/mudar ticket
    } else {
      setExternalId('');
      setClient('');
      setSummary('');
      setStatus(ticketStatuses[0]);
      setSteps('');
      setErrors({});
    }
  }, [ticket]);

  if (!isOpen) return null;

  // Validação simples
  const validateForm = () => {
    const newErrors = {};
    if (!summary.trim()) {
      newErrors.summary = 'O resumo é obrigatório.';
    }
    // Adicionar mais validações se necessário
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInternalSave = async () => {
    if (!validateForm()) {
      toast.warn('Por favor, corrija os erros no formulário.')
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        externalId,
        client,
        summary,
        status,
        steps,
      });
    } catch (error) {
      console.error("Erro ao salvar ticket no modal:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ticket-modal-overlay">
      <div className="ticket-modal">
        <div className="ticket-modal-header">
          <h3 className="ticket-modal-title">{ticket ? 'Editar Informação do Chamado' : 'Adicionar Informação do Chamado'}</h3>
          <button onClick={onClose} className="ticket-modal-close" disabled={isSaving}>
            <FaTimes />
          </button>
        </div>
        
        <div className="ticket-modal-body">
          {/* ID Externo */}
          <div className="ticket-form-group">
            <label htmlFor="ticket-externalId" className="ticket-form-label">ID Externo (INC/SR)</label>
            <input 
              id="ticket-externalId" 
              type="text" 
              value={externalId} 
              onChange={(e) => setExternalId(e.target.value)} 
              className="ticket-form-input" 
              placeholder="Ex: INC123456" 
              disabled={isSaving}
            />
          </div>
          
          {/* Cliente */}
          <div className="ticket-form-group">
            <label htmlFor="ticket-client" className="ticket-form-label">Cliente</label>
            <input 
              id="ticket-client" 
              type="text" 
              value={client} 
              onChange={(e) => setClient(e.target.value)} 
              className="ticket-form-input" 
              placeholder="Nome do cliente" 
              disabled={isSaving}
            />
          </div>
          
          {/* Resumo */}
          <div className="ticket-form-group">
            <label htmlFor="ticket-summary" className="ticket-form-label">Resumo*</label>
            <input 
              id="ticket-summary"
              type="text" 
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={`ticket-form-input ${errors.summary ? 'border-red-500' : ''}`}
              placeholder="Breve descrição do chamado"
              required 
              disabled={isSaving}
            />
            {errors.summary && <p className="ticket-form-error">{errors.summary}</p>}
          </div>
          
          {/* Status */}
          <div className="ticket-form-group">
            <label htmlFor="ticket-status" className="ticket-form-label">Status</label>
            <select 
              id="ticket-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="ticket-form-select" 
              disabled={isSaving}
            >
              {ticketStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          {/* Passos/Detalhes */}
          <div className="ticket-form-group">
            <label htmlFor="ticket-steps" className="ticket-form-label">Passos/Detalhes</label>
            <textarea 
              id="ticket-steps"
              rows="5"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="ticket-form-textarea"
              placeholder="Detalhes, passos de reprodução, links úteis..."
              disabled={isSaving}
            ></textarea>
          </div>
        </div>
        
        <div className="ticket-modal-footer">
          <button onClick={onClose} className="ticket-cancel-button" disabled={isSaving}>
            Cancelar
          </button>
          <button onClick={handleInternalSave} className="ticket-save-button" disabled={isSaving}>
            {isSaving ? <FaSpinner className="animate-spin mr-2"/> : null}
            {isSaving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Funções Auxiliares (ex: getStatusColor - mantida)
const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'novo': return 'bg-blue-100 text-blue-800';
    case 'em análise': return 'bg-yellow-100 text-yellow-800';
    case 'aguardando cliente': return 'bg-orange-100 text-orange-800';
    case 'resolvido': return 'bg-green-100 text-green-800';
    case 'fechado': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const TicketInfoTracker = () => {
  const [tickets, setTickets] = useState([]); // Iniciar vazio
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Função para buscar tickets
  const fetchTickets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Implementar busca via API
      const data = await obterInfosChamados();
      setTickets(data);
    } catch (err) {
      console.error("Erro ao buscar informações de chamados:", err);
      setError('Falha ao carregar informações. Tente novamente.');
      toast.error('Falha ao carregar informações.');
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar ao montar
  useEffect(() => {
    fetchTickets();
  }, []);

  const handleAddTicket = () => {
    setCurrentTicket(null);
    setIsModalOpen(true);
  };

  const handleEditTicket = (ticket) => {
    setCurrentTicket(ticket);
    setIsModalOpen(true);
  };

  const handleDeleteTicket = async (ticketId) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      setIsProcessing(true);
      try {
        await excluirInfoChamado(ticketId);
        toast.success('Registro excluído com sucesso!');
        fetchTickets(); // Recarrega
      } catch (err) {
        console.error("Erro ao excluir registro:", err);
        toast.error('Falha ao excluir registro.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentTicket(null);
  };

  const handleSaveTicket = async (ticketDataFromModal) => {
    try {
      let savedTicket;
      if (currentTicket?._id) {
        savedTicket = await atualizarInfoChamado(currentTicket._id, ticketDataFromModal);
        toast.success('Registro atualizado com sucesso!');
      } else {
        savedTicket = await criarInfoChamado(ticketDataFromModal);
        toast.success('Novo registro adicionado com sucesso!');
      }
      console.log('Registro salvo (API Mock):', savedTicket);
      handleCloseModal();
      fetchTickets(); // Recarrega
    } catch (err) {
      console.error("Erro ao salvar registro:", err);
      toast.error(`Falha ao salvar registro: ${err.message || 'Erro desconhecido'}`);
      throw err; // Propaga para o modal
    }
  };

  // Filtragem local
  const filteredTickets = tickets.filter(ticket => 
    (ticket.externalId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (ticket.client?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (ticket.summary?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
        <div className="ticket-search-bar w-full sm:w-auto flex-grow">
          <input 
            type="text"
            placeholder="Buscar por ID, Cliente, Resumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ticket-search-input"
          />
        </div>
        <button 
          onClick={handleAddTicket}
          className="ticket-add-button"
        >
          <FaPlus className="mr-1" /> Adicionar Registro
        </button>
      </div>

      {isLoading && (
        <div className="ticket-loading">
          <FaSpinner className="ticket-spinner" />
          <p>Carregando registros...</p>
        </div>
      )}
      
      {error && !isLoading && (
        <div className="text-center py-4 text-red-600 bg-red-50 p-3 rounded border border-red-200">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          {filteredTickets.length > 0 ? (
            <table className="ticket-table w-full">
              <thead className="ticket-table-header">
                <tr>
                  <th className="px-4 py-3 text-left">ID Externo</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Resumo</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="ticket-table-body">
                {filteredTickets.map(ticket => (
                  <tr key={ticket._id} className={isProcessing ? 'opacity-50' : ''}>
                    <td className="px-4 py-3 whitespace-nowrap">{ticket.externalId || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{ticket.client || '-'}</td>
                    <td className="px-4 py-3 max-w-xs truncate" title={ticket.summary}>{ticket.summary}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`ticket-status ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="ticket-actions">
                        <button 
                          onClick={() => handleEditTicket(ticket)} 
                          className="ticket-action-button ticket-edit-button" 
                          title="Editar" 
                          disabled={isProcessing}
                        >
                          <FaEdit />
                        </button>
                        <button 
                          onClick={() => handleDeleteTicket(ticket._id)} 
                          className="ticket-action-button ticket-delete-button" 
                          title="Excluir" 
                          disabled={isProcessing}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="ticket-empty-state">
              <FaTicketAlt className="ticket-empty-icon" />
              <p className="ticket-empty-text">Nenhum registro de chamado encontrado.</p>
              <button onClick={handleAddTicket} className="ticket-empty-button">
                <FaPlus className="mr-2" /> Adicionar Primeiro Registro
              </button>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <TicketInfoModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveTicket}
          ticket={currentTicket}
        />
      )}
    </div>
  );
};

export default TicketInfoTracker; 