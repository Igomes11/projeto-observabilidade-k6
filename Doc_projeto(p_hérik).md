# Projeto Prático: Testes de Carga Guiados por Observabilidade
**Seminário de Observabilidade em Sistemas Distribuídos — Tema 14**  
**Stack:** Node.js (Express), Prometheus, Grafana, Grafana k6, Docker Compose  

---

## 📌 1. Visão Geral e Objetivos

Este projeto demonstra a aplicação de testes de carga integrados a uma pipeline de observabilidade em um ambiente de microsserviços em **Node.js**.

O objetivo principal é identificar a capacidade máxima de tráfego suportada pelo sistema, detectar o ponto exato de saturação e demonstrar a degradação da latência sob estresse através de métricas em tempo real no Grafana.

---

## 🏗️ 2. Arquitetura da Solução

A aplicação é composta por dois microsserviços se comunicando via rede HTTP, orquestrados via Docker Compose e monitorados pelo Prometheus e Grafana.

```
                   +------------------------+
                   |  Grafana k6 (Carga)    |
                   +------------------------+
                               |
                               | HTTP (Rampa de VUs)
                               v
                   +------------------------+
                   |  Serviço 1 (Gateway)   |  :3000
                   +------------------------+
                               |
                               | HTTP (Comunicação de rede)
                               v
                   +------------------------+
                   | Serviço 2 (Processador)|  :4000
                   +------------------------+
                               |
                               | Exposição de /metrics
                               v
                   +------------------------+
                   |       Prometheus       |  :9090
                   +------------------------+
                               |
                               | Fonte de Dados
                               v
                   +------------------------+
                   |        Grafana         |  :3001
                   +------------------------+
```

### Componentes:
1. **Serviço 1 (Gateway - `:3000`)**: Recebe chamadas de clientes externos e delega o processamento ao Serviço 2.
2. **Serviço 2 (Processador - `:4000`)**: Processa a regra de negócio com um atraso assíncrono controlado (simulando um gargalo de banco de dados/CPU).
3. **Prometheus (`:9090`)**: Coleta métricas expostas pelas APIs a cada 5 segundos.
4. **Grafana (`:3001`)**: Exibe dashboards em tempo real com as métricas RED (Rate, Errors, Duration).
5. **Grafana k6**: Ferramenta em JavaScript para geração de carga com usuários virtuais (VUs).

---

## 📁 3. Estrutura de Arquivos do Repositório

```text
projeto-observabilidade-k6/
├── package.json
├── docker-compose.yml
├── prometheus.yml
├── README.md
├── servico1/
│   ├── Dockerfile
│   └── index.js
├── servico2/
│   ├── Dockerfile
│   └── index.js
└── k6/
    └── teste_carga.js
```

---

## 💻 4. Código-Fonte do Projeto

### `package.json` (Raiz)
```json
{
  "name": "projeto-observabilidade-k6",
  "version": "1.0.0",
  "description": "Demonstração de testes de carga guiados por observabilidade",
  "main": "servico1/index.js",
  "scripts": {
    "start:s1": "node servico1/index.js",
    "start:s2": "node servico2/index.js"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "express": "^4.18.2",
    "prom-client": "^15.0.0"
  }
}
```

### `servico1/index.js` (Gateway)
```javascript
const express = require('express');
const axios = require('axios');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5]
});
register.registerMetric(httpRequestDuration);

app.get('/api/pedidos', async (req, res) => {
  const end = httpRequestDuration.startTimer();
  try {
    const resposta = await axios.get('http://servico2:4000/processar');
    res.status(200).json({ status: 'Sucesso', detalhe: resposta.data });
  } catch (err) {
    res.status(500).json({ status: 'Erro ao chamar servico2' });
  } finally {
    end({ method: 'GET', route: '/api/pedidos', code: res.statusCode });
  }
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.listen(3000, () => console.log('Serviço 1 (Gateway) rodando na porta 3000'));
```

### `servico1/Dockerfile`
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY servico1/ ./servico1/
EXPOSE 3000
CMD ["node", "servico1/index.js"]
```

### `servico2/index.js` (Processador)
```javascript
const express = require('express');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

