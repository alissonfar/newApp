import React from 'react';
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

const icones = {
  // Finanças
  creditcard: FaCreditCard,
  moneybill: FaMoneyBillAlt,
  piggybank: FaPiggyBank,
  wallet: FaWallet,
  money: FaHandHoldingUsd,
  chartline: FaChartLine,
  chartbar: FaChartBar,
  chartpie: FaChartPie,
  calculator: FaCalculator,
  balance: FaBalanceScale,
  bank: FaUniversity,
  percentage: FaPercentage,
  receipt: FaReceipt,
  invoice: FaFileInvoiceDollar,
  coins: FaCoins,

  // Casa e Utilidades
  home: FaHome,
  couch: FaCouch,
  bed: FaBed,
  chair: FaChair,
  tools: FaTools,
  hammer: FaHammer,
  screwdriver: FaScrewdriver,
  wrench: FaWrench,
  paintroller: FaPaintRoller,
  wifi: FaWifi,

  // Transporte
  car: FaCar,
  bus: FaBus,
  plane: FaPlane,
  bicycle: FaBicycle,

  // Alimentação
  utensils: FaUtensils,
  coffee: FaCoffee,
  beer: FaBeer,
  pizzaslice: FaPizzaSlice,
  hamburger: FaHamburger,
  carrot: FaCarrot,
  apple: FaAppleAlt,

  // Compras
  cart: FaShoppingCart,
  tshirt: FaTshirt,
  gift: FaGift,

  // Saúde e Cuidados
  heartbeat: FaHeartbeat,
  medicine: FaPrescriptionBottleAlt,
  toiletpaper: FaToiletPaper,
  soap: FaSoap,
  baby: FaBabyCarriage,

  // Educação e Tecnologia
  graduation: FaGraduationCap,
  book: FaBook,
  laptop: FaLaptop,
  mobile: FaMobile,

  // Lazer e Entretenimento
  gamepad: FaGamepad,
  music: FaMusic,
  film: FaFilm,
  paw: FaPaw,
  tabletennis: FaTableTennis,
  dumbbell: FaDumbbell,
  running: FaRunning,
  swimmer: FaSwimmer,
  football: FaFootballBall,
  basketball: FaBasketballBall,
  bowling: FaBowlingBall,
};

const IconRenderer = ({ nome, size = 20, cor }) => {
  const IconComponent = icones[nome];
  if (!IconComponent) return null;
  
  return <IconComponent size={size} style={{ color: cor }} />;
};

export default IconRenderer; 