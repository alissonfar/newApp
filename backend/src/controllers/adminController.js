const Usuario = require('../models/usuarios');
const mongoose = require('mongoose');
const crypto = require('crypto');

// Função auxiliar para gerar senha temporária
function gerarSenhaTemporaria(tamanho = 10) {
  return crypto.randomBytes(Math.ceil(tamanho / 2))
    .toString('hex') // Converte para hexadecimal
    .slice(0, tamanho); // Garante o tamanho exato
}

exports.listarUsuarios = async (req, res) => {
  try {
    // Paginação (exemplo básico, pode ser melhorado com mongoose-paginate-v2 se necessário)
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = parseInt(req.query.limite) || 10;
    const skip = (pagina - 1) * limite;

    const usuarios = await Usuario.find()
      .select('-senha') // Exclui a senha do resultado
      .skip(skip)
      .limit(limite)
      .sort({ createdAt: -1 }); // Ordena por data de criação descendente

    const totalUsuarios = await Usuario.countDocuments();

    res.status(200).json({
      usuarios,
      paginaAtual: pagina,
      totalPaginas: Math.ceil(totalUsuarios / limite),
      totalUsuarios
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ erro: "Erro interno ao listar usuários." });
  }
};

exports.obterDetalhesUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: "ID de usuário inválido." });
    }

    // Usando .select('-senha') diretamente na busca
    const usuario = await Usuario.findById(id).select('-senha'); 

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    // Retornando o usuário sem a necessidade de deletar a senha manualmente
    res.status(200).json(usuario);

  } catch (error) {
    console.error("Erro ao obter detalhes do usuário:", error);
    res.status(500).json({ erro: "Erro interno ao obter detalhes do usuário." });
  }
};


exports.resetarSenhaUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: "ID de usuário inválido." });
    }

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado para resetar senha." });
    }

    const senhaTemporaria = gerarSenhaTemporaria(12); // Gera senha de 12 caracteres

    // Define a nova senha (o hook 'pre-save' no modelo fará o hash)
    usuario.senha = senhaTemporaria;
    
    // Limpa tokens de redefinição antigos, se existirem, para evitar confusão
    usuario.tokenRedefinicaoSenha = undefined;
    usuario.tokenRedefinicaoSenhaExpira = undefined;

    await usuario.save();

    // Retorna a senha temporária para o administrador
    res.status(200).json({ 
      mensagem: `Senha do usuário ${usuario.nome} resetada com sucesso.`,
      senhaTemporaria: senhaTemporaria // O admin pode copiar e passar para o usuário
    });

  } catch (error) {
    console.error("Erro ao resetar senha do usuário:", error);
    res.status(500).json({ erro: "Erro interno ao resetar senha do usuário." });
  }
}; 