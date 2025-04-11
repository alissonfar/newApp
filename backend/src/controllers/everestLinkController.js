const EverestLink = require('../models/EverestLink');

module.exports = {
  // --- Criar Link ---
  async createLink(req, res) {
    try {
      const { title, url, description, tags } = req.body;
      const userId = req.user.userId;

      if (!title || !url) {
        return res.status(400).json({ erro: 'Título e URL são obrigatórios.' });
      }

      // A validação da URL é feita pelo Mongoose Schema

      const newLink = new EverestLink({
        userId,
        title,
        url,
        description,
        tags
      });

      await newLink.save();
      return res.status(201).json(newLink);

    } catch (error) {
      console.error('Erro ao criar link Everest:', error);
      // Verificar erro de validação do Mongoose
      if (error.name === 'ValidationError') {
        return res.status(400).json({ erro: error.message });
      }
      return res.status(500).json({ erro: 'Erro interno ao criar link.' });
    }
  },

  // --- Obter Links do Usuário ---
  async getLinks(req, res) {
    try {
      const userId = req.user.userId;
      // TODO: Adicionar busca por searchTerm
      const links = await EverestLink.find({ userId }).sort({ createdAt: -1 });
      return res.json(links);

    } catch (error) {
      console.error('Erro ao buscar links Everest:', error);
      return res.status(500).json({ erro: 'Erro interno ao buscar links.' });
    }
  },

  // --- Obter Link por ID ---
  async getLinkById(req, res) {
    try {
      const userId = req.user.userId;
      const linkId = req.params.id;

      const link = await EverestLink.findOne({ _id: linkId, userId });

      if (!link) {
        return res.status(404).json({ erro: 'Link não encontrado ou não pertence a este usuário.' });
      }

      return res.json(link);

    } catch (error) {
      console.error('Erro ao buscar link por ID:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de link inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao buscar link.' });
    }
  },

  // --- Atualizar Link ---
  async updateLink(req, res) {
    try {
      const userId = req.user.userId;
      const linkId = req.params.id;
      const { title, url, description, tags } = req.body;

      if (!title || !url) {
        return res.status(400).json({ erro: 'Título e URL são obrigatórios.' });
      }

      const updatedLink = await EverestLink.findOneAndUpdate(
        { _id: linkId, userId }, 
        { title, url, description, tags },
        { new: true, runValidators: true } // runValidators para validação de URL
      );

      if (!updatedLink) {
        return res.status(404).json({ erro: 'Link não encontrado ou não pertence a este usuário para atualização.' });
      }

      return res.json(updatedLink);

    } catch (error) {
      console.error('Erro ao atualizar link Everest:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de link inválido.' });
       }
       if (error.name === 'ValidationError') {
         return res.status(400).json({ erro: error.message });
       }
      return res.status(500).json({ erro: 'Erro interno ao atualizar link.' });
    }
  },

  // --- Deletar Link ---
  async deleteLink(req, res) {
    try {
      const userId = req.user.userId;
      const linkId = req.params.id;

      const result = await EverestLink.deleteOne({ _id: linkId, userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ erro: 'Link não encontrado ou não pertence a este usuário para exclusão.' });
      }

      return res.status(200).json({ message: 'Link excluído com sucesso.' }); 

    } catch (error) {
      console.error('Erro ao deletar link Everest:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de link inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao deletar link.' });
    }
  }
}; 