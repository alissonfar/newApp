import React, { useState, useEffect } from 'react';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaTimes, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import {
  obterNotasEverest,
  criarNotaEverest,
  atualizarNotaEverest,
  excluirNotaEverest
} from '../../api';

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
            <FaTimes />
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
             {isSaving ? <FaSpinner className="animate-spin mr-2"/> : null}
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
      setNotes(data);
    } catch (err) {
      console.error("Erro ao buscar notas:", err);
      setError('Falha ao carregar notas. Tente novamente.');
      toast.error('Falha ao carregar notas.');
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
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold text-gray-700 mb-6">Gerenciador de Notas</h2>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3">
        <div className="relative w-full sm:w-auto flex-grow">
          <input 
            type="text"
            placeholder="Buscar notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-8 w-full"
          />
          <FaSearch className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>

        <button 
          onClick={handleAddNote}
          className="btn btn-primary w-full sm:w-auto whitespace-nowrap"
        >
          <FaPlus className="mr-2" /> Adicionar Nota
        </button>
      </div>

      {isLoading && (
          <div className="text-center py-4 text-gray-500">
              <FaSpinner className="animate-spin inline mr-2" /> Carregando notas...
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
              <div key={note._id} className={`border border-gray-200 rounded p-4 transition-opacity duration-300 ${isProcessing ? 'opacity-50' : 'hover:bg-gray-50'}`}>
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
                  <div className="flex space-x-2 flex-shrink-0 ml-4">
                    <button onClick={() => handleEditNote(note)} className="text-gray-500 hover:text-blue-600 disabled:opacity-50" title="Editar" disabled={isProcessing}>
                      <FaEdit />
                    </button>
                    <button onClick={() => handleDeleteNote(note._id)} className="text-gray-500 hover:text-red-600 disabled:opacity-50" title="Excluir" disabled={isProcessing}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-4">Nenhuma nota encontrada.</p>
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