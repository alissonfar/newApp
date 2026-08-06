// backend/src/services/contaFixaCronService.js
const cron = require('node-cron');
const { processarContasFixasAutomaticas } = require('./contaFixaService');

let task = null;

function iniciarCron() {
  if (task) return;
  // Todo dia às 3h da manhã
  task = cron.schedule('0 3 * * *', () => {
    processarContasFixasAutomaticas()
      .then((resultado) => console.log('[ContaFixaCron] Execução concluída:', resultado))
      .catch((err) => console.error('[ContaFixaCron] Erro na execução:', err));
  });
}

function pararCron() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { iniciarCron, pararCron };
