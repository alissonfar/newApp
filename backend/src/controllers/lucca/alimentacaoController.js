const EventoAlimentacao = require('../../models/lucca/eventoAlimentacao');
const eventosService = require('../../services/lucca/eventosService');

async function listar(req, res) {
  try {
    const filtro = {};
    if (req.query.data) {
      const inicioDia = new Date(req.query.data);
      const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
      filtro.inicio = { $gte: inicioDia, $lt: fimDia };
    }
    if (req.query.tipo) {
      filtro.tipo = req.query.tipo;
    }
    const eventos = await eventosService.listarEventos(EventoAlimentacao, filtro, 'inicio');
    res.json(eventos);
  } catch (error) {
    console.error('Erro ao listar alimentação:', error);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function criar(req, res) {
  try {
    const evento = await eventosService.criarEvento(EventoAlimentacao, {
      ...req.body,
      registradoPor: req.userId
    }, { comTimer: true });
    res.status(201).json(evento);
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

async function atualizar(req, res) {
  try {
    const evento = await eventosService.atualizarEvento(EventoAlimentacao, req.params.id, req.body);
    res.json(evento);
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

async function excluir(req, res) {
  try {
    await eventosService.excluirEvento(EventoAlimentacao, req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

module.exports = { listar, criar, atualizar, excluir };
