const EverestTicketInfo = require('../models/EverestTicketInfo');

module.exports = {
  // --- Criar Registro de Chamado ---
  async createTicketInfo(req, res) {
    try {
      const { externalId, client, summary, status, steps } = req.body;
      const userId = req.user.userId;

      if (!summary) {
        return res.status(400).json({ erro: 'O resumo é obrigatório.' });
      }

      const newTicketInfo = new EverestTicketInfo({
        userId,
        externalId,
        client,
        summary,
        status,
        steps
      });

      await newTicketInfo.save();
      return res.status(201).json(newTicketInfo);

    } catch (error) {
      console.error('Erro ao criar registro de chamado Everest:', error);
      return res.status(500).json({ erro: 'Erro interno ao criar registro.' });
    }
  },

  // --- Obter Registros do Usuário ---
  async getTicketInfos(req, res) {
    try {
      const userId = req.user.userId;
      // TODO: Adicionar busca por searchTerm
      const tickets = await EverestTicketInfo.find({ userId }).sort({ createdAt: -1 });
      return res.json(tickets);

    } catch (error) {
      console.error('Erro ao buscar registros de chamado Everest:', error);
      return res.status(500).json({ erro: 'Erro interno ao buscar registros.' });
    }
  },

  // --- Obter Registro por ID ---
  async getTicketInfoById(req, res) {
    try {
      const userId = req.user.userId;
      const ticketId = req.params.id;

      const ticket = await EverestTicketInfo.findOne({ _id: ticketId, userId });

      if (!ticket) {
        return res.status(404).json({ erro: 'Registro não encontrado ou não pertence a este usuário.' });
      }

      return res.json(ticket);

    } catch (error) {
      console.error('Erro ao buscar registro por ID:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de registro inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao buscar registro.' });
    }
  },

  // --- Atualizar Registro ---
  async updateTicketInfo(req, res) {
    try {
      const userId = req.user.userId;
      const ticketId = req.params.id;
      const { externalId, client, summary, status, steps } = req.body;

      if (!summary) {
        return res.status(400).json({ erro: 'O resumo é obrigatório.' });
      }

      const updatedTicketInfo = await EverestTicketInfo.findOneAndUpdate(
        { _id: ticketId, userId }, 
        { externalId, client, summary, status, steps },
        { new: true, runValidators: true } 
      );

      if (!updatedTicketInfo) {
        return res.status(404).json({ erro: 'Registro não encontrado ou não pertence a este usuário para atualização.' });
      }

      return res.json(updatedTicketInfo);

    } catch (error) {
      console.error('Erro ao atualizar registro Everest:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de registro inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao atualizar registro.' });
    }
  },

  // --- Deletar Registro ---
  async deleteTicketInfo(req, res) {
    try {
      const userId = req.user.userId;
      const ticketId = req.params.id;

      const result = await EverestTicketInfo.deleteOne({ _id: ticketId, userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ erro: 'Registro não encontrado ou não pertence a este usuário para exclusão.' });
      }

      return res.status(200).json({ message: 'Registro excluído com sucesso.' }); 

    } catch (error) {
      console.error('Erro ao deletar registro Everest:', error);
       if (error.kind === 'ObjectId') {
         return res.status(400).json({ erro: 'ID de registro inválido.' });
       }
      return res.status(500).json({ erro: 'Erro interno ao deletar registro.' });
    }
  }
}; 