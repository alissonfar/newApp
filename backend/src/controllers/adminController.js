const Usuario = require('../models/usuarios');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

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

    // Verifica se o usuário existe antes de tentar atualizar
    const usuarioExiste = await Usuario.findById(id).select('_id nome'); // Seleciona apenas ID e nome
    if (!usuarioExiste) {
      return res.status(404).json({ erro: "Usuário não encontrado para resetar senha." });
    }

    const senhaTemporaria = gerarSenhaTemporaria(12);

    // Faz o hash da senha manualmente, pois findByIdAndUpdate não dispara o hook pre-save
    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senhaTemporaria, salt);

    // Atualiza apenas os campos necessários usando findByIdAndUpdate
    await Usuario.findByIdAndUpdate(id, {
      $set: {
        senha: senhaHash,
        tokenRedefinicaoSenha: undefined, // Limpa token antigo
        tokenRedefinicaoSenhaExpira: undefined // Limpa expiração do token antigo
      }
    });

    // Retorna a senha temporária para o administrador
    res.status(200).json({ 
      mensagem: `Senha do usuário ${usuarioExiste.nome} resetada com sucesso.`,
      senhaTemporaria: senhaTemporaria 
    });

  } catch (error) {
    // Mantém o log de erro original, mas a causa provável (validation error) foi evitada
    console.error("Erro ao resetar senha do usuário:", error);
    res.status(500).json({ erro: "Erro interno ao resetar senha do usuário." });
  }
};

// Nova função para verificar o email de um usuário pelo admin
exports.verifyUserEmail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: "ID de usuário inválido." });
    }

    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    if (usuario.emailVerificado) {
      // Email já está verificado, apenas informa
      return res.status(200).json({ mensagem: "O email deste usuário já está verificado." });
    }

    // Atualiza o usuário para marcar o email como verificado
    const usuarioAtualizado = await Usuario.findByIdAndUpdate(
      id,
      { 
        emailVerificado: true,
        tokenVerificacao: undefined, // Limpa tokens antigos
        tokenVerificacaoExpira: undefined
      },
      { new: true } // Retorna o documento atualizado
    ).select('-senha'); // Não retorna a senha

    res.status(200).json({ 
      mensagem: `Email do usuário ${usuarioAtualizado.nome} marcado como verificado com sucesso.`,
      usuario: usuarioAtualizado // Retorna o usuário atualizado (sem senha)
    });

  } catch (error) {
    console.error("Erro ao verificar email do usuário pelo admin:", error);
    res.status(500).json({ erro: "Erro interno ao verificar email do usuário." });
  }
};

// Função para atualizar o role de um usuário
exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole } = req.body;
    const adminUserId = req.userId; // ID do admin fazendo a requisição

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: "ID de usuário inválido." });
    }

    // Valida se o newRole é um valor permitido pelo Schema
    const allowedRoles = Usuario.schema.path('role').enumValues;
    if (!allowedRoles.includes(newRole)) {
      return res.status(400).json({ erro: `Role inválido. Roles permitidos: ${allowedRoles.join(', ')}` });
    }

    const targetUser = await Usuario.findById(id).select('role _id'); // Seleciona role e id
    if (!targetUser) {
      return res.status(404).json({ erro: "Usuário alvo não encontrado." });
    }

    // Segurança: Impede admin de alterar o próprio role por aqui
    if (targetUser._id.equals(adminUserId)) {
        return res.status(403).json({ erro: "Você não pode alterar seu próprio role através desta interface." });
    }

    // Segurança: Impede rebaixamento do último admin
    if (targetUser.role === 'admin' && newRole !== 'admin') {
      const adminCount = await Usuario.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ erro: "Não é possível rebaixar o último administrador do sistema." });
      }
    }

    // Atualiza o role
    const updatedUser = await Usuario.findByIdAndUpdate(
      id,
      { role: newRole },
      { new: true, runValidators: true } // runValidators é importante aqui
    ).select('-senha');

    res.status(200).json({
      mensagem: `Role do usuário ${updatedUser.nome} atualizado para ${newRole} com sucesso.`,
      usuario: updatedUser
    });

  } catch (error) {
    console.error("Erro ao atualizar role do usuário:", error);
    // Verifica se é erro de validação (pode acontecer se outros campos estiverem inválidos)
    if (error.name === 'ValidationError') {
        return res.status(400).json({ erro: `Erro de validação ao atualizar role: ${error.message}` });
    }
    res.status(500).json({ erro: "Erro interno ao atualizar role do usuário." });
  }
};

// Função para atualizar o status de um usuário
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;
    const adminUserId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ erro: "ID de usuário inválido." });
    }

    // Valida se o newStatus é um valor permitido
    const allowedStatuses = Usuario.schema.path('status').enumValues;
    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({ erro: `Status inválido. Status permitidos: ${allowedStatuses.join(', ')}` });
    }

    const targetUser = await Usuario.findById(id).select('status _id');
    if (!targetUser) {
      return res.status(404).json({ erro: "Usuário alvo não encontrado." });
    }

    // Segurança: Impede admin de alterar o próprio status por aqui
    if (targetUser._id.equals(adminUserId)) {
      return res.status(403).json({ erro: "Você não pode alterar seu próprio status através desta interface." });
    }

    // Atualiza o status
    const updatedUser = await Usuario.findByIdAndUpdate(
      id,
      { status: newStatus },
      { new: true, runValidators: true } 
    ).select('-senha');

    res.status(200).json({
      mensagem: `Status do usuário ${updatedUser.nome} atualizado para ${newStatus} com sucesso.`,
      usuario: updatedUser
    });

  } catch (error) {
    console.error("Erro ao atualizar status do usuário:", error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ erro: `Erro de validação ao atualizar status: ${error.message}` });
    }
    res.status(500).json({ erro: "Erro interno ao atualizar status do usuário." });
  }
}; 