# PayGo Integration Lab — Diretrizes de Segurança

Este documento estabelece as regras e salvaguardas de segurança mandatórias aplicadas em todo o código do laboratório.

---

## 1. Princípios de Proteção de Segredos

1. **Backend Exclusivo**: Nenhuma credencial (`PAYGO_API_KEY`, `PAYGO_WEBHOOK_SECRET`) pode ser exposta ao frontend ou enviada nas respostas da API.
2. **Sanitização de Logs**:
   - Headers sensíveis (`x-api-key`, `Authorization`) são mascarados antes de qualquer persistência em banco ou console.
   - Variáveis de ambiente sensíveis nunca são impressas em logs.
3. **Mascaramento de PII (Dados Pessoais)**:
   - Telefones de clientes são mascarados nos logs: e.g., `923456789` -> `923***789`.
   - E-mails são anonimizados: e.g., `usuario@dominio.com` -> `u***o@dominio.com`.

---

## 2. Validação Criptográfica de Webhooks

1. **Raw Body Preserved**: O cálculo da assinatura HMAC-SHA256 é feito estritamente sobre os bytes brutos do request (`req.rawBody`), sem passar por `JSON.parse` seguido de `JSON.stringify`.
2. **Constant-Time Comparison**:
   - Comparações de assinatura usam `crypto.timingSafeEqual` para prevenir ataques de tempo (timing attacks).
3. **Rejeição Imediata**:
   - Assinaturas ausentes ou inválidas recebem HTTP `401 Unauthorized` imediato.
   - Nenhum estado de pagamento ou pedido é alterado mediante webhook inválido.
4. **Proteção contra Replay & Duplicação**:
   - Cada evento é registrado com hash único (`SHA-256(payload + paymentId)`).
   - Se um webhook for entregue múltiplas vezes (at-least-once delivery), o processamento ocorre apenas uma vez (idempotente).

---

## 3. Segurança Financeira e Salvaguardas contra Gastos Reais

1. **Prevenção de Retry Cego**:
   - Se ocorrer timeout de rede ao chamar `POST /payments`, o sistema NUNCA faz retry cego do POST.
   - Primeiro faz-se uma consulta controlada do status ou reconciliação para evitar criar duas cobranças ao cliente.
2. **Modo Live Explícito**:
   - A variável `PAYGO_MODE=live` ativa aviso visual explícito no frontend (`⚠️ LIVE PAYMENT`).
   - Pagamentos em modo live exigem consentimento deliberado do operador com confirmação de valor.
3. **Rate Limiting**:
   - Rotas de criação de pagamento e webhooks possuem limitadores de taxa para prevenir disparo em massa acidental ou malicioso.
4. **Conferência de Valor (Amount Mismatch)**:
   - Ao receber confirmação de pagamento (seja via Webhook ou GET status), o valor retornado pela PayGo é comparado com o valor registrado internamente no Lab.
   - Qualquer discrepância aciona status `AMOUNT_MISMATCH` e impede a conclusão automática do pedido.
