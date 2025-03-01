// src/models/transacao.js
const mongoose = require('mongoose');

const PagamentoSchema = new mongoose.Schema({
  pessoa: { type: String, required: true },
  valor: { type: Number, required: true },
  // Armazena as tags do pagamento como um objeto, agrupadas por categoria
  tags: { type: Object }
});

const TransacaoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['gasto', 'recebivel'], required: true },
  descricao: { type: String, required: true },
  valor: { type: Number, required: true },
  data: { type: Date, required: true },
  // Agora as tags globais são armazenadas como um objeto (agrupadas por categoria)
  tags: { type: Object, required: true },
  pagamentos: { type: [PagamentoSchema], required: true },
  status: { type: String, enum: ['ativo', 'estornado'], default: 'ativo' }
});

// Removemos o hook pré-save para teste:
// TransacaoSchema.pre('save', function(next) {
//   const somaPagamentos = this.pagamentos.reduce((acc, pagamento) => acc + pagamento.valor, 0);
//   if (Math.abs(somaPagamentos - this.valor) > 0.01) {
//     return next(new Error(`A soma dos pagamentos (${somaPagamentos}) não é igual ao valor total da transação (${this.valor}).`));
//   }
//   next();
// });

module.exports = mongoose.model('Transacao', TransacaoSchema);
