const TransacaoImportada = require('../models/transacaoImportada');
const Transacao = require('../models/transacao');

const transacaoImportadaController = {
  // Listar transações de uma importação
  async listarTransacoes(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const query = { 
        importacao: req.params.importacaoId,
        usuario: req.userId
      };

      if (req.query.status) {
        query.status = req.query.status;
      }

      const [transacoes, total] = await Promise.all([
        TransacaoImportada.find(query)
          .sort({ data: -1 })
          .skip(skip)
          .limit(limit),
        TransacaoImportada.countDocuments(query)
      ]);

      res.json({
        items: transacoes,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('[TransacaoImportada] Erro ao listar transações:', error);
      res.status(500).json({ erro: 'Erro ao listar transações.' });
    }
  },

  // Atualizar transação importada
  async atualizarTransacao(req, res) {
    try {
      // Log do payload recebido
      console.log('[DEBUG] Payload recebido na atualização:', {
        body: req.body,
        params: req.params
      });

      const transacao = await TransacaoImportada.findOne({
        _id: req.params.id,
        usuario: req.userId
      });

      if (!transacao) {
        console.error('[DEBUG] Transação não encontrada:', req.params.id);
        return res.status(404).json({ erro: 'Transação não encontrada.' });
      }

      // Log do estado atual da transação
      console.log('[DEBUG] Estado atual da transação:', {
        _id: transacao._id,
        pagamentos: transacao.pagamentos,
        dadosOriginais: transacao.dadosOriginais
      });

      // Campos permitidos para atualização
      const camposPermitidos = ['descricao', 'valor', 'data', 'tipo', 'observacao', 'pagamentos'];
      
      // Atualiza apenas os campos permitidos que foram enviados
      camposPermitidos.forEach(campo => {
        if (req.body[campo] !== undefined) {
          if (campo === 'pagamentos') {
            // Log dos pagamentos recebidos
            console.log('[DEBUG] Pagamentos recebidos:', req.body[campo]);
            
            // Se os pagamentos foram enviados vazios ou sem tags, mantém os pagamentos existentes
            if (!req.body[campo] || req.body[campo].length === 0) {
              console.log('[DEBUG] Mantendo pagamentos existentes:', transacao.pagamentos);
              return;
            }
            
            // Garante que os pagamentos estejam no formato correto e mantém os IDs existentes
            transacao[campo] = req.body[campo].map(p => {
              // Procura o pagamento existente com o mesmo ID
              const pagamentoExistente = transacao.pagamentos?.find(
                existente => existente._id.toString() === p._id
              );

              const pagamentoProcessado = {
                _id: pagamentoExistente?._id || p._id, // Mantém o ID original se existir
                pessoa: p.pessoa || pagamentoExistente?.pessoa || 'Não especificado',
                valor: parseFloat(p.valor || transacao.valor),
                tags: p.tags || p.paymentTags || pagamentoExistente?.tags || {}
              };

              console.log('[DEBUG] Pagamento processado:', {
                original: pagamentoExistente,
                processado: pagamentoProcessado
              });

              return pagamentoProcessado;
            });
          } else {
            transacao[campo] = req.body[campo];
          }
        }
      });

      // Atualiza também os dadosOriginais para manter consistência
      transacao.dadosOriginais = {
        ...transacao.dadosOriginais,
        tipo: transacao.tipo,
        descricao: transacao.descricao,
        valor: transacao.valor,
        data: transacao.data,
        pagamentos: transacao.pagamentos
      };

      // Atualiza o status para 'revisada' sempre que a transação é editada
      transacao.status = 'revisada';

      // Log do estado final antes de salvar
      console.log('[DEBUG] Estado final antes de salvar:', {
        _id: transacao._id,
        pagamentos: transacao.pagamentos,
        dadosOriginais: transacao.dadosOriginais,
        status: transacao.status
      });

      await transacao.save();
      
      // Busca a transação atualizada do banco para confirmar
      const transacaoAtualizada = await TransacaoImportada.findById(transacao._id);
      
      // Log da transação após salvar
      console.log('[DEBUG] Estado após salvar no banco:', {
        _id: transacaoAtualizada._id,
        pagamentos: transacaoAtualizada.pagamentos,
        dadosOriginais: transacaoAtualizada.dadosOriginais
      });
      
      res.json(transacaoAtualizada);
    } catch (error) {
      console.error('[TransacaoImportada] Erro ao atualizar transação:', error);
      res.status(500).json({ erro: 'Erro ao atualizar transação.' });
    }
  },

  // Validar transação importada
  async validarTransacao(req, res) {
    try {
      const transacao = await TransacaoImportada.findOne({
        _id: req.params.id,
        usuario: req.userId
      });

      if (!transacao) {
        return res.status(404).json({ erro: 'Transação não encontrada.' });
      }

      // Apenas atualiza o status para validada
      transacao.status = 'validada';
      await transacao.save();

      console.log('[DEBUG] Transação marcada como validada:', {
        _id: transacao._id,
        status: transacao.status
      });

      res.json(transacao);
    } catch (error) {
      console.error('[TransacaoImportada] Erro ao validar transação:', error);
      res.status(500).json({ erro: 'Erro ao validar transação.' });
    }
  },

  // Marcar transação com erro
  async marcarErro(req, res) {
    try {
      const transacao = await TransacaoImportada.findOne({
        _id: req.params.id,
        usuario: req.userId
      });

      if (!transacao) {
        return res.status(404).json({ erro: 'Transação não encontrada.' });
      }

      transacao.status = 'erro';
      transacao.erro = req.body.erro || 'Erro não especificado';
      await transacao.save();

      res.json(transacao);
    } catch (error) {
      console.error('[TransacaoImportada] Erro ao marcar transação com erro:', error);
      res.status(500).json({ erro: 'Erro ao marcar transação com erro.' });
    }
  },

  // Validar múltiplas transações
  async validarMultiplas(req, res) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ erro: 'Lista de IDs inválida.' });
      }

      const transacoes = await TransacaoImportada.find({
        _id: { $in: ids },
        usuario: req.userId,
        status: 'pendente'
      });

      const resultados = await Promise.all(
        transacoes.map(async (transacao) => {
          try {
            const novaTransacao = new Transacao(transacao.paraTransacao());
            await novaTransacao.save();

            transacao.status = 'validada';
            await transacao.save();

            return {
              id: transacao._id,
              sucesso: true,
              transacao: novaTransacao
            };
          } catch (error) {
            return {
              id: transacao._id,
              sucesso: false,
              erro: error.message
            };
          }
        })
      );

      res.json({
        total: resultados.length,
        sucessos: resultados.filter(r => r.sucesso).length,
        erros: resultados.filter(r => !r.sucesso).length,
        resultados
      });
    } catch (error) {
      console.error('[TransacaoImportada] Erro ao validar múltiplas transações:', error);
      res.status(500).json({ erro: 'Erro ao validar transações.' });
    }
  }
};

module.exports = transacaoImportadaController; 