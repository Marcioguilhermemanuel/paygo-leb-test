# PayGo Observed Behavior Log

Este documento registra todas as anomalias, respostas não documentadas, comportamentos observados e limites descobertos durante os testes empíricos do **PayGo Integration Lab**.

> **Regra de Ouro (Seção 51):**  
> Diferenciar rigorosamente entre:
> - `DOCUMENTED`: Declarado na documentação oficial da PayGo.
> - `OBSERVED`: Comprovado via requisição real com payload e resposta salvos.
> - `ASSUMED`: Hipótese ainda não validada experimentalmente.
> - `UNKNOWN`: Desconhecido até o momento.

---

## Log de Descobertas

### Descoberta #000 (Baseline Documentado)

#### Teste
Análise da especificação inicial e documentação oficial da PayGo Checkout Angola.

#### Documentado
- Base URL: `https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1`
- Autenticação: Header `x-api-key: <API_KEY>`
- Endpoints documentados:
  - `POST /products`
  - `GET /products`
  - `POST /payments`
  - `GET /payment-status/{payment_id}`
  - `POST /checkout-links`
  - `GET /sales`
  - `POST /withdrawals`
  - `GET /order-bumps`
  - `POST /order-bumps`
  - `POST /product-order-bumps`
  - `DELETE /product-order-bumps`
- Métodos de pagamento: `multicaixa`, `reference`, `stripe`
- Status documentados: `pending`, `completed`, `failed`, `cancelled`
- Webhook: Assinatura HMAC-SHA256 no header `X-Webhook-Signature` sobre o raw body.

#### Status
DOCUMENTED

## Descoberta #001

### Teste
- `GET /products` com a chave configurada.
- `POST /products` com nome, preço e métodos de pagamento, sem `thank_you_url`.

### Real
- `GET /products` respondeu `200`, com `total: 0` e lista vazia.
- `POST /products` respondeu `400`: `Required fields: name, price, thank_you_url`.

### Resposta Sanitizada
```json
{
  "listProducts": { "status": 200, "total": 0, "products": [] },
  "createProduct": {
    "status": 400,
    "error": "Required fields: name, price, thank_you_url"
  }
}
```

### Conclusão
`thank_you_url` é obrigatório na criação de produtos, embora não constasse no contrato local anterior. Nenhum produto foi criado. A URL de retorno precisa ser fornecida antes de repetir o POST.

### Data
2026-09-30

## Descoberta #002

### Teste
`POST /products` em modo `test`, com preço `1`, métodos Multicaixa e referência ativos, Stripe desativado e `thank_you_url` público.

### Real
- PayGo respondeu `201` e criou o produto.
- O identificador veio em `product.id`, não no nível superior da resposta.
- Nenhum pagamento foi criado.

### Resposta Sanitizada
```json
{
  "success": true,
  "product": {
    "id": "ef74611c-c254-45e1-9c7d-7bda01c5d6c9",
    "name": "BeSelly PayGo Lab Test",
    "price": 1,
    "active": true,
    "created_at": "2026-09-29T23:33:54.581966+00:00"
  }
}
```

### Conclusão
O parser do Lab agora reconhece `product.id`. O registro local criado inicialmente com ID temporário foi corrigido para o ID retornado pelo PayGo.

### Data
2026-09-30

## Descoberta #003

### Teste
`POST /payments` para o produto de laboratório de `1 AOA`, método `multicaixa`, usando dados sintéticos e a configuração local `PAYGO_MODE=test`.

### Real
- PayGo respondeu `400` com `The payment was refused by Multicaixa Express system`.
- Nenhum `payment_id` de pagamento nem URL de checkout foi retornado; a resposta incluiu `details.paymentId` com status `failed`.
- O Lab persistiu o registro local com status `FAILED`.

### Resposta Sanitizada
```json
{
  "error": "The payment was refused by Multicaixa Express system. If the problem persist, please contact Multicaixa Express support team.",
  "details": {
    "success": false,
    "error": "The payment was refused by Multicaixa Express system. If the problem persist, please contact Multicaixa Express support team.",
    "paymentId": "61315e2d-1c36-4896-a0d9-1b9ab542089c",
    "status": "failed"
  }
}
```

### Conclusão
`PAYGO_MODE=test` é um controle local e não comprova que `PAYGO_BASE_URL` aponta para um sandbox. Não repetir pagamentos nem testar outro método até confirmar com a PayGo que a base URL e a chave são de sandbox.

### Data
2026-09-30

---

## Hosted Checkout vs API Payment (2026-09-30)

### DOCUMENTED
- O contrato fornecido para `POST /payments` lista `product_id`, `items[]`, `payment_method`, `customer_name`, `customer_email`, `customer_phone` e `order_bump_ids[]`, autenticado com `x-api-key`.

