// src/controllers/divisaoPresetController.js
const DivisaoPreset = require('../models/divisaoPreset');

const TOLERANCIA_PERCENTUAL = 0.1;

function validarPartes(partes) {
  if (!Array.isArray(partes) || partes.length < 2) {
    return 'O preset precisa de pelo menos 2 partes.';
  }
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (!p || !p.pessoa || !String(p.pessoa).trim()) {
      return `Parte ${i + 1}: o nome da pessoa é obrigatório.`;
    }
    const pct = Number(p.percentual);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      return `Parte ${i + 1}: percentual inválido.`;
    }
  }
  const soma = partes.reduce((acc, p) => acc + Number(p.percentual), 0);
  if (Math.abs(soma - 100) > TOLERANCIA_PERCENTUAL) {
    return `A soma dos percentuais precisa ser 100% (está em ${soma.toFixed(2)}%).`;
  }
  return null;
}

exports.listar = async (req, res) => {
  try {
    const presets = await DivisaoPreset.find({ usuario: req.userId }).sort({ nome: 1 }).lean();
    res.json(presets);
  } catch (error) {
    console.error('Erro ao listar presets de divisão:', error);
    res.status(500).json({ erro: 'Erro ao listar presets de divisão.' });
  }
};

exports.criar = async (req, res) => {
  const { nome, partes } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'O nome do preset é obrigatório.' });
  }
  const erroPartes = validarPartes(partes);
  if (erroPartes) {
    return res.status(400).json({ erro: erroPartes });
  }
  try {
    const novo = new DivisaoPreset({
      usuario: req.userId,
      nome: nome.trim(),
      partes: partes.map(p => ({ pessoa: String(p.pessoa).trim(), percentual: Number(p.percentual) }))
    });
    await novo.save();
    res.status(201).json(novo);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe um preset com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao criar preset.', detalhe: error.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const preset = await DivisaoPreset.findOne({ _id: req.params.id, usuario: req.userId });
    if (!preset) return res.status(404).json({ erro: 'Preset não encontrado.' });

    if (req.body.nome !== undefined) {
      if (!req.body.nome || !req.body.nome.trim()) {
        return res.status(400).json({ erro: 'O nome não pode ser vazio.' });
      }
      preset.nome = req.body.nome.trim();
    }
    if (req.body.partes !== undefined) {
      const erroPartes = validarPartes(req.body.partes);
      if (erroPartes) return res.status(400).json({ erro: erroPartes });
      preset.partes = req.body.partes.map(p => ({ pessoa: String(p.pessoa).trim(), percentual: Number(p.percentual) }));
    }

    await preset.save();
    res.json(preset);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ erro: 'Já existe um preset com este nome.' });
    }
    res.status(500).json({ erro: 'Erro ao atualizar preset.', detalhe: error.message });
  }
};

exports.excluir = async (req, res) => {
  try {
    const preset = await DivisaoPreset.findOne({ _id: req.params.id, usuario: req.userId });
    if (!preset) return res.status(404).json({ erro: 'Preset não encontrado.' });
    await DivisaoPreset.deleteOne({ _id: preset._id });
    res.json({ mensagem: 'Preset excluído com sucesso.' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao excluir preset.' });
  }
};
