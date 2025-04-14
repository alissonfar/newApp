const mongoose = require('mongoose');

// Sub-schema para Endereço (reutilizável)
const EnderecoSchema = new mongoose.Schema({
  logradouro: String,
  numero: String,
  complemento: String,
  bairro: String,
  codigoMunicipio: String,
  municipio: String,
  uf: String,
  cep: String,
  codigoPais: String,
  pais: String,
  fone: String,
}, { _id: false });

// Sub-schema para Impostos de Item
const ImpostoItemSchema = new mongoose.Schema({
  vTotTrib: Number, // Valor aprox. Tributos (item)
  icms: {
    origem: String,
    cst: String, // Ou CSOSN para Simples Nacional
    modBC: String,
    pRedBC: Number,
    vBC: Number,
    pICMS: Number,
    vICMS: Number,
    vICMSDeson: Number,
    motDesICMS: String,
    // Adicionar campos de ST, FCP, Difal etc. se necessário analisar
  },
  ipi: {
    cst: String,
    clEnq: String,
    cnpjProd: String,
    cSelo: String,
    qSelo: Number,
    cEnq: String,
    vBC: Number,
    pIPI: Number,
    vIPI: Number,
  },
  pis: {
    cst: String,
    vBC: Number,
    pPIS: Number,
    vPIS: Number,
  },
  cofins: {
    cst: String,
    vBC: Number,
    pCOFINS: Number,
    vCOFINS: Number,
  },
}, { _id: false });


// Sub-schema para Itens da NF-e
const ItemNFeSchema = new mongoose.Schema({
  numeroItem: Number,
  codigoProduto: String,
  cEAN: String,
  descricao: String,
  ncm: String,
  // cest: String, // (Opcional)
  cfop: String,
  unidadeComercial: String,
  quantidadeComercial: Number,
  valorUnitarioComercial: Number,
  valorTotalBruto: Number,
  cEANTrib: String,
  unidadeTributavel: String,
  quantidadeTributavel: Number,
  valorUnitarioTributavel: Number,
  vFrete: Number,
  vSeg: Number,
  vDesc: Number,
  vOutro: Number,
  indTot: String, // Indica se valor compõe total da nota (1=Sim)
  impostos: ImpostoItemSchema, // Impostos detalhados do item
}, { _id: false });

// Sub-schema para Detalhe de Pagamento
const DetPagSchema = new mongoose.Schema({
  indPag: String, // 0=À vista, 1=A prazo
  formaPagamento: String, // Código (01=Dinheiro, 03=Cartão C., 04=Cartão D., 05=Créd. Loja, 15=Boleto, 17=PIX...)
  descricaoPagamento: String, // Mapear código para descrição (ex: "Cartão de Crédito")
  valor: Number,
  // Se formaPagamento for cartão, pode ter dados da transação (CNPJ, bandeira, aut) - extrair se necessário
  // cnpjCredenciadora: String,
  // bandeiraCartao: String, // Código
  // autCartao: String,
}, { _id: false });


// Sub-schema para Totais da NF-e
const TotaisNFeSchema = new mongoose.Schema({
  icmsTot: {
    vBC: Number,
    vICMS: Number,
    vICMSDeson: Number,
    vFCP: Number, // FCP próprio
    vBCST: Number,
    vST: Number,
    vFCPST: Number, // FCP retido por ST
    vFCPSTRet: Number, // FCP retido anteriormente por ST
    vProd: Number,
    vFrete: Number,
    vSeg: Number,
    vDesc: Number,
    vII: Number,
    vIPI: Number,
    vIPIDevol: Number,
    vPIS: Number,
    vCOFINS: Number,
    vOutro: Number,
    vNF: Number, // Valor Total da Nota
    vTotTrib: Number, // Valor Aprox. Total Tributos (Painel IBPT)
  },
  // Poderia adicionar issqnTot e retTrib se relevante
}, { _id: false });

