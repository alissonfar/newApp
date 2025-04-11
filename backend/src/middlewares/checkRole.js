/**
 * Middleware para verificar se a role do usuário autenticado está incluída
 * em uma lista de roles permitidas.
 * 
 * @param {string[]} allowedRoles Array de strings contendo as roles permitidas para acessar a rota.
 * @returns {Function} Função de middleware para o Express.
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // Assume que um middleware anterior (ex: checkAuth) já decodificou o token
    // e adicionou as informações do usuário (incluindo a role) ao req.user.
    if (!req.user || !req.user.role) {
      console.warn('checkRole middleware: req.user ou req.user.role não encontrado. Middleware de autenticação está faltando ou não populou o usuário?');
      return res.status(401).json({ erro: 'Autenticação necessária.' }); // Ou 500, dependendo da política
    }

    const userRole = req.user.role;

    if (allowedRoles.includes(userRole)) {
      // Role permitida, prosseguir para a próxima etapa
      next();
    } else {
      // Role não permitida
      console.log(`Acesso negado para role '${userRole}'. Roles permitidas: ${allowedRoles.join(', ')}`);
      return res.status(403).json({ erro: 'Acesso negado. Permissões insuficientes.' });
    }
  };
};

module.exports = checkRole; 