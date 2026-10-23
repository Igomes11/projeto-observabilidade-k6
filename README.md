# Seminário de Observabilidade: Testes de Carga (Tema 14)

Repositório com a demonstração prática para o **Seminário de Observabilidade em Sistemas Distribuídos**.

Este projeto aborda o **Tema 14 (Testes de carga guiados por observabilidade)**, provando na prática como a falta de visibilidade esconde gargalos de desempenho e como ferramentas de telemetria ajudam a identificar o ponto exato de saturação (falha de SLO) em um sistema sob estresse.

## Arquitetura da Solução

O ambiente é 100% JavaScript (Node.js) e orquestrado via Docker, cumprindo o requisito de possuir múltiplos serviços se comunicando em rede:

* **Serviço 1 (Gateway)**: API Express (`porta 3000`) que recebe o tráfego externo e repassa internamente.

* **Serviço 2 (Processador)**: API Express (`porta 4000`) que simula uma operação pesada/assíncrona (gargalo proposital).

* **Prometheus**: Banco de dados de séries temporais que faz a coleta (*scrape*) das métricas a cada 5 segundos (`porta 9090`).

* **Grafana**: Painel interativo para visualização de latência e percentis p95/p99 ao vivo (`porta 3001`).

* **Grafana k6**: Ferramenta injetora de carga (executada via CLI/Docker) para simular até 300 usuários virtuais (VUs).

## Como Executar a Demonstração (Quick Start)

### Pré-requisitos

* [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/) instalados.

### 1. Subir a Infraestrutura

Na raiz deste repositório, abra o terminal e execute o comando abaixo. Ele fará o build das imagens Node.js e iniciará toda a stack de telemetria:

```
docker compose up -d --build

```

### 2. Validar o Ambiente

Verifique se tudo está rodando corretamente acessando os links no seu navegador:

* **API Gateway**: http://localhost:3000/api/pedidos

* **Prometheus**: http://localhost:9090

* **Grafana**: http://localhost:3001 *(Credenciais padrão: admin / admin)*

## Iniciar o Teste de Carga

Para simular o tráfego em massa e causar a degradação da API, utilize o **k6** rodando diretamente via Docker (sem necessidade de instalação local).

No terminal, execute:

```
docker run --rm -i --network="host" grafana/k6 run - < k6/teste_carga.js

```

### O que observar durante o teste:

1. **Rampa de Carga**: O script subirá de 1 para **300 usuários virtuais (VUs)** em cerca de 1 a 2 minutos.

2. **Saturação**: A latência (tempo de resposta) passará o nosso SLO (limite aceitável de 2 segundos).

3. **Diagnóstico no Grafana**: Acesse o Grafana e adicione a *query* PromQL abaixo para visualizar o gráfico de latência p95 disparando exatamente no pico de tráfego:

```
rate(http_request_duration_seconds_sum[1m]) / rate(http_request_duration_seconds_count[1m])

```

*(O k6 também exibirá no terminal um relatório final indicando quantas requisições ultrapassaram a marca de 2 segundos).*

## Estrutura de Diretórios

```
projeto-observabilidade-k6/
├── package.json              # Dependências globais Node.js (express, prom-client)
├── docker-compose.yml        # Orquestração de todos os serviços (1 comando)
├── prometheus.yml            # Configuração de coleta de métricas
├── README.md                 # Este documento
├── servico1/
│   ├── Dockerfile
│   └── index.js              # Código do Gateway HTTP
├── servico2/
│   ├── Dockerfile
│   └── index.js              # Código do Processador com atraso simulado
└── k6/
    └── teste_carga.js        # Script JS com as etapas e métricas do teste

```

##  Equipe

* **Igor Gomes**

* **Hérik Thiury**

**Instituição**: Instituto Federal de Pernambuco (IFPE) - Análise e Desenvolvimento de Sistemas (ADS).