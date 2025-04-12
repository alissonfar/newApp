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
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const SpinnerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
  </svg>
);

// Dados mockados iniciais para notas
const mockNotes = [
  { id: 1, title: 'Lembrete Reunião X', content: 'Discutir novas features do módulo Y.', tags: ['reunião', 'features'] },
  { id: 2, title: 'Link Documentação API Z', content: 'https://docs.example.com/api/z', tags: ['api', 'docs'] },
  { id: 3, title: 'Passos Troubleshooting Erro Comum', content: '1. Verificar logs. 2. Reiniciar serviço. 3. Escalar para N2 se persistir.', tags: ['troubleshooting', 'erro'] },
];

// Componente Modal Simples (pode ser movido para arquivo separado depois)
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

  if (!isOpen) return null;

  const handleInternalSave = async () => {
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{note ? 'Editar Nota' : 'Adicionar Nova Nota'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" disabled={isSaving}>
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input 
              id="note-title"
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field w-full"
              placeholder="Título da nota"
              disabled={isSaving}
            />
          </div>
          <div>
            <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
            <textarea 
              id="note-content"
              rows="4"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="input-field w-full"
              placeholder="Digite o conteúdo da nota..."
              disabled={isSaving}
            ></textarea>
          </div>
          <div>
            <label htmlFor="note-tags" className="block text-sm font-medium text-gray-700 mb-1">Tags (separadas por vírgula)</label>
            <input 
              id="note-tags"
              type="text" 
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="input-field w-full"
              placeholder="ex: importante, api, debug"
              disabled={isSaving}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="btn btn-secondary" disabled={isSaving}>Cancelar</button>
          <button onClick={handleInternalSave} className="btn btn-primary" disabled={isSaving}>
             {isSaving ? <SpinnerIcon /> : null}
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

  const handleDeleteNote = async (noteId) => {
    if (window.confirm('Tem certeza que deseja excluir esta nota?')) {
      setIsProcessing(true);
      try {
        await excluirNotaEverest(noteId);
        toast.success('Nota excluída com sucesso!');
        fetchNotes();
      } catch (err) {
        console.error("Erro ao excluir nota:", err);
        toast.error('Falha ao excluir nota.');
      } finally {
        setIsProcessing(false);
      }
    }
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
    (note.content?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
        <div className="relative w-full sm:w-auto flex-grow">
          <input 
            type="text"
            placeholder="Buscar notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-8 w-full"
          />
          <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400">
            <SearchIcon />
          </span>
        </div>

        <button 
          onClick={handleAddNote}
          className="btn bg-blue-600 text-white py-2 px-4 rounded flex items-center hover:bg-blue-700 transition-colors w-full sm:w-auto"
        >
          <PlusIcon /> Adicionar Nota
        </button>
      </div>

      {isLoading && (
          <div className="text-center py-4 text-gray-500">
              <SpinnerIcon className="inline" /> Carregando notas...
          </div>
      )}
      
      {error && !isLoading && (
          <div className="text-center py-4 text-red-600 bg-red-50 p-3 rounded border border-red-200">
              {error}
          </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          {filteredNotes.length > 0 ? (
            filteredNotes.map(note => (
              <div key={note.id || note._id} className={`border border-gray-200 rounded p-4 transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-gray-800 mb-1">{note.title}</h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{note.content}</p>
                    {note.tags && note.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {note.tags.map((tag, index) => (
                          <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button 
                      onClick={() => handleEditNote(note)}
                      className="text-blue-500 hover:text-blue-700"
                      disabled={isProcessing}
                    >
                      <EditIcon />
                    </button>
                    <button 
                      onClick={() => handleDeleteNote(note.id || note._id)}
                      className="text-red-500 hover:text-red-700"
                      disabled={isProcessing}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-gray-50 rounded border border-gray-200">
              {searchTerm ? (
                <p className="text-gray-500">Nenhuma nota encontrada para "{searchTerm}".</p>
              ) : (
                <div>
                  <p className="text-gray-500 mb-2">Você ainda não tem notas.</p>
                  <button onClick={handleAddNote} className="text-blue-500 hover:text-blue-700">
                    Crie sua primeira nota
                  </button>
                </div>
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
    </div>
  );
};

export default NotesManager; 