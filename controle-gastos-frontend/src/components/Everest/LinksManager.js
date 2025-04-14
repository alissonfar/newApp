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
    <div className="link-modal-overlay">
      <div className="link-modal">
        <div className="link-modal-header">
          <h3 className="link-modal-title">{link ? 'Editar Link' : 'Adicionar Novo Link'}</h3>
          <button onClick={onClose} className="link-modal-close" disabled={isSaving}>
            <span className="sr-only">Fechar</span>
          </button>
        </div>
        
        <div className="link-modal-body">
          <div className="link-form-group">
            <label htmlFor="link-title" className="link-form-label">Título</label>
            <input 
              id="link-title" 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="link-form-input" 
              placeholder="Nome descritivo do link" 
              disabled={isSaving}
            />
          </div>
          
          <div className="link-form-group">
            <label htmlFor="link-url" className="link-form-label">URL</label>
            <input 
              id="link-url" 
              type="url" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              className="link-form-input" 
              placeholder="https://..." 
              required 
              disabled={isSaving}
            />
          </div>
          
          <div className="link-form-group">
            <label htmlFor="link-description" className="link-form-label">Descrição (Opcional)</label>
            <textarea 
              id="link-description" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="link-form-textarea" 
              placeholder="Breve descrição do link" 
              disabled={isSaving}
            />
          </div>
          
          <div className="link-form-group">
            <label htmlFor="link-tags" className="link-form-label">Tags (separadas por vírgula)</label>
            <input 
              id="link-tags" 
              type="text" 
              value={tagsStr} 
              onChange={(e) => setTagsStr(e.target.value)} 
              className="link-form-input" 
              placeholder="ex: interno, docs, ferramenta" 
              disabled={isSaving}
            />
          </div>
        </div>
        
        <div className="link-modal-footer">
          <button onClick={onClose} className="link-cancel-button" disabled={isSaving}>
            Cancelar
          </button>
          <button 
            onClick={handleInternalSave} 
            className="link-save-button" 
            disabled={!url || !url.startsWith('http') || isSaving}
          >
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
    <div>      
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
        <div className="links-search-bar w-full sm:w-auto flex-grow">
          <input 
            type="text"
            placeholder="Buscar links..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="links-search-input"
          />
        </div>
        <button 
          onClick={handleAddLink}
          className="links-add-button"
        >
          <FaPlus /> Adicionar Link
        </button>
      </div>

      {isLoading && (
        <div className="links-loading">
          <FaSpinner className="links-spinner" />
          <p>Carregando links...</p>
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
              <div key={link._id} className={`link-card ${isProcessing ? 'opacity-50' : ''}`}>
                <h3 className="link-title">
                  <FaLink /> {link.title || link.url}
                </h3>
                
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">
                  {link.url}
                </a>
                
                {link.description && (
                  <p className="link-description">{link.description}</p>
                )}
                
                {link.tags && link.tags.length > 0 && (
                  <div className="link-tags">
                    {link.tags.map((tag, index) => (
                      <span key={index} className="link-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="link-actions">
                  <button 
                    onClick={() => handleEditLink(link)} 
                    className="link-action-button link-edit-button" 
                    title="Editar" 
                    disabled={isProcessing}
                  >
                    <FaEdit />
                    <span className="action-btn-label">Editar</span>
                  </button>
                  <button 
                    onClick={() => handleDeleteLink(link._id)} 
                    className="link-action-button link-delete-button" 
                    title="Excluir" 
                    disabled={isProcessing}
                  >
                    <FaTrash />
                    <span className="action-btn-label">Excluir</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="links-empty-state">
              <FaLink className="links-empty-icon" />
              <p className="links-empty-text">Nenhum link encontrado.</p>
              <button onClick={handleAddLink} className="links-empty-button">
                <FaPlus /> Adicionar Primeiro Link
              </button>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <LinkModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveLink}
          link={currentLink}
        />
      )}
    </div>
  );
};

export default LinksManager; 