/**
 * Mapa declarativo de rotas para breadcrumbs.
 * Rotas mais longas primeiro para matching correto.
 */
export const breadcrumbMap = {
  "/": "Home",
  "/conjunto": "Conta Conjunta",
  "/patrimonio": "Patrimônio",
  "/patrimonio/contas": "Contas",
  "/patrimonio/evolucao": "Evolução",
  "/patrimonio/historico": "Patrimônio Histórico",
  "/patrimonio/simulador": "Simulador",
  "/patrimonio/importacoes-ofx": "Importação OFX",
  "/patrimonio/transferencias": "Transferências",
  "/relatorio": "Relatórios",
  "/modelos-relatorio": "Modelos de Relatório",
  "/importacao": "Importação em Massa",
  "/importacao/nova": "Nova Importação",
  "/insights": "Insights",
  "/tags": "Gerenciar Tags",
  "/profile": "Meu Perfil",
  "/como-utilizar": "Como Utilizar",
  "/recebimentos/novo": "Recebimentos",
  "/recebimentos/historico": "Histórico de Recebimentos",
  "/admin": "Administração",
};

/**
 * Ordena as chaves por especificidade (mais longas primeiro)
 * para matching correto de subrotas.
 */
export const breadcrumbPathsOrdered = Object.keys(breadcrumbMap).sort(
  (a, b) => b.length - a.length
);
