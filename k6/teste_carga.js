import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas personalizadas (como mostrado na palestra)
export const falhasRate = new Rate('taxa_de_falhas');
export const duracaoPedidos = new Trend('duracao_pedidos');

export const options = {
  // Rampa de carga para encontrar o ponto de quebra
  stages: [
    { duration: '30s', target: 20 },  // Carga normal
    { duration: '1m',  target: 100 }, // Aumento de carga
    { duration: '1m',  target: 300 }, // Ponto de saturação / estresse
    { duration: '30s', target: 0 },   // Desaceleração
  ],
};

export default function () {
  const res = http.get('http://localhost:3000/api/pedidos');

  // Adiciona tempo às métricas personalizadas
  duracaoPedidos.add(res.timings.duration);

  // Validação (Check) do status HTTP 200
  const sucesso = check(res, {
    'status é 200': (r) => r.status === 200,
    'resposta em menos de 2s': (r) => r.timings.duration < 2000,
  });

  // Registra a taxa de falha se o check falhar
  falhasRate.add(!sucesso);

  sleep(0.5); // Intervalo entre requisições
}