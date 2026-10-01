# PayGo Integration Test Matrix

Matriz de testes executados pelo **PayGo Integration Lab**. Atualizado conforme novos testes de unidade, integração e empíricos forem executados.

| Teste | Resultado | HTTP | Observação |
| :--- | :--- | :---: | :--- |
| Criar produto | Pendente de credencial | - | Requer PAYGO_API_KEY válida para chamada real |
| Listar produtos | Pendente de credencial | - | Requer PAYGO_API_KEY válida para chamada real |
| Criar MCX (Multicaixa Express) | Pendente de credencial | - | Transação real controlada com confirmação prévia |
| Criar referência | Pendente de credencial | - | Transação real controlada com confirmação prévia |
| Status (`GET /payment-status/:id`) | Pendente de credencial | - | Requer payment_id existente |
| Webhook válido (HMAC-SHA256) | Implementado & Testado | 200 | Validação criptográfica com raw-body conferida em teste de unidade |
| Webhook assinatura inválida | Implementado & Testado | 401 | Rejeição sem alteração no banco de dados conferida em teste |
| Webhook duplicado / replay | Implementado & Testado | 200 | Idempotência via hash de payload e payment_id |
| Carrinho multi-produto | Pendente de credencial | - | Testar SUM(price × quantity) |
| Quantity 0 / inválida | Pendente de credencial | - | Validar comportamento do endpoint da PayGo |
| Produto inválido / inexistente | Pendente de credencial | - | Validar formato de erro retornado |
| Idempotência interna (Lab) | Implementado & Testado | 200 | Reutilização segura da mesma operação |
| Race condition (10 simultâneos) | Implementado & Testado | 200 | 1 criação real, 9 reusos sem duplicação |

---

## Legenda de Resultados
- **Pendente de credencial**: Teste pronto no código, aguardando execução deliberada pelo operador com a chave API configurada.
- **Implementado & Testado**: Validado em suíte de testes automatizados com mocks ou ambiente isolado.
- **Sucesso**: Testado contra a API real da PayGo e verificado.
- **Falha**: Erro inesperado ou comportamento inconsistente.
