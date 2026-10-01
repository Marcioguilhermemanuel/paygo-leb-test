# PayGo API Findings: Documented vs Observed

Este relatório compara rigorosamente o que está documentado nos materiais da PayGo Checkout Angola com o que é observado no laboratório de integração.

## 1. Classificação Epistemológica

- **DOCUMENTED**: Consta formalmente na documentação oficial da PayGo.
- **OBSERVED**: Constatado diretamente através de chamadas HTTP reais e logs no Lab.
- **ASSUMED**: Hipótese de trabalho razoável, pendente de verificação empírica.
- **UNKNOWN**: Comportamento totalmente desconhecido.

---

## 2. Mapa de Endpoints e Parâmetros

| Endpoint | Método | Status Documentado | Status Observado | Observações |
| :--- | :---: | :---: | :---: | :--- |
| `/products` | POST | DOCUMENTED | UNKNOWN | Aceita name, price, flags mcx/ref/stripe |
| `/products` | GET | DOCUMENTED | UNKNOWN | Retorna listagem de produtos da conta |
| `/payments` | POST | DOCUMENTED | UNKNOWN | Aceita produto único ou array `items` |
| `/payment-status/{id}` | GET | DOCUMENTED | UNKNOWN | Documenta `pending`, `completed`, `failed`, `cancelled` |
| `/checkout-links` | POST | DOCUMENTED | UNKNOWN | Gerador de link de checkout web |
| `/sales` | GET | DOCUMENTED | UNKNOWN | Listagem de vendas |
| `/withdrawals` | POST | DOCUMENTED | UNKNOWN | Saques (NÃO chamar em testes) |
| `/order-bumps` | GET/POST | DOCUMENTED | UNKNOWN | Adicionais de pedido (Fase posterior) |
| `/webhooks/paygo` (Lab) | POST | DOCUMENTED (HMAC) | UNKNOWN (PayGo real) | Header `X-Webhook-Signature` |

---

## 3. Questões Críticas para Investigação Experimental

1. **Qual é o valor mínimo real de transação?**
   - Documentação não especifica se aceita 5 Kz, 50 Kz, 100 Kz ou mais.
   - Hipótese (`ASSUMED`): Sistemas bancários angolanos (EMIS / Multicaixa) costumam impor pisos transacionais.
2. **Formato exato do payload do Webhook:**
   - A documentação declara HMAC-SHA256 sobre o `request_body`.
   - Resta descobrir se o payload contém `{ "payment_id": "...", "status": "...", ... }` ou envelope aninhado `{ "event": "...", "data": { ... } }`.
3. **Formato exato do header `X-Webhook-Signature`:**
   - Hexadecimal simples (`abc123...`) ou prefixado (`sha256=abc123...`)?
   - O PayGoClient suporta ambos os formatos para comparação segura.
4. **Idempotência nativa na PayGo:**
   - Não há header documentado como `Idempotency-Key`.
   - O Lab implementa proteção interna para nunca disparar chamadas duplicadas por rede/retry sem consulta prévia.
