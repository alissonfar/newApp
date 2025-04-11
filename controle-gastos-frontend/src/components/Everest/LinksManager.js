import React, { useState, useEffect } from 'react';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaSpinner, FaLink } from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  obterLinksEverest,
  criarLinkEverest,
  atualizarLinkEverest,
  excluirLinkEverest
} from '../../api'; // Importar API

// Dados mockados iniciais para links
const mockLinks = [
  { id: 1, title: 'Documentação React', url: 'https://react.dev/', description: 'Site oficial do React.', tags: ['react', 'docs'] },
  { id: 2, title: 'Tailwind CSS', url: 'https://tailwindcss.com/', description: 'Framework CSS utility-first.', tags: ['css', 'frontend'] },
  { id: 3, title: 'MDN Web Docs', url: 'https://developer.mozilla.org/', description: 'Recursos para desenvolvedores web.', tags: ['web', 'docs', 'mdn'] },
];

// Componente Modal para Links
const LinkModal = ({ isOpen, onClose, onSave, link }) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (link) {
      setTitle(link.title || '');
      setUrl(link.url || '');
      setDescription(link.description || '');
      setTagsStr(link.tags ? link.tags.join(', ') : '');
    } else {
      setTitle('');
      setUrl('');
      setDescription('');
      setTagsStr('');
    }
  }, [link]);

  if (!isOpen) return null;

  const handleInternalSave = async () => {
    // Validação básica de URL
    if (!url || !url.startsWith('http')) {
      toast.error('Por favor, insira uma URL válida (começando com http ou https).');
      return;
    }
    setIsSaving(true);
    const tagsArray = tagsStr.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    try {
      await onSave({
        title,
        url,
        description,
        tags: tagsArray,
      });
    } catch (error) {
      console.error("Erro ao salvar link no modal:", error);
      // Toast é tratado no componente pai
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{link ? 'Editar Link' : 'Adicionar Novo Link'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" disabled={isSaving}>
            <FaTimes />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="link-title" className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input id="link-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field w-full" placeholder="Nome descritivo do link" disabled={isSaving}/>
          </div>
          <div>
            <label htmlFor="link-url" className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input id="link-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} className="input-field w-full" placeholder="https://..." required disabled={isSaving}/>
          </div>
          <div>
            <label htmlFor="link-description" className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
            <input id="link-description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field w-full" placeholder="Breve descrição do link" disabled={isSaving}/>
          </div>
           <div>
            <label htmlFor="link-tags" className="block text-sm font-medium text-gray-700 mb-1">Tags (separadas por vírgula)</label>
            <input id="link-tags" type="text" value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} className="input-field w-full" placeholder="ex: interno, docs, ferramenta" disabled={isSaving}/>
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="btn btn-secondary" disabled={isSaving}>Cancelar</button>
          <button onClick={handleInternalSave} className="btn btn-primary" disabled={!url || !url.startsWith('http') || isSaving}>
            {isSaving ? <FaSpinner className="animate-spin mr-2"/> : null}
            {isSaving ? 'Salvando...' : 'Salvar Link'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LinksManager = () => {
  const [links, setLinks] = useState([]); // Iniciar vazio
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLink, setCurrentLink] = useState(null);
  const [isLoading, setIsLoading] = useState(false); // Loading da lista
  const [isProcessing, setIsProcessing] = useState(false); // Loading de ações
  const [error, setError] = useState(null);

  // Função para buscar links
  const fetchLinks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Implementar busca via API (passar searchTerm)
      const data = await obterLinksEverest();
      setLinks(data);
    } catch (err) {
      console.error("Erro ao buscar links:", err);
      setError('Falha ao carregar links. Tente novamente.');
      toast.error('Falha ao carregar links.');
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar links ao montar
  useEffect(() => {
    fetchLinks();
  }, []);

  const handleAddLink = () => {
    setCurrentLink(null);
    setIsModalOpen(true);
  };

  const handleEditLink = (link) => {
    setCurrentLink(link);
    setIsModalOpen(true);
  };

  const handleDeleteLink = async (linkId) => {
    if (window.confirm('Tem certeza que deseja excluir este link?')) {
      setIsProcessing(true);
      try {
        await excluirLinkEverest(linkId);
        toast.success('Link excluído com sucesso!');
        fetchLinks(); // Recarrega
      } catch (err) {
        console.error("Erro ao excluir link:", err);
        toast.error('Falha ao excluir link.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentLink(null);
  };

  const handleSaveLink = async (linkDataFromModal) => {
    try {
      let savedLink;
      if (currentLink?._id) {
        savedLink = await atualizarLinkEverest(currentLink._id, linkDataFromModal);
        toast.success('Link atualizado com sucesso!');
      } else {
        savedLink = await criarLinkEverest(linkDataFromModal);
        toast.success('Novo link adicionado com sucesso!');
      }
      console.log('Link salvo (API Mock):', savedLink);
      handleCloseModal();
      fetchLinks(); // Recarrega
    } catch (err) {
       console.error("Erro ao salvar link:", err);
       toast.error(`Falha ao salvar link: ${err.message || 'Erro desconhecido'}`);
       throw err; // Propaga para o modal
    }
  };

  // Filtragem local por enquanto
  const filteredLinks = links.filter(link => 
    (link.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (link.url?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (link.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Repositório de Links</h2>
      
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
        <div className="relative w-full sm:w-auto flex-grow">
          <input 
            type="text"
            placeholder="Buscar links..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-8 w-full"
          />
          <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        <button 
          onClick={handleAddLink}
          className="btn btn-primary w-full sm:w-auto whitespace-nowrap"
        >
          <FaPlus className="mr-2" /> Adicionar Link
        </button>
      </div>

      {isLoading && (
          <div className="text-center py-4 text-gray-500">
              <FaSpinner className="animate-spin inline mr-2" /> Carregando links...
          </div>
      )}
      {error && !isLoading && (
          <div className="text-center py-4 text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
          </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          {filteredLinks.length > 0 ? (
            filteredLinks.map(link => (
              <div key={link._id} className={`border border-gray-200 rounded p-4 transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-grow min-w-0">
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline break-words block mb-1">
                      <FaLink className="inline mr-1 text-sm"/> {link.title || link.url} 
                    </a>
                    {link.description && (
                      <p className="text-sm text-gray-600 break-words">{link.description}</p>
                    )}
                     {link.tags && link.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {link.tags.map((tag, index) => (
                          <span key={index} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <button onClick={() => handleEditLink(link)} className="text-gray-500 hover:text-blue-600 disabled:opacity-50" title="Editar" disabled={isProcessing}>
                      <FaEdit />
                    </button>
                    <button onClick={() => handleDeleteLink(link._id)} className="text-gray-500 hover:text-red-600 disabled:opacity-50" title="Excluir" disabled={isProcessing}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">Nenhum link encontrado.</p>
          )}
        </div>
      )}

      <LinkModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveLink}
        link={currentLink}
      />
    </div>
  );
};

export default LinksManager; 