// src/models/settlement.js
const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  receivingTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao', required: true },
  appliedTransactions: [{
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao', required: true },
    amountApplied: { type: Number, required: true }
  }],
  tagId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: true },
  removeTagId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tag', required: false },
  removedTagLog: {
    type: [{
      transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao', required: true },
      payerIndex: { type: Number, required: true }
    }],
    default: [],
    immutable: true
  },
  totalApplied: { type: Number, required: true },
  leftoverAmount: { type: Number, default: 0 },
  leftoverTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao', default: null },
  createdAt: { type: Date, default: Date.now }
}, {
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

SettlementSchema.index({ usuario: 1, createdAt: -1 });
SettlementSchema.index({ receivingTransactionId: 1 });
SettlementSchema.index({ 'appliedTransactions.transactionId': 1 });

module.exports = mongoose.model('Settlement', SettlementSchema);
