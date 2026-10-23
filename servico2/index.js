const express = require('express');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

app.get('/processar', async (req, res) => {
  // Simula um gargalo de processamento pesado ou banco lento
  const atraso = Math.floor(Math.random() * 1500) + 500; // 500ms a 2s
  await new Promise(resolve => setTimeout(resolve, atraso));

  res.status(200).json({ mensagem: 'Processado com sucesso', tempo: atraso });
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.listen(4000, () => console.log('Serviço 2 rodando na porta 4000'));