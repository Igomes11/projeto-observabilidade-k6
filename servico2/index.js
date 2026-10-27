const express = require('express');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// 10 "cozinheiros": só 10 pedidos são preparados ao mesmo tempo.
// O resto espera na fila.
const POOL_SIZE = Number(process.env.POOL_SIZE || 10);
let emUso = 0;
const fila = [];

const poolEmUso = new client.Gauge({ name: 'db_pool_em_uso', help: 'Cozinheiros ocupados', registers: [register] });
const filaPool = new client.Gauge({ name: 'db_pool_fila', help: 'Pedidos esperando na fila', registers: [register] });

function adquirir() {
  if (emUso < POOL_SIZE) { emUso++; poolEmUso.set(emUso); return Promise.resolve(); }
  return new Promise(resolve => { fila.push(resolve); filaPool.set(fila.length); });
}

function liberar() {
  const proximo = fila.shift();
  filaPool.set(fila.length);
  if (proximo) proximo();
  else { emUso--; poolEmUso.set(emUso); }
}

app.get('/processar', async (req, res) => {
  await adquirir();                                          // espera um cozinheiro livre
  try {
    const tempo = Math.floor(Math.random() * 100) + 150;    // preparo: 0,15 a 0,25s
    await new Promise(r => setTimeout(r, tempo));
    res.json({ mensagem: 'Processado com sucesso', tempo });
  } finally {
    liberar();                                               // libera o cozinheiro
  }
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.listen(4000, () => console.log(`Serviço 2 na porta 4000 (cozinheiros=${POOL_SIZE})`));