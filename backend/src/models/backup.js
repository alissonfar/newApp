// src/models/backup.js
const mongoose = require('mongoose');

const BackupSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  size: { type: Number, required: true, default: 0 },
  type: { type: String, enum: ['mongodump', 'logical'], required: true },
  operation: { type: String, enum: ['backup', 'restore'], default: 'backup' },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  status: { type: String, enum: ['success', 'error'], required: true },
  errorMessage: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed } // database, collections count
});

BackupSchema.index({ createdAt: -1 });
BackupSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Backup', BackupSchema);
