# PayGo Integration Lab

Laboratório de engenharia isolado para testar, validar e documentar o comportamento empírico da API da **PayGo Checkout Angola** antes da integração definitiva na plataforma **BeSelly**.

---

## 1. SETUP

O projeto é configurado como um monorepo modular utilizando **pnpm workspaces**:

```bash
# Instalar dependências em todos os pacotes
pnpm install

# Compilar pacotes compartilhados
pnpm --filter @paygo/shared build
```

---

## 2. ENVIRONMENT

Copie o arquivo de exemplo para `.env`:

```bash
cp .env.example .env
```

Configurações obrigatórias no `.env`:

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `PAYGO_BASE_URL` | `https://rouxavcvorjiwhpjhsye.supabase.co/functions/v1/api-v1` | URL base oficial dos endpoints da PayGo |
| `PAYGO_API_KEY` | *(sua chave)* | Chave de API da conta verificada |
| `PAYGO_WEBHOOK_SECRET` | *(seu secret)* | Segredo compartilhado para conferência HMAC-SHA256 |
| `PAYGO_MODE` | `test` | Controle interno do Lab; `live` exige confirmação explícita. Não seleciona por si só um endpoint sandbox. |
| `DATABASE_URL` | `postgresql://...` | String de conexão PostgreSQL (com fallback em memória) |
| `API_PORT` | `3333` | Porta HTTP da API Fastify |
| `APP_URL` | `http://localhost:3000` | URL do Dashboard web Next.js |

> **Aviso Crítico de Segurança:** Nunca envie credenciais reais para o Git nem compartilhe a chave de API no frontend.
>
> Confirme que `PAYGO_BASE_URL` e a chave pertencem ao ambiente sandbox da PayGo antes de criar pagamentos. `PAYGO_MODE=test` não garante que a API externa esteja em sandbox.

---

## 3. DATABASE

O laboratório utiliza **Prisma** com **PostgreSQL**:

```bash
# Gerar o cliente Prisma
pnpm prisma:generate

# Sincronizar schema com o banco PostgreSQL
pnpm prisma:push
```

*Nota: Se o PostgreSQL estiver offline ou não configurado, o laboratório ativa automaticamente um repositório seguro in-memory com persistência durante a sessão para permitir testes imediatos sem interrupção.*

---

## 4. RUNNING

Inicie a API Fastify e o Dashboard Next.js:

```bash
# Iniciar ambos os serviços em paralelo
pnpm dev

# Ou individualmente:
pnpm dev:api    # Fastify API na porta 3333
pnpm dev:web    # Next.js Dashboard na porta 3000
```

Abra o navegador em: [http://localhost:3000](http://localhost:3000).

---

## 5. PAYGO CONFIGURATION

1. Acesse o painel da PayGo e certifique-se de que a conta está aprovada e verificada.
2. Copie a chave de API fornecida e adicione ao `.env` no campo `PAYGO_API_KEY`.
3. Defina o segredo de webhook no painel e configure no `.env` em `PAYGO_WEBHOOK_SECRET`.
4. Deixe inicialmente `PAYGO_MODE=test`.

---

## 6. CREATING TEST PRODUCT

Para criar um produto de teste sem assumir valores pré-estabelecidos:

1. No Dashboard, clique em **[ Criar Produto ]**.
2. Defina o nome e informe o valor desejado em Kwanzas (Kz) (e.g., 50 Kz, 100 Kz).
3. Ative os métodos aceitos (`Multicaixa Express`, `Referência`).
4. Clique em **Confirmar e Criar**.
5. O backend chamará `POST /products` na PayGo e salvará o `paygoProductId` retornado.

---

## 7. CREATING PAYMENT

Para testar a emissão de cobranças:

1. Clique em **[ Criar Pagamento ]**.
2. Selecione o produto de teste criado.
3. Escolha o método: `Multicaixa Express` (MCX) ou `Referência`.
4. Preencha nome, e-mail e telefone (9 dígitos).
5. Se `PAYGO_MODE=live` estiver ativo, uma janela modal de confirmação explícita impedirá cobranças acidentais.
6. A criação utiliza **chave de idempotência** única para blindar o sistema contra cobranças duplicadas.

---

## 8. CHECKING STATUS

1. Na tabela de pagamentos, clique em **Ver Detalhes**.
2. Clique no botão **[ Consultar PayGo Agora ]**.
3. O Lab executará `GET /payment-status/{payment_id}`, reconciliará os estados internos da máquina de estados (`PENDING` -> `COMPLETED`/`FAILED`/`CANCELLED`) e verificará se o valor cobrado pela PayGo bate com o valor registrado (`AMOUNT_MISMATCH`).

---

## 9. WEBHOOK SETUP

O endpoint oficial de recepção do webhook é:

```http
POST /api/webhooks/paygo
```

### Funcionamento de Segurança:
- **Raw Body**: Os bytes brutos do request são preservados para cálculo da assinatura.
- **HMAC-SHA256**: Validação criptográfica com `crypto.timingSafeEqual`.
- **Rejeição Automática**: Requisições sem assinatura ou adulteradas recebem imediatamente `401 Unauthorized`.
- **Proteção Replay / Duplicação**: O hash SHA-256 do payload impede que notificações duplicadas gerem efeitos repetidos.

Para testes locais com a PayGo externa, use ferramentas como ngrok ou Cloudflare Tunnel apontando para `http://localhost:3333`.

---

## 10. TESTING

Execute a suíte completa de testes automatizados com Vitest:

```bash
# Executar todos os testes (HMAC, sanitização, máquina de estados, rotas, concorrência)
pnpm test

# Executar teste específico de concorrência e race condition (10 simultâneos -> 1 criação real)
pnpm test:concurrency

# Executar script local de concorrência com 10 e 50 requisições
npx tsx scripts/test-concurrency.ts
```

---

## 11. SECURITY

- **Zero Secret Leaks**: A `PAYGO_API_KEY` e o `PAYGO_WEBHOOK_SECRET` nunca são registrados em logs nem expostos ao cliente.
- **PII Masking**: Números de telefone são automaticamente mascarados (`923***789`) e e-mails são anonimizados.
- **Prevenção de Retry Cego**: Em caso de timeout ao criar pagamentos, o sistema NUNCA repete cegamente a chamada para evitar dupla cobrança.
- **Rate Limiting**: Rate limiter ativo na API para prevenir abuso.

---

## 12. KNOWN LIMITATIONS

1. **Valores Mínimos da PayGo**: A documentação oficial não especifica se a PayGo aceita 5 Kz, 50 Kz ou 100 Kz. Testes empíricos deliberados devem ser executados para registrar o limite real.
2. **Order Bumps e Stripe**: Desativados propositalmente neste MVP de laboratório para focar nos meios angolanos (MCX e Referência).
3. **Withdrawn**: Bloqueado neste ambiente de teste.

---

## 13. DISCOVERED BEHAVIOR

Consulte o arquivo [`docs/paygo-behavior.md`](file:///c:/Users/Marcio/Documents/PayGomvp/docs/paygo-behavior.md) e a matriz [`docs/test-results.md`](file:///c:/Users/Marcio/Documents/PayGomvp/docs/test-results.md) para acompanhar as constatações experimentais.
# paygo-leb-test
