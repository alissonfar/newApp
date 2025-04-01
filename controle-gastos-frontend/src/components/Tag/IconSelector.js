import React, { useState } from 'react';
import {
  FaHome, FaCar, FaUtensils, FaShoppingCart, FaPlane, FaGamepad,
  FaGraduationCap, FaHeartbeat, FaBus, FaTshirt, FaWifi, FaBook,
  FaCoffee, FaGift, FaPaw, FaMusic, FaFilm, FaLaptop, FaMobile,
  FaBeer, FaPizzaSlice, FaHamburger, FaCarrot, FaAppleAlt,
  FaBabyCarriage, FaPrescriptionBottleAlt, FaToiletPaper, FaSoap,
  FaTools, FaHammer, FaScrewdriver, FaWrench, FaPaintRoller,
  FaCouch, FaBed, FaChair, FaTableTennis, FaDumbbell, FaRunning,
  FaBicycle, FaSwimmer, FaFootballBall, FaBasketballBall, FaBowlingBall,
  FaCreditCard, FaMoneyBillAlt, FaPiggyBank, FaWallet, FaHandHoldingUsd,
  FaChartLine, FaChartBar, FaChartPie, FaCalculator, FaBalanceScale,
  FaUniversity, FaPercentage, FaReceipt, FaFileInvoiceDollar, FaCoins
} from 'react-icons/fa';
import IconRenderer from '../shared/IconRenderer';
import './IconSelector.css';

const icones = {
  // Finanças (Primeiro para priorizar)
  creditcard: { icon: FaCreditCard, label: 'Cartão' },
  moneybill: { icon: FaMoneyBillAlt, label: 'Dinheiro' },
  piggybank: { icon: FaPiggyBank, label: 'Poupança' },
  wallet: { icon: FaWallet, label: 'Carteira' },
  money: { icon: FaHandHoldingUsd, label: 'Pagamento' },
  chartline: { icon: FaChartLine, label: 'Gráfico Linha' },
  chartbar: { icon: FaChartBar, label: 'Gráfico Barras' },
  chartpie: { icon: FaChartPie, label: 'Gráfico Pizza' },
  calculator: { icon: FaCalculator, label: 'Calculadora' },
  balance: { icon: FaBalanceScale, label: 'Balanço' },
  bank: { icon: FaUniversity, label: 'Banco' },
  percentage: { icon: FaPercentage, label: 'Porcentagem' },
  receipt: { icon: FaReceipt, label: 'Recibo' },
  invoice: { icon: FaFileInvoiceDollar, label: 'Fatura' },
  coins: { icon: FaCoins, label: 'Moedas' },

  // Casa e Utilidades
  home: { icon: FaHome, label: 'Casa' },
  couch: { icon: FaCouch, label: 'Móveis' },
  bed: { icon: FaBed, label: 'Quarto' },
  chair: { icon: FaChair, label: 'Cadeira' },
  tools: { icon: FaTools, label: 'Ferramentas' },
  hammer: { icon: FaHammer, label: 'Martelo' },
  screwdriver: { icon: FaScrewdriver, label: 'Chave de Fenda' },
  wrench: { icon: FaWrench, label: 'Chave Inglesa' },
  paintroller: { icon: FaPaintRoller, label: 'Pintura' },
  wifi: { icon: FaWifi, label: 'Internet' },

  // Transporte
  car: { icon: FaCar, label: 'Carro' },
  bus: { icon: FaBus, label: 'Ônibus' },
  plane: { icon: FaPlane, label: 'Avião' },
  bicycle: { icon: FaBicycle, label: 'Bicicleta' },

  // Alimentação
  utensils: { icon: FaUtensils, label: 'Restaurante' },
  coffee: { icon: FaCoffee, label: 'Café' },
  beer: { icon: FaBeer, label: 'Bebidas' },
  pizzaslice: { icon: FaPizzaSlice, label: 'Pizza' },
  hamburger: { icon: FaHamburger, label: 'Hambúrguer' },
  carrot: { icon: FaCarrot, label: 'Vegetais' },
  apple: { icon: FaAppleAlt, label: 'Frutas' },

  // Compras
  cart: { icon: FaShoppingCart, label: 'Compras' },
  tshirt: { icon: FaTshirt, label: 'Roupas' },
  gift: { icon: FaGift, label: 'Presentes' },

  // Saúde e Cuidados
  heartbeat: { icon: FaHeartbeat, label: 'Saúde' },
  medicine: { icon: FaPrescriptionBottleAlt, label: 'Medicamentos' },
  toiletpaper: { icon: FaToiletPaper, label: 'Higiene' },
  soap: { icon: FaSoap, label: 'Limpeza' },
  baby: { icon: FaBabyCarriage, label: 'Bebê' },

  // Educação e Tecnologia
  graduation: { icon: FaGraduationCap, label: 'Educação' },
  book: { icon: FaBook, label: 'Livros' },
  laptop: { icon: FaLaptop, label: 'Computador' },
  mobile: { icon: FaMobile, label: 'Celular' },

  // Lazer e Entretenimento
  gamepad: { icon: FaGamepad, label: 'Games' },
  music: { icon: FaMusic, label: 'Música' },
  film: { icon: FaFilm, label: 'Cinema' },
  paw: { icon: FaPaw, label: 'Pets' },
  tabletennis: { icon: FaTableTennis, label: 'Jogos' },
  dumbbell: { icon: FaDumbbell, label: 'Academia' },
  running: { icon: FaRunning, label: 'Corrida' },
  swimmer: { icon: FaSwimmer, label: 'Natação' },
  football: { icon: FaFootballBall, label: 'Futebol' },
  basketball: { icon: FaBasketballBall, label: 'Basquete' },
  bowling: { icon: FaBowlingBall, label: 'Boliche' },
};

const IconSelector = ({ value, onChange, className, cor }) => {
  const [mostrarGrid, setMostrarGrid] = useState(false);

  return (
    <div className="icon-selector-container">
      <div 
        className="icone-atual"
        onClick={() => setMostrarGrid(!mostrarGrid)}
        style={{ color: cor }}
      >
        <IconRenderer nome={value} size={20} cor={cor} />
        <span>{icones[value]?.label || 'Selecione um ícone'}</span>
      </div>
      
      {mostrarGrid && (
        <div className="icones-grid">
          {Object.entries(icones).map(([key, { icon: Icon, label }]) => (
            <div
              key={key}
              className={`icone-option ${value === key ? 'selected' : ''}`}
              onClick={() => {
                onChange(key);
                setMostrarGrid(false);
              }}
              title={label}
              style={{ color: value === key ? cor : 'inherit' }}
            >
              <IconRenderer nome={key} size={20} cor={value === key ? cor : 'inherit'} />
              <span className="icone-label">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IconSelector; 