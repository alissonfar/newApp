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
        { name: 'Open Finance', path: '/pluggy', icon: HubIcon, key: 'patrimonio-pluggy' },
      ],
    },
    {
      type: 'submenu',
      name: 'Empréstimos',
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