### OBSERVED
- `GET /products` respondeu `200`; o produto `ef74611c-c254-45e1-9c7d-7bda01c5d6c9` veio com preço `1`, ativo, Multicaixa e referência habilitados, Stripe desabilitado, descrição nula e sem campo de moeda.
- O operador relata que o checkout hospedado do mesmo produto concluiu um pagamento de `1 AOA` e redirecionou para `thank_you_url`; não foi repetido nesta investigação.
- O GET da página hosted checkout retornou `200`. HTML e bundles foram baixados por GET e lidos estaticamente, sem executar JavaScript.
- No bundle, a callback escolhe `thank_you_url` (ou `upsell_url`) e atribui diretamente a `window.location.href`; não acrescenta visivelmente `payment_id` ou status à URL. O checkout também contém polling do RPC `get_payment_status` e um estado `completed`; o redirect, isoladamente, não autentica o estado para o Lab.
- O bundle do checkout lê o produto por `get_public_product_for_checkout`, consulta estado por `get_payment_status` e chama a Supabase Edge Function `appypay-charge` para o fluxo Multicaixa. O bundle não contém uma chamada direta literal a `/payments`.
- A chamada estática para `appypay-charge` usa propriedades camelCase: `productId`, `amount`, `customerName`, `customerEmail`, `customerPhone`, `paymentMethod`, `orderBumpIds`, com `merchantTransactionId` e `ticketZones` condicionais. O telefone é montado como `countryCode + phone`; o estado inicial do checkout mostra `+244`. O body observado não contém propriedade `currency`.
- A tentativa já registrada pelo Lab enviou `POST` a `https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1/payments`, com `Content-Type: application/json` e header `x-api-key` (valor omitido). Não há header adicional configurado pelo cliente. O body sanitizado tinha `product_id`, `payment_method`, `customer_name`, e-mail/telefone mascarados e `idempotency_key`; não tinha `amount`, `currency` nem `order_bump_ids`.
- O log preserva a resposta completa: HTTP `400`, erro de recusa Multicaixa e `details: { success: false, error, paymentId: "61315e2d-1c36-4896-a0d9-1b9ab542089c", status: "failed" }`. Isso não é o campo `payment_id` de um pagamento concluído. O ID local foi persistido como `FAILED`; `paygoPaymentId` permaneceu nulo.
- O Lab calcula localmente `amount` a partir do produto e define `currency: "AOA"`, mas não envia nenhum desses dois campos no body de `/payments`. A chamada hosted inclui `amount` calculado pelo checkout; qualquer conversão/moeda dentro da função não pode ser vista no bundle.
- A chamada hosted usa o mesmo produto e flags; o endpoint público `GET /products` não devolveu `thank_you_url`. O POST de criação enviou essa URL, mas o modelo local não a persiste. O operador relata que o hosted checkout redirecionou para ela; o redirect não altera estado financeiro.
- O `400` foi recebido do endpoint PayGo configurado e o texto atribui a recusa ao sistema Multicaixa Express. A camada interna que originou a recusa não é identificável pela resposta.
- A resposta `400` veio do endpoint PayGo configurado e atribui a recusa ao sistema Multicaixa Express. A camada interna que originou a recusa não é identificável pela resposta.
- `PAYGO_MODE` não altera `PAYGO_BASE_URL` nem headers. No código, `live` apenas exige `confirmed_live`; modo e URL também são exibidos no diagnóstico/log do Lab.
- O endpoint local valida HMAC sobre o raw body, usa comparação em tempo constante e bloqueia payloads replay pelo hash. Testes automatizados cobrem isso; nenhum webhook real foi observado. `/thank-you` não altera nem confirma estado financeiro.
- O template `.env.example` continha valores com formato de credencial. Foi substituído por placeholders; se os valores anteriores eram válidos, revogar/rotacionar as credenciais.

### UNKNOWN
- Se `appypay-charge` chama internamente `POST /payments`, outro endpoint, ou um fluxo proprietário.
- Se o `400` veio de uma validação PayGo anterior ao Multicaixa ou de uma recusa efetivamente originada pelo Multicaixa.
- Formato de telefone exigido pelo backend PayGo/Multicaixa; documentação/código local só exigem string com mínimo de seis caracteres. O request do Lab enviou `923000111` sem código de país; o frontend do checkout concatena `+244` ao campo local.
- Se o backend do checkout recebe moeda separada, transforma o valor, ou adiciona outros campos/contexto.
- Se `details.paymentId` é identificador interno PayGo ou de tentativa; não é o `paygoPaymentId` armazenado pelo Lab.
- Se `thank_you_url` é retornada por GET ou qual parâmetro o redirect acrescenta. A criação funcionou e o checkout hospedado do operador redirecionou, mas o produto retornado por GET não expôs esse campo.
- Se existe sandbox PayGo separado e quais URL/credenciais o habilitam. `REAL SANDBOX: UNKNOWN`; no repositório não há evidência de uma URL sandbox ou credenciais distintas.
- Se haverá webhook real, qual será seu payload e se chegará à API quando o túnel estiver configurado.

### ASSUMED
- `PAYGO_MODE=test` é apenas uma proteção local enquanto a PayGo não confirmar explicitamente que a URL e a chave configuradas são de sandbox.
- `appypay-charge` pode intermediar a mesma API REST, mas o nome da função não prova isso; a implementação da Edge Function não está disponível nos bundles públicos inspecionados.
- O sucesso relatado no hosted checkout pode usar regras/configuração ou um canal interno diferente do POST direto, mas a evidência disponível ainda não identifica qual diferença causou a recusa.

### Evidência da requisição do Lab
```json
{
  "product_id": "ef74611c-c254-45e1-9c7d-7bda01c5d6c9",
  "payment_method": "multicaixa",
  "customer_name": "PayGo Lab Test",
  "customer_email": "pay***@example.com",
  "customer_phone": "923***111",
  "idempotency_key": "beselly-lab-payment-test-20260930"
}
```

### Próxima ação recomendada
Solicitar à PayGo a implementação/contrato de `appypay-charge`, o fluxo REST equivalente ao checkout hospedado, requisitos de `customer_phone`, a semântica de `details.paymentId` e a existência/configuração de sandbox. Não repetir cobrança até haver confirmação de ambiente sandbox.

<!-- Novas descobertas serão registradas abaixo seguindo este formato padrão:

## Descoberta #00X

### Teste
Descrição exata da requisição efetuada.

### Esperado
Comportamento teoricamente esperado.

### Real
Comportamento observado e HTTP Status.

### Resposta Sanitizada
Payload retornado pela PayGo.

### Conclusão
Inferência técnica baseada em evidência.

### Data
YYYY-MM-DD
-->
