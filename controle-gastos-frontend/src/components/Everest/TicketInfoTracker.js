import React, { useState, useEffect } from 'react';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaSpinner } from 'react-icons/fa';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pt-1 z-10">
          <h3 className="text-lg font-semibold">{ticket ? 'Editar Informação do Chamado' : 'Adicionar Informação do Chamado'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" disabled={isSaving}>
            <FaTimes />
          </button>
        </div>
        <div className="space-y-4">
          {/* ID Externo */}
          <div>
            <label htmlFor="ticket-externalId" className="block text-sm font-medium text-gray-700 mb-1">ID Externo (INC/SR)</label>
            <input id="ticket-externalId" type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)} className="input-field w-full" placeholder="Ex: INC123456" disabled={isSaving}/>
          </div>
          {/* Cliente */}
          <div>
            <label htmlFor="ticket-client" className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <input id="ticket-client" type="text" value={client} onChange={(e) => setClient(e.target.value)} className="input-field w-full" placeholder="Nome do cliente" disabled={isSaving}/>
          </div>
          {/* Resumo */}
          <div>
            <label htmlFor="ticket-summary" className="block text-sm font-medium text-gray-700 mb-1">Resumo*</label>
            <input 
              id="ticket-summary"
              type="text" 
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className={`input-field w-full ${errors.summary ? 'border-red-500' : ''}`}
              placeholder="Breve descrição do chamado"
              required 
              disabled={isSaving}
            />
             {errors.summary && <p className="text-red-600 text-xs mt-1">{errors.summary}</p>}
          </div>
          {/* Status */}
          <div>
            <label htmlFor="ticket-status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              id="ticket-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field w-full bg-white" // Garante fundo branco para select
              disabled={isSaving}
            >
              {ticketStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Passos/Detalhes */}
          <div>
            <label htmlFor="ticket-steps" className="block text-sm font-medium text-gray-700 mb-1">Passos/Detalhes</label>
            <textarea 
              id="ticket-steps"
              rows="5"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="input-field w-full"
              placeholder="Detalhes, passos de reprodução, links úteis..."
              disabled={isSaving}
            ></textarea>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3 sticky bottom-0 bg-white pb-1 z-10">
          <button onClick={onClose} className="btn btn-secondary" disabled={isSaving}>Cancelar</button>
          <button onClick={handleInternalSave} className="btn btn-primary" disabled={isSaving}>
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
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Rastreador de Informações de Chamados</h2>
      
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
        <div className="relative w-full sm:w-auto flex-grow">
          <input 
            type="text"
            placeholder="Buscar por ID, Cliente, Resumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-8 w-full"
          />
          <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        <button 
          onClick={handleAddTicket}
          className="btn btn-primary w-full sm:w-auto whitespace-nowrap"
        >
          <FaPlus className="mr-2" /> Adicionar Registro
        </button>
      </div>

       {isLoading && (
          <div className="text-center py-4 text-gray-500">
              <FaSpinner className="animate-spin inline mr-2" /> Carregando registros...
          </div>
      )}
      {error && !isLoading && (
          <div className="text-center py-4 text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
          </div>
      )}

      {!isLoading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Externo</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resumo</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTickets.length > 0 ? (
                filteredTickets.map(ticket => (
                  <tr key={ticket._id} className={`transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{ticket.externalId || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{ticket.client || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={ticket.summary}>{ticket.summary}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => handleEditTicket(ticket)} className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50" title="Editar" disabled={isProcessing}>
                        <FaEdit />
                      </button>
                      <button onClick={() => handleDeleteTicket(ticket._id)} className="text-red-600 hover:text-red-900 disabled:opacity-50" title="Excluir" disabled={isProcessing}>
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">Nenhum registro encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

       <TicketInfoModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveTicket} // Async
        ticket={currentTicket}
      />

    </div>
  );
};

export default TicketInfoTracker; 