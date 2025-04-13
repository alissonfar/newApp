import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import {
  obterNotasEverest,
  criarNotaEverest,
  atualizarNotaEverest,
  excluirNotaEverest
} from '../../api';

// SVG icons inline
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style={{width: '18px', height: '18px', minWidth: '18px', minHeight: '18px'}}>
    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" style={{width: '18px', height: '18px', minWidth: '18px', minHeight: '18px'}}>
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{width: '20px', height: '20px', minWidth: '20px', minHeight: '20px'}}>
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{width: '20px', height: '20px', minWidth: '20px', minHeight: '20px'}}>
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const SpinnerIcon = ({ className }) => (
  <svg className={`animate-spin h-5 w-5 ${className || ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const EmptyNotesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// Dados mockados iniciais para notas
const mockNotes = [
  { id: 1, title: 'Lembrete Reunião X', content: 'Discutir novas features do módulo Y.', tags: ['reunião', 'features'] },
  { id: 2, title: 'Link Documentação API Z', content: 'https://docs.example.com/api/z', tags: ['api', 'docs'] },
  { id: 3, title: 'Passos Troubleshooting Erro Comum', content: '1. Verificar logs. 2. Reiniciar serviço. 3. Escalar para N2 se persistir.', tags: ['troubleshooting', 'erro'] },
];

// Componente Modal Aprimorado
const NoteModal = ({ isOpen, onClose, onSave, note }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Atualiza o formulário quando a nota para edição muda
  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setTagsStr(note.tags ? note.tags.join(', ') : '');
    } else {
      // Resetar para nova nota
      setTitle('');
      setContent('');
      setTagsStr('');
    }
  }, [note]);

  // Implementação de atalhos de teclado
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      // Esc para fechar o modal
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Ctrl+Enter para salvar
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!isSaving) {
          handleInternalSave();
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSaving, onClose, title]);

  if (!isOpen) return null;

  const handleInternalSave = async () => {
    if (!title.trim()) {
      toast.warning('O título da nota é obrigatório');
      return;
    }
    
    setIsSaving(true);
    const tagsArray = tagsStr.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
    try {
       await onSave({
        title,
        content,
        tags: tagsArray,
      });
    } catch (error) {
      console.error("Erro ao salvar no modal:", error); 
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="note-modal-overlay">
      <div className="note-modal">
        <div className="note-modal-header">
          <h3 className="note-modal-title">{note ? 'Editar Nota' : 'Adicionar Nova Nota'}</h3>
          <button 
            onClick={onClose} 
            className="note-modal-close"
            disabled={isSaving}
            aria-label="Fechar"
          >
          </button>
        </div>
        
        <div className="note-modal-body">
          <div className="note-form-group">
            <label htmlFor="note-title" className="note-form-label">Título</label>
            <input 
              id="note-title"
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="note-form-input"
              placeholder="Título da nota"
              disabled={isSaving}
            />
          </div>
          
          <div className="note-form-group">
            <label htmlFor="note-content" className="note-form-label">Conteúdo</label>
            <textarea 
              id="note-content"
              rows="5"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="note-form-textarea"
              placeholder="Digite o conteúdo da nota..."
              disabled={isSaving}
            ></textarea>
          </div>
          
          <div className="note-form-group">
            <label htmlFor="note-tags" className="note-form-label">Tags (separadas por vírgula)</label>
            <input 
              id="note-tags"
              type="text" 
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="note-form-input"
              placeholder="ex: importante, api, debug"
              disabled={isSaving}
            />
          </div>
        </div>
        
        <div className="note-modal-footer">
          <button 
            onClick={onClose} 
            className="note-cancel-button" 
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button 
            onClick={handleInternalSave} 
            className="note-save-button" 
            disabled={isSaving}
          >
            {isSaving && <SpinnerIcon />}
            {isSaving ? 'Salvando...' : 'Salvar Nota'}
          </button>
        </div>
      </div>
    </div>
  );
};

const NotesManager = () => {
  const [notes, setNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);

  const fetchNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await obterNotasEverest(); 
      setNotes(data || []);
    } catch (err) {
      console.error("Erro ao buscar notas:", err);
      setError('Falha ao carregar notas. Tente novamente.');
      toast.error('Falha ao carregar notas.');
      
      // Usar dados mockados para visualização
      setNotes(mockNotes);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleAddNote = () => {
    setCurrentNote(null);
    setIsModalOpen(true);
  };

  const handleEditNote = (note) => {
    setCurrentNote(note);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentNote(null);
  };

  const handleSaveNote = async (noteDataFromModal) => {
    try {
      let savedNote;
      if (currentNote?._id) {
        savedNote = await atualizarNotaEverest(currentNote._id, noteDataFromModal);
        toast.success('Nota atualizada com sucesso!');
      } else {
        savedNote = await criarNotaEverest(noteDataFromModal);
        toast.success('Nova nota criada com sucesso!');
      }
      console.log('Nota salva (API Mock):', savedNote);
      handleCloseModal();
      fetchNotes();
    } catch (err) {
       console.error("Erro ao salvar nota:", err);
       toast.error('Falha ao salvar nota.');
       throw err;
    }
  };

  const filteredNotes = notes.filter(note => 
    (note.title?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (note.content?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  // Função para gerar uma cor de borda baseada na primeira tag
  const getNoteBorderColor = (tags) => {
    if (!tags || tags.length === 0) return "#3b82f6"; // Azul padrão
    
    // Map de cores para tags comuns
    const tagColors = {
      'reunião': '#10b981', // Verde
      'api': '#6366f1',    // Indigo
      'docs': '#8b5cf6',   // Púrpura
      'erro': '#ef4444',   // Vermelho
      'bug': '#ef4444',    // Vermelho
      'feature': '#f59e0b', // Amarelo
      'importante': '#f43f5e', // Rosa
      'urgente': '#dc2626', // Vermelho escuro
      'troubleshooting': '#8b5cf6' // Púrpura
    };
    
    // Tenta encontrar uma cor para a primeira tag, ou usa azul como padrão
    const firstTag = tags[0].toLowerCase();
    for (const [key, color] of Object.entries(tagColors)) {
      if (firstTag.includes(key)) {
        return color;
      }
    }
    
    return '#3b82f6'; // Azul padrão se não encontrar match
  };

  // Função para calcular estatísticas de notas
  const calculateStats = () => {
    if (!notes.length) return { total: 0, categories: {} };
    
    // Gerar estatísticas por tag
    const categories = {};
    let tagsCount = 0;
    
    notes.forEach(note => {
      if (note.tags && note.tags.length) {
        tagsCount += note.tags.length;
        note.tags.forEach(tag => {
          if (!categories[tag]) {
            categories[tag] = 0;
          }
          categories[tag] += 1;
        });
      }
    });
    
    // Ordenar as categorias por contagem (maior primeiro)
    const sortedCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5) // Top 5 tags apenas
      .reduce((obj, [tag, count]) => {
        obj[tag] = count;
        return obj;
      }, {});
      
    return {
      total: notes.length,
      tagsCount,
      avgTagsPerNote: notes.length ? (tagsCount / notes.length).toFixed(1) : 0,
      categories: sortedCategories
    };
  };
  
  // Componente Estatísticas de Notas
  const NotesStats = () => {
    const stats = calculateStats();
    
    if (!stats.total) return null;
    
    return (
      <div className="notes-stats-container">
        <div className="notes-stats-header">
          <h3>Estatísticas</h3>
          <span className="notes-stats-counter">{stats.total} {stats.total === 1 ? 'nota' : 'notas'}</span>
        </div>
        
        <div className="notes-stats-grid">
          <div className="notes-stat-item">
            <span className="notes-stat-label">Tags Utilizadas</span>
            <span className="notes-stat-value">{stats.tagsCount}</span>
          </div>
          <div className="notes-stat-item">
            <span className="notes-stat-label">Média de Tags</span>
            <span className="notes-stat-value">{stats.avgTagsPerNote}</span>
          </div>
        </div>
        
        {Object.keys(stats.categories).length > 0 && (
          <div className="notes-tags-stats">
            <h4>Tags Mais Utilizadas</h4>
            <div className="notes-top-tags">
              {Object.entries(stats.categories).map(([tag, count]) => (
                <div key={tag} className="notes-top-tag">
                  <span className="notes-top-tag-name">{tag}</span>
                  <span className="notes-top-tag-count">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Componente de Modal de Confirmação de Exclusão
  const DeleteConfirmModal = () => {
    if (!showDeleteConfirm) return null;
    
    const handleCancel = () => {
      setShowDeleteConfirm(false);
      setNoteToDelete(null);
    };
    
    const handleConfirm = async () => {
      setIsProcessing(true);
      try {
        await excluirNotaEverest(noteToDelete.id || noteToDelete._id);
        toast.success('Nota excluída com sucesso!');
        fetchNotes();
      } catch (err) {
        console.error("Erro ao excluir nota:", err);
        toast.error('Falha ao excluir nota.');
      } finally {
        setIsProcessing(false);
        setShowDeleteConfirm(false);
        setNoteToDelete(null);
      }
    };
    
    return (
      <div className="note-modal-overlay">
        <div className="delete-confirm-modal">
          <div className="delete-confirm-header">
            <div className="delete-confirm-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h3 className="delete-confirm-title">Confirmar exclusão</h3>
          </div>
          
          <div className="delete-confirm-body">
            <p>Tem certeza que deseja excluir esta nota?</p>
            <p className="delete-confirm-note">{noteToDelete?.title}</p>
            <p className="delete-confirm-warning">Esta ação não pode ser desfeita.</p>
          </div>
          
          <div className="delete-confirm-footer">
            <button 
              onClick={handleCancel} 
              className="delete-cancel-button"
              disabled={isProcessing}
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirm} 
              className="delete-confirm-button"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <SpinnerIcon />
                  <span>Excluindo...</span>
                </>
              ) : 'Sim, excluir nota'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
        <div className="notes-search-bar">
          <input 
            type="text"
            placeholder="Buscar notas por título, conteúdo ou tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="notes-search-input"
          />
        </div>

        <button 
          onClick={handleAddNote}
          className="notes-add-button"
          aria-label="Adicionar nova nota"
        >
          <PlusIcon /> Adicionar Nota
        </button>
      </div>

      {/* Componente de estatísticas */}
      {!isLoading && !error && notes.length > 0 && <NotesStats />}

      {isLoading && (
        <div className="notes-loading">
          <SpinnerIcon className="notes-spinner" />
          <p>Carregando suas notas...</p>
        </div>
      )}
      
      {error && !isLoading && (
        <div className="text-center py-4 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          {filteredNotes.length > 0 ? (
            filteredNotes.map(note => {
              const borderColor = getNoteBorderColor(note.tags);
              
              return (
                <div 
                  key={note.id || note._id} 
                  className="note-card"
                  style={{ borderLeftColor: borderColor }}
                >
                  <h3 className="note-card-title">{note.title}</h3>
                  <p className="note-card-content">{note.content}</p>
                  
                  {note.tags && note.tags.length > 0 && (
                    <div className="note-tags">
                      {note.tags.map((tag, index) => (
                        <span key={index} className="note-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="note-actions">
                    <button 
                      onClick={() => handleEditNote(note)}
                      className="note-action-button note-edit-button"
                      disabled={isProcessing}
                      aria-label="Editar nota"
                      title="Editar nota"
                    >
                      <EditIcon />
                      <span className="action-btn-label">Editar</span>
                      <span className="sr-only">Editar nota</span>
                    </button>
                    <button 
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setNoteToDelete(note);
                      }}
                      className="note-action-button note-delete-button"
                      disabled={isProcessing}
                      aria-label="Excluir nota"
                      title="Excluir nota"
                    >
                      <TrashIcon />
                      <span className="action-btn-label">Excluir</span>
                      <span className="sr-only">Excluir nota</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="notes-empty-state">
              {searchTerm ? (
                <>
                  <div className="notes-empty-icon">
                    <SearchIcon />
                  </div>
                  <p className="notes-empty-text">Nenhuma nota encontrada para "{searchTerm}".</p>
                </>
              ) : (
                <>
                  <div className="notes-empty-icon">
                    <EmptyNotesIcon />
                  </div>
                  <p className="notes-empty-text">Você ainda não tem notas.</p>
                  <button onClick={handleAddNote} className="notes-empty-button">
                    Crie sua primeira nota
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <NoteModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveNote}
        note={currentNote}
      />

      <DeleteConfirmModal />
    </div>
  );
};

export default NotesManager; 