const express = require('express');
const axios = require('axios');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Métrica personalizada de duração de requisição
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5]
});
register.registerMetric(httpRequestDurationMicroseconds);

app.get('/api/pedidos', async (req, res) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  try {
    // Comunicação entre serviços via rede HTTP
    const resposta = await axios.get('http://servico2:4000/processar');
    res.status(200).json({ status: 'Sucesso', detalhe: resposta.data });
  } catch (err) {
    res.status(500).json({ status: 'Erro ao chamar servico2' });
  } finally {
    end({ method: 'GET', route: '/api/pedidos', code: res.statusCode });
  }
});

// Endpoint exigido pelo Prometheus para raspar métricas
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.listen(3000, () => console.log('Serviço 1 rodando na porta 3000'));