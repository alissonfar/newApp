async function criarEvento(Model, dados, opcoes = {}) {
  const { comTimer = false } = opcoes;

  if (comTimer && (dados.fim === null || dados.fim === undefined)) {
    const emAndamento = await Model.findOne({ bebeId: dados.bebeId, fim: null })
      .populate('registradoPor', 'nome');

    if (emAndamento) {
      const horario = new Date(emAndamento.inicio).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      });
      const erro = new Error(
        `Já existe um evento em andamento, iniciado às ${horario} por ${emAndamento.registradoPor.nome}.`
      );
      erro.status = 409;
      throw erro;
    }
  }

  return Model.create(dados);
}

async function listarEventos(Model, filtro, sortField) {
  return Model.find(filtro).sort({ [sortField]: -1 }).populate('registradoPor', 'nome');
}

async function atualizarEvento(Model, id, dados) {
  const evento = await Model.findByIdAndUpdate(id, dados, { new: true, runValidators: true });
  if (!evento) {
    const erro = new Error('Evento não encontrado.');
    erro.status = 404;
    throw erro;
  }
  return evento;
}

async function excluirEvento(Model, id) {
  const evento = await Model.findByIdAndDelete(id);
  if (!evento) {
    const erro = new Error('Evento não encontrado.');
    erro.status = 404;
    throw erro;
  }
  return evento;
}

module.exports = { criarEvento, listarEventos, atualizarEvento, excluirEvento };
