const EventoCrescimento = require('../../models/lucca/eventoCrescimento');
const eventosService = require('../../services/lucca/eventosService');

async function listar(req, res) {
  try {
    const eventos = await eventosService.listarEventos(EventoCrescimento, {}, 'data');
    res.json(eventos);
  } catch (error) {
    console.error('Erro ao listar crescimento:', error);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function criar(req, res) {
  try {
    const evento = await eventosService.criarEvento(EventoCrescimento, {
      ...req.body,
      registradoPor: req.userId
    });
    res.status(201).json(evento);
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

async function atualizar(req, res) {
  try {
    const evento = await eventosService.atualizarEvento(EventoCrescimento, req.params.id, req.body);
    res.json(evento);
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

async function excluir(req, res) {
  try {
    await eventosService.excluirEvento(EventoCrescimento, req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(error.status || 500).json({ erro: error.status ? error.message : 'Erro interno do servidor.' });
  }
}

module.exports = { listar, criar, atualizar, excluir };
