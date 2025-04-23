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
      const { tags, period, dateFrom, dateTo, search } = req.query;

      let filterQuery = { userId };

      // Filtrar por Tags (se fornecido)
      if (tags) {
        // O setter do model já normaliza para lowercase e trim
        const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
        if (tagsArray.length > 0) {
          // $all para notas que contêm TODAS as tags
          // $in para notas que contêm QUALQUER uma das tags (mais comum)
          filterQuery.tags = { $in: tagsArray }; 
        }
      }

      // Filtrar por Data (createdAt)
      const dateFilter = {};
      let hasDateFilter = false;

      if (dateFrom) {
        const startDate = new Date(dateFrom);
        if (!isNaN(startDate)) {
          startDate.setHours(0, 0, 0, 0); // Início do dia
          dateFilter.$gte = startDate;
          hasDateFilter = true;
        }
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        if (!isNaN(endDate)) {
          endDate.setHours(23, 59, 59, 999); // Fim do dia
          dateFilter.$lte = endDate;
          hasDateFilter = true;
        }
      } else if (dateFrom && !dateTo) {
         // Se só dateFrom for fornecido, consideramos até o fim dos tempos
         // (ou podemos definir um limite, mas geralmente não é necessário)
      }

      // Filtrar por Período predefinido (se dateFrom/dateTo não foram usados)
      if (!hasDateFilter && period) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);

        if (period === 'today') {
          dateFilter.$gte = today;
          dateFilter.$lte = endOfToday;
          hasDateFilter = true;
        } else if (period === 'week') {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay()); // Vai para o último Domingo
          dateFilter.$gte = startOfWeek;
          // Implicitamente pega até agora (ou poderíamos definir fim da semana)
          dateFilter.$lte = new Date(); // Até o momento atual
          hasDateFilter = true;
        } else if (period === 'month') {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          dateFilter.$gte = startOfMonth;
          // Implicitamente pega até agora (ou poderíamos definir fim do mês)
          dateFilter.$lte = new Date(); // Até o momento atual
          hasDateFilter = true;
        }
      }

      if (hasDateFilter) {
        filterQuery.createdAt = dateFilter;
      }
      
      // TODO: Implementar busca por texto (search) no backend (opcional)
      // Exemplo simples (case-insensitive):
      // if (search) {
      //   filterQuery.$or = [
      //     { title: { $regex: search, $options: 'i' } },
      //     { content: { $regex: search, $options: 'i' } }
      //   ];
      // }

      // Busca as notas com os filtros aplicados, ordenadas pela mais recente
      const notes = await EverestNote.find(filterQuery).sort({ createdAt: -1 });
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