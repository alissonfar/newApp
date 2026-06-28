// src/components/Layout/menuStructure.js
// Estrutura declarativa da sidebar.
// Cada nó tem `type`: 'item' (link direto) | 'submenu' (pai com filhos) | 'section' (agrupamento com header).
// O componente SidebarMenu.js consome este array via props.
//
// Os ícones são importados via named-imports de @mui/icons-material
// para preservar tree-shaking (cada ícone vira 1 entrada de bundle).

import HomeIcon from '@mui/icons-material/Home';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import DescriptionIcon from '@mui/icons-material/Description';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import PaidIcon from '@mui/icons-material/Paid';
import HistoryIcon from '@mui/icons-material/History';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SavingsIcon from '@mui/icons-material/Savings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CalculateIcon from '@mui/icons-material/Calculate';
import StackedBarChartIcon from '@mui/icons-material/StackedBarChart';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import HubIcon from '@mui/icons-material/Hub';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ContactsIcon from '@mui/icons-material/Contacts';
import GroupIcon from '@mui/icons-material/Group';

/**
 * Bloco 1: Home (destaque no topo, sem header de seção).
 */
const homeItem = {
  type: 'item',
  name: 'Home',
  path: '/',
  icon: HomeIcon,
  key: 'home',
};

/**
 * Bloco 2: Relatórios & Insights.
 */
const relatoriosSection = {
  type: 'section',
  label: 'Relatórios & Insights',
  items: [
    { type: 'item', name: 'Relatórios', path: '/relatorio', icon: ShowChartIcon, key: 'relatorios' },
    { type: 'item', name: 'Insights', path: '/insights', icon: LightbulbIcon, key: 'insights' },
    { type: 'item', name: 'Modelos de Relatório', path: '/modelos-relatorio', icon: DescriptionIcon, key: 'modelos-relatorio' },
  ],
};

/**
 * Bloco 3: Registrar & Consultar.
 */
const registrarSection = {
  type: 'section',
  label: 'Registrar & Consultar',
  items: [
    {
      type: 'submenu',
      name: 'Transações',
      icon: AccountBalanceWalletIcon,
      key: 'transacoes',
      items: [
        { name: 'Importação em Massa', path: '/importacao', icon: FileUploadIcon, key: 'importacao' },
        { name: 'Nova Importação', path: '/importacao/nova', icon: FileUploadIcon, key: 'importacao-nova' },
        { name: 'Recebimentos', path: '/recebimentos/novo', icon: PaidIcon, key: 'recebimentos-novo' },
        { name: 'Histórico de Recebimentos', path: '/recebimentos/historico', icon: HistoryIcon, key: 'recebimentos-historico' },
      ],
    },
    { type: 'item', name: 'Tags', path: '/tags', icon: LocalOfferIcon, key: 'tags' },
  ],
};

/**
 * Bloco 4: Patrimônio & Compartilhado.
 */
const patrimonioSection = {
  type: 'section',
  label: 'Patrimônio & Compartilhado',
  items: [
    {
      type: 'submenu',
      name: 'Patrimônio',
      path: '/patrimonio',
      icon: SavingsIcon,
      key: 'patrimonio',
      items: [
        { name: 'Resumo', path: '/patrimonio', icon: DashboardIcon, key: 'patrimonio-resumo' },
        { name: 'Contas', path: '/patrimonio/contas', icon: AccountBalanceIcon, key: 'patrimonio-contas' },
        { name: 'Simulador de Rendimentos', path: '/patrimonio/simulador', icon: CalculateIcon, key: 'patrimonio-simulador' },
        { name: 'Evolução', path: '/patrimonio/evolucao', icon: StackedBarChartIcon, key: 'patrimonio-evolucao' },
        { name: 'Patrimônio Histórico', path: '/patrimonio/historico', icon: CalendarMonthIcon, key: 'patrimonio-historico' },
        { name: 'Importar OFX', path: '/patrimonio/importacoes-ofx', icon: FileDownloadIcon, key: 'patrimonio-ofx' },
        { name: 'Transferências', path: '/patrimonio/transferencias', icon: SwapHorizIcon, key: 'patrimonio-transferencias' },
        { name: 'Faturas', path: '/patrimonio/faturas', icon: CalendarMonthIcon, key: 'patrimonio-faturas' },
        { name: 'Open Finance', path: '/pluggy', icon: HubIcon, key: 'patrimonio-pluggy' },
      ],
    },
    {
      type: 'submenu',
      name: 'Empréstimos',
      path: '/emprestimos',
      icon: HandshakeIcon,
      key: 'emprestimos',
      items: [
        { name: 'Lista de Empréstimos', path: '/emprestimos', icon: ListAltIcon, key: 'emprestimos-lista' },
        { name: 'Pessoas', path: '/pessoas', icon: ContactsIcon, key: 'pessoas' },
      ],
    },
    { type: 'item', name: 'Contas Conjuntas', path: '/conjunto', icon: GroupIcon, key: 'conjunto' },
  ],
};

/**
 * Estrutura completa da sidebar na ordem de renderização.
 * Home é o primeiro nó (será renderizado em destaque pelo SidebarMenu),
 * seguido pelas 3 seções agrupadas.
 *
 * Total: 15 destinos (1 Home + 3 + 4 + 8 + 1 — com submenus totalizando 3+8+2=13 caminhos).
 * Nenhuma feature removida — apenas reagrupada semanticamente.
 */
export const menuStructure = [
  homeItem,
  relatoriosSection,
  registrarSection,
  patrimonioSection,
];

/**
 * Mapa de submenus que começam expandidos no primeiro carregamento.
 * Compatibilidade com comportamento anterior: 'transacoes' true, outros false.
 */
export const defaultExpandedMenus = {
  transacoes: true,
  patrimonio: false,
  emprestimos: false,
};

/**
 * Detecta se um segmento de URL parece ser um ID (MongoDB ObjectId ou UUID).
 * Reaproveita a heurística que existia no BreadcrumbsNav.jsx antigo.
 */
function looksLikeId(segment) {
  if (!segment || typeof segment !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(segment) || /^[a-fA-F0-9-]{36}$/.test(segment);
}

/**
 * Overrides manuais para rotas que estão fora do menuStructure
 * (Profile, Como Utilizar, Admin) mas precisam de label canônico
 * no breadcrumb. Mantém o fallback humanizado bom para casos
 * imprevistos sem inflar o menuStructure (e sem poluir a sidebar).
 */
const FALLBACK_LABELS = {
  '/profile': 'Meu Perfil',
  '/como-utilizar': 'Como Utilizar',
  '/admin': 'Administração',
};

/**
 * Constrói o mapa `path → parentPath` a partir do menuStructure.
 * Usado pelo BreadcrumbsNav para derivar a hierarquia de qualquer rota.
 *
 * Regras:
 * - `item` simples vira `path → parentPath`.
 * - `submenu` COM path próprio vira `path → parentPath` e cada filho vira `childPath → submenuPath`.
 * - `submenu` SEM path próprio: os filhos caem direto no `parentPath` do submenu
 *   (no caso, a raiz `'/'`).
 * - `section` é só agrupamento — não vira nó, mas seus `items` são visitáveis.
 *
 * Exemplo de saída:
 *   '/emprestimos/123' → '/emprestimos'
 *   '/emprestimos'     → '/'
 *   '/'                → null (ausente do map, propositalmente)
 */
export function buildParentMap(structure) {
  const map = new Map();
  const homeKey = '/';

  function visit(items, parentPath) {
    for (const item of items) {
      if (item.type === 'item' && item.path) {
        // Se o path já foi registrado (ex: o submenu pai registrou antes
        // do item "Resumo" com mesmo path), mantém a primeira inserção.
        if (!map.has(item.path)) {
          map.set(item.path, parentPath);
        }
      } else if (item.type === 'submenu') {
        // O submenu PAI tem prioridade no map. Insere PRIMEIRO e não sobrescreve.
        if (item.path && !map.has(item.path)) {
          map.set(item.path, parentPath);
        }
        // Filhos do submenu. Se o pai não tem path, eles caem no parentPath do submenu.
        for (const child of item.items || []) {
          if (child.path && !map.has(child.path)) {
            map.set(child.path, item.path || parentPath);
          }
        }
      } else if (item.type === 'section') {
        visit(item.items || [], parentPath);
      }
    }
  }

  visit(structure, homeKey);
  return map;
}

/**
 * Acha o label canônico de uma rota dentro do menuStructure.
 * Desce recursivamente em submenus (que têm seus próprios `items`).
 * Retorna `null` se não encontrar — caller decide se cai no fallback humanizado.
 */
export function findLabelInMenu(path, structure) {
  for (const node of structure) {
    if (node.type === 'item' && node.path === path) return node.name;
    if (node.type === 'submenu' && node.path === path) return node.name;
    if (node.type === 'section' || node.type === 'submenu') {
      for (const child of node.items || []) {
        // Recursão: o filho pode ser outro submenu com items aninhados
        // (ex: /importacao está 2 níveis: section → submenu Transações → item).
        if (child.path === path) return child.name;
        if (child.type === 'submenu' && child.items) {
          const found = findLabelInMenu(path, [child]);
          if (found) return found;
        }
      }
    }
  }
  return null;
}

/**
 * Fallback final: humaniza o último segmento de uma URL quando
 * nem o menuStructure nem o MAP de labels dinâmicos conhece a rota.
 *
 * Comportamento:
 * - Se o path exato tem override em FALLBACK_LABELS, retorna o override.
 * - Se o último segmento parece ser um ID (ObjectId/UUID), retorna 'Detalhe'.
 * - Caso contrário: troca `-` por espaço e capitaliza a primeira letra de cada palavra.
 */
export function humanizeSegment(path) {
  if (!path) return '';
  if (FALLBACK_LABELS[path]) return FALLBACK_LABELS[path];

  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || path;

  if (looksLikeId(last)) return 'Detalhe';

  return last
    .split('-')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
}