// Sub-schema para Transporte
const TransporteNFeSchema = new mongoose.Schema({
    modFrete: String, // Modalidade (0=Emitente, 1=Destinatário, 2=Terceiros...)
    descricaoModFrete: String, // Mapear código (Ex: "Por conta do Destinatário")
    transportadora: {
        nome: String,
        cnpjCpf: String, // CNPJ ou CPF
        ie: String,
        enderecoCompleto: String, // Concatenar ou usar EnderecoSchema
        municipio: String,
        uf: String,
    },
    veiculo: {
        placa: String,
        uf: String,
        rntc: String,
    },
    volumes: [{
        quantidade: Number,
        especie: String,
        marca: String,
        numeracao: String,
        pesoLiquido: Number,
        pesoBruto: Number,
    }],
    // Poderia ter reboque, vagao, balsa se necessário
}, { _id: false });


// Schema Principal
const EverestXmlSummarySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    index: true
  },
  originalFilename: {
    type: String,
    required: true,
    trim: true
  },
  xmlType: { // Identifica o tipo de XML processado
    type: String,
    required: true,
    enum: ['NFe'], // Por enquanto, apenas NFe
    default: 'NFe'
  },
  // -- Dados Estruturados da NF-e --
  identificacao: {
    cUF: String,
    cNF: String, // Código Numérico Chave
    natOp: String, // Natureza da Operação
    mod: String, // Modelo (55=NFe, 65=NFCe)
    serie: String,
    nNF: String, // Número da Nota
    dhEmi: Date, // Data e Hora Emissão
    dhSaiEnt: Date, // Data e Hora Saída/Entrada (se houver)
    tpNF: String, // Tipo NF (0=Entrada, 1=Saída)
    idDest: String, // Destino (1=Interna, 2=Interestadual, 3=Exterior)
    cMunFG: String, // Município Fato Gerador
    tpImp: String, // Formato DANFE
    tpEmis: String, // Tipo Emissão (1=Normal, 2=Contingência...)
    cDV: String, // Dígito Verificador Chave
    tpAmb: String, // Ambiente (1=Produção, 2=Homologação)
    finNFe: String, // Finalidade (1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução)
    indFinal: String, // Consumidor Final (0=Não, 1=Sim)
    indPres: String, // Indicador Presença Comprador
    procEmi: String, // Processo Emissão (0=Aplicativo Contribuinte...)
    verProc: String, // Versão Aplicativo
    chaveAcesso: { type: String, index: true, unique: true } // Chave de Acesso (44 dígitos)
  },
  emitente: {
    nome: String,
    nomeFantasia: String,
    cnpj: { type: String, index: true },
    ie: String,
    // iest: String, // IE Substituto Tributário (se houver)
    crt: String, // Código Regime Tributário (1=Simples, 2=Simples Excesso, 3=Normal)
    endereco: EnderecoSchema
  },
  destinatario: {
    nome: String,
    cpfCnpj: { type: String, index: true }, // CNPJ ou CPF
    ie: String, // Pode não ter se consumidor final
    indIEDest: String, // Indicador IE (1=Contrib, 2=Isento, 9=Não contrib)
    email: String,
    endereco: EnderecoSchema
  },
  itens: [ItemNFeSchema],
  transporte: TransporteNFeSchema, // Seção de transporte
  pagamento: { // Seção de pagamento
      detalhes: [DetPagSchema],
      vTroco: Number, // Valor do Troco (se houver)
  },
  totais: TotaisNFeSchema, // Bloco de totais

  // -- Campos de Controle --
  processingError: { // Opcional: Para registrar erros de parsing/extração
    type: String,
    default: null
  }
}, {
  timestamps: true // Adiciona createdAt (data do processamento) e updatedAt
});

// Índice para consulta eficiente por usuário e data
EverestXmlSummarySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('EverestXmlSummary', EverestXmlSummarySchema); 