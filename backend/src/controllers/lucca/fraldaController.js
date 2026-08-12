const EventoFralda = require('../../models/lucca/eventoFralda');
const eventosService = require('../../services/lucca/eventosService');

async function listar(req, res) {
  try {
    const filtro = {};
    if (req.query.data) {
      const inicioDia = new Date(req.query.data);
      const fimDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);
      filtro.horario = { $gte: inicioDia, $lt: fimDia };
    }
    const eventos = await eventosService.listarEventos(EventoFralda, filtro, 'horario');
    res.json(eventos);
  } catch (error) {
    console.error('Erro ao listar fralda:', error);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function criar(req, res) {
  try {
    const evento = await eventosService.criarEvento(EventoFralda, {
      ...req.body,
      registradoPor: req.userId
    });
    res.status(201).json(evento);
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

async function excluir(req, res) {
  try {
    await eventosService.excluirEvento(EventoFralda, req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

module.exports = { listar, criar, excluir };