app.get('/processar', async (req, res) => {
  // Simula um gargalo no processamento
  const atraso = Math.floor(Math.random() * 1200) + 300; 
  await new Promise(resolve => setTimeout(resolve, atraso));
  res.status(200).json({ mensagem: 'Processado com sucesso', tempoMs: atraso });
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.listen(4000, () => console.log('Serviço 2 rodando na porta 4000'));
```

### `servico2/Dockerfile`
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY servico2/ ./servico2/
EXPOSE 4000
CMD ["node", "servico2/index.js"]
```

### `prometheus.yml`
```yaml
global:
  scrape_interval: 5s
  evaluation_interval: 5s

scrape_configs:
  - job_name: 'servico1-gateway'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['servico1:3000']

  - job_name: 'servico2-processador'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['servico2:4000']
```

### `docker-compose.yml`
```yaml
services:
  servico1:
    build:
      context: .
      dockerfile: servico1/Dockerfile
    ports:
      - "3000:3000"
    networks:
      - rede-seminario

  servico2:
    build:
      context: .
      dockerfile: servico2/Dockerfile
    ports:
      - "4000:4000"
    networks:
      - rede-seminario

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - rede-seminario

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    networks:
      - rede-seminario

networks:
  rede-seminario:
    driver: bridge
```

### `k6/teste_carga.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

export const falhasRate = new Rate('taxa_de_falhas');
export const duracaoPedidos = new Trend('duracao_pedidos');

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Carga normal
    { duration: '1m',  target: 100 }, // Carga elevada
    { duration: '1m',  target: 300 }, // Ponto de estresse / saturação
    { duration: '30s', target: 0 },   // Desaceleração
  ],
};

export default function () {
  const res = http.get('http://localhost:3000/api/pedidos');

  duracaoPedidos.add(res.timings.duration);

  const sucesso = check(res, {
    'status é 200': (r) => r.status === 200,
    'resposta em menos de 2s': (r) => r.timings.duration < 2000,
  });

  falhasRate.add(!sucesso);
  sleep(0.2);
}
```

---

## 🚀 5. Como Executar e Reproduzir

1. **Subir a Infraestrutura com um único comando**:
   ```bash
   docker compose up -d --build
   ```

2. **Acessar os Serviços**:
   * **Serviço 1 (API)**: `http://localhost:3000/api/pedidos`
   * **Prometheus**: `http://localhost:9090`
   * **Grafana**: `http://localhost:3001` (Usuário: `admin` | Senha: `admin`)

3. **Executar o Teste de Carga**:
   * *Nativamente*:
     ```bash
     k6 run k6/teste_carga.js
     ```
   * *Via Docker*:
     ```bash
     docker run --rm -i --network="host" grafana/k6 run - < k6/teste_carga.js
     ```

---

## 📊 6. Análise dos Resultados Obtidos (Log do k6)

Durante o teste de carga, a execução gerou o seguinte resultado de saída do k6:

```text
  █ TOTAL RESULTS 

    checks_total.......: 23418  128.700846/s
    checks_succeeded...: 99.80% 23372 out of 23418
    checks_failed......: 0.19%  46 out of 23418

    ✓ status é 200
    ✗ resposta em menos de 2s
      ↳  99% — ✓ 11663 / ✗ 46

    CUSTOM
    duracao_pedidos................: avg=1261.588339 min=504.124263 med=1263.366935 max=2171.23735 p(90)=1856.623316 p(95)=1933.262882
    taxa_de_falhas.................: 0.39%  46 out of 11709

    HTTP
    http_req_duration..............: avg=1.26s       min=504.12ms   med=1.26s       max=2.17s       p(90)=1.85s       p(95)=1.93s     
      { expected_response:true }...: avg=1.26s       min=504.12ms   med=1.26s       max=2.17s       p(90)=1.85s       p(95)=1.93s     
    http_req_failed................: 0.00%  0 out of 11709
    http_reqs......................: 11709  64.350423/s

    EXECUTION
    iteration_duration.............: avg=1.76s       min=1s         med=1.76s       max=2.67s       p(90)=2.35s       p(95)=2.43s     
    iterations.....................: 11709  64.350423/s
    vus............................: 1      min=1           max=299
    vus_max........................: 300    min=300         max=300

    NETWORK
    data_received..................: 3.7 MB 20 kB/s
    data_sent......................: 948 kB 5.2 kB/s
```

### Diagnóstico Técnico:
* **Disponibilidade**: `http_req_failed = 0.00%`. O sistema manteve 100% das respostas com status HTTP 200.
* **Vazão**: Processou **11.709 requisições** com uma média de **64.35 req/s**.
* **Violação de SLO de Latência**: 46 requisições ultrapassaram o tempo limite estipulado de 2 segundos, atingindo um pico máximo de **2,17s**.
* **Percentil p95**: O tempo $p95$ ficou em **1,93s**, provando que sob 300 usuários virtuais concorrentes, o Serviço 2 saturou o tempo de resposta do Gateway.

---

## 📖 7. Glossário de Termos Técnicos

* **Observabilidade**: Capacidade de inferir os estados internos de um sistema com base nos seus dados de saída (métricas, logs e traces).
* **SLO (Service Level Objective)**: Meta interna configurável de desempenho ou disponibilidade (ex: 99% das respostas < 2s).
* **Métricas RED**: Padrão focado em **R**ate (Taxa de requisições), **E**rrors (Taxa de erros) e **D**uration (Duração/Latência).
* **Percentil p95**: Valor de latência abaixo do qual estão 95% de todas as requisições atendidas.
* **VUs (Virtual Users)**: Usuários virtuais concorrentes simulados pelo k6 para gerar carga na API.