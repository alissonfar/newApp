import React, { useState } from 'react';
import { FaHome, FaCar, FaUtensils, FaShoppingCart, FaPlane, FaGamepad, 
         FaGraduationCap, FaHeartbeat, FaBus, FaTshirt, FaWifi, FaBook,
         FaCoffee, FaGift, FaPaw, FaMusic, FaFilm, FaLaptop, FaMobile,
         FaBeer, FaPizzaSlice, FaHamburger, FaCarrot, FaAppleAlt,
         FaBabyCarriage, FaPrescriptionBottleAlt, FaToiletPaper, FaSoap,
         FaTools, FaHammer, FaScrewdriver, FaWrench, FaPaintRoller,
         FaCouch, FaBed, FaChair, FaTableTennis, FaDumbbell, FaRunning,
         FaBicycle, FaSwimmer, FaFootballBall, FaBasketballBall, FaBowlingBall,
         FaCreditCard, FaMoneyBillAlt, FaPiggyBank, FaWallet, FaHandHoldingUsd } from 'react-icons/fa';
import './NovaCategoriaForm.css';

const NovaCategoriaForm = ({ onSubmit, onCancel }) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [cor, setCor] = useState('#000000');
  const [icone, setIcone] = useState('home');
  const [mostrarSelecaoIcone, setMostrarSelecaoIcone] = useState(false);

  const icones = {
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

    // Finanças
    creditcard: { icon: FaCreditCard, label: 'Cartão' },
    moneybill: { icon: FaMoneyBillAlt, label: 'Dinheiro' },
    piggybank: { icon: FaPiggyBank, label: 'Poupança' },
    wallet: { icon: FaWallet, label: 'Carteira' },
    money: { icon: FaHandHoldingUsd, label: 'Pagamento' },
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ nome, descricao, cor, icone });
  };

  const renderIconeAtual = () => {
    const IconeComponent = icones[icone]?.icon;
    return IconeComponent ? <IconeComponent size={24} /> : null;
  };

  return (
    <form onSubmit={handleSubmit} className="nova-categoria-form">
      <div className="form-group">
        <label>Nome:</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Descrição:</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Cor:</label>
        <input
          type="color"
          value={cor}
          onChange={(e) => setCor(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Ícone:</label>
        <div className="icone-selector">
          <div 
            className="icone-atual"
            onClick={() => setMostrarSelecaoIcone(!mostrarSelecaoIcone)}
          >
            {renderIconeAtual()}
            <span>{icones[icone]?.label || 'Selecione um ícone'}</span>
          </div>
          
          {mostrarSelecaoIcone && (
            <div className="icones-grid">
              {Object.entries(icones).map(([key, { icon: Icon, label }]) => (
                <div
                  key={key}
                  className={`icone-option ${icone === key ? 'selected' : ''}`}
                  onClick={() => {
                    setIcone(key);
                    setMostrarSelecaoIcone(false);
                  }}
                  title={label}
                >
                  <Icon size={20} />
                  <span className="icone-label">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-submit">
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="btn-cancel">
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default NovaCategoriaForm; 