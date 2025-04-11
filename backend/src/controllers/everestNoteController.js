const EverestNote = require('../models/EverestNote');

module.exports = {
  // --- Criar Nota ---
  async createNote(req, res) {
    try {
      const { title, content, tags } = req.body;
      const userId = req.user.userId; // Obtido do middleware de autenticação

      if (!title || !content) {
        return res.status(400).json({ erro: 'Título e conteúdo são obrigatórios.' });
      }

      const newNote = new EverestNote({
        userId,
        title,
        content,
        tags // O setter no model normalizará as tags
      });

      await newNote.save();
      return res.status(201).json(newNote);

    } catch (error) {
      console.error('Erro ao criar nota Everest:', error);
      return res.status(500).json({ erro: 'Erro interno ao criar nota.' });
    }
  },

  // --- Obter Notas do Usuário ---
  async getNotes(req, res) {
    try {
      const userId = req.user.userId;
      // TODO: Adicionar lógica de busca por searchTerm (req.query.search)
      // Por agora, busca todas as notas do usuário, ordenadas pela mais recente
      const notes = await EverestNote.find({ userId }).sort({ createdAt: -1 });
      return res.json(notes);

    } catch (error) {
      console.error('Erro ao buscar notas Everest:', error);
      return res.status(500).json({ erro: 'Erro interno ao buscar notas.' });
    }
  },

  // --- Obter Nota por ID ---
  async getNoteById(req, res) {
    try {
      const userId = req.user.userId;
      const noteId = req.params.id;

      const note = await EverestNote.findOne({ _id: noteId, userId });

      if (!note) {
        return res.status(404).json({ erro: 'Nota não encontrada ou não pertence a este usuário.' });
      }

      return res.json(note);

    } catch (error) {
      console.error('Erro ao buscar nota por ID:', error);
       // Se o ID for inválido, Mongoose pode lançar um erro
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de nota inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao buscar nota.' });
    }
  },

  // --- Atualizar Nota ---
  async updateNote(req, res) {
    try {
      const userId = req.user.userId;
      const noteId = req.params.id;
      const { title, content, tags } = req.body;

      if (!title || !content) {
        return res.status(400).json({ erro: 'Título e conteúdo são obrigatórios.' });
      }

      // Encontra e atualiza a nota, garantindo que pertence ao usuário
      // { new: true } retorna o documento atualizado
      const updatedNote = await EverestNote.findOneAndUpdate(
        { _id: noteId, userId }, 
        { title, content, tags }, // O setter normalizará as tags
        { new: true, runValidators: true } // runValidators para garantir requisitos do schema
      );

      if (!updatedNote) {
        return res.status(404).json({ erro: 'Nota não encontrada ou não pertence a este usuário para atualização.' });
      }

      return res.json(updatedNote);

    } catch (error) {
      console.error('Erro ao atualizar nota Everest:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de nota inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao atualizar nota.' });
    }
  },

  // --- Deletar Nota ---
  async deleteNote(req, res) {
    try {
      const userId = req.user.userId;
      const noteId = req.params.id;

      const result = await EverestNote.deleteOne({ _id: noteId, userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ erro: 'Nota não encontrada ou não pertence a este usuário para exclusão.' });
      }

      // Retorna 200 OK com uma mensagem ou 204 No Content
      return res.status(200).json({ message: 'Nota excluída com sucesso.' }); 
      // Alternativa: return res.status(204).send();

    } catch (error) {
      console.error('Erro ao deletar nota Everest:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de nota inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao deletar nota.' });
    }
  }
}; 