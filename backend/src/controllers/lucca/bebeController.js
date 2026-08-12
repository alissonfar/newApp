const Bebe = require('../../models/lucca/bebe');

async function obterBebe(req, res) {
  try {
    const bebe = await Bebe.findOne();
    if (!bebe) {
      return res.status(404).json({ erro: 'Bebê ainda não cadastrado. Rode a migration de seed.' });
    }
    res.json(bebe);
  } catch (error) {
    console.error('Erro ao obter bebê:', error);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

async function atualizarBebe(req, res) {
  try {
    const bebe = await Bebe.findOne();
    if (!bebe) {
      return res.status(404).json({ erro: 'Bebê ainda não cadastrado. Rode a migration de seed.' });
    }
    const camposPermitidos = ['nome', 'dataNascimento', 'idadeGestacionalNascimento', 'janelaVigiliaAlvoMinutos'];
    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) {
        bebe[campo] = req.body[campo];
      }
    });
    await bebe.save();
    res.json(bebe);
  } catch (error) {
    console.error('Erro ao atualizar bebê:', error);
    res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}

module.exports = { obterBebe, atualizarBebe };
