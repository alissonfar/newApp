// src/routes/rotasModeloRelatorio.js
const express = require('express');
const router = express.Router();
const controlador = require('../controllers/controladorModeloRelatorio');
const { autenticacao } = require('../middlewares/autenticacao');

router.use(autenticacao);

router.get('/', controlador.listar);
router.post('/', controlador.criar);
router.get('/:id', controlador.obterPorId);
router.put('/:id', controlador.atualizar);
router.delete('/:id', controlador.excluir);

module.exports = router;
