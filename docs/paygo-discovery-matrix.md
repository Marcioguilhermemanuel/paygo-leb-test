# PayGo Discovery Matrix

## Product lifecycle truth matrix

| Capability | Public API | Dashboard behavior | Status | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| Create product | `POST /products` | confirmed by Lab and docs | CONFIRMED | public API + lab behavior |
| List products | `GET /products` | confirmed by Lab and docs | CONFIRMED | public API + lab behavior |
| Update product | not documented as public API | `PATCH /rest/v1/products?id=eq.<PRODUCT_ID>&select=*` | OBSERVED | Dashboard Network |
| Update price | not documented as public API | same `PATCH /rest/v1/products` flow | OBSERVED | Dashboard Network |
| Update description | not documented as public API | same `PATCH /rest/v1/products` flow | OBSERVED | Dashboard Network |
| Update other fields | not documented as public API | full-row object patch | OBSERVED | Dashboard Network |
| Delete product | not documented as public API | `DELETE /rest/v1/products?id=eq.<PRODUCT_ID>` | OBSERVED | Dashboard Network |
| Payment existence check before delete | not documented as public API | `HEAD /rest/v1/payments?select=id&product_id=eq.<PRODUCT_ID>` | OBSERVED | Dashboard Network |
| Related ticket-zone deletion | not documented as public API | `DELETE /rest/v1/product_ticket_zones?product_id=eq.<PRODUCT_ID>` | OBSERVED | Dashboard Network |
| Public update endpoint | unknown | internal implementation only | UNKNOWN | not documented/captured as public contract |
| Public delete endpoint | unknown | internal implementation only | UNKNOWN | not documented/captured as public contract |
| Hard delete semantics | unknown | not directly observed at DB layer | UNKNOWN | no DB evidence |
| Soft delete semantics | unknown | not directly observed at DB layer | UNKNOWN | no DB evidence |
| Product sync contract for third parties | unknown | not documented by PayGo | UNKNOWN | no public lifecycle API documented |
| Dashboard backend technology | internal Supabase PostgREST | confirmed by Network | OBSERVED | Dashboard requests |
| Public API vs internal API | documented/public contract | distinct from internal Dashboard implementation | CONFIRMED | clear separation by evidence |

---

## Evidence ranking

### DOCUMENTED

- `README.md` describes the supported PayGo API shape and setup.
- `packages/shared/src/schemas.ts` defines the public product/payment request contracts used by the Lab.
- `apps/api/src/lib/paygo-client.ts` implements the public API client used by the Lab.

### OBSERVED

- `POST /products` and `GET /products` are implemented and used by the Lab.
- The PayGo Dashboard performs `PATCH /rest/v1/products` to edit the product.
- The PayGo Dashboard performs `HEAD /rest/v1/payments?product_id=eq.<id>` before deletion.
- The PayGo Dashboard performs `DELETE /rest/v1/products?id=eq.<id>` to remove the product.
- The Dashboard also issues `DELETE` against `product_ticket_zones` as part of the cleanup path.

### INFERRED

- The Dashboard implementation is internal Supabase PostgREST, not necessarily a public PayGo API contract.
- The public API contract that BeSelly can rely on is the documented API, not the Dashboard’s internal database access layer.

### HYPOTHESIS

- The product lifecycle could eventually be exposed by PayGo through a public contract, but this was not observed in the current Lab or public API documentation.

### UNKNOWN

- the official public update/delete contract
- the exact business rule on deleting products with existing payments
- hard delete vs soft delete semantics beneath the database layer
- official third-party catalog synchronization mechanism

---

## Operational conclusion

The Lab now has sufficient evidence to conclude:

- create and list are public and confirmed
- edit and delete are observed in the Dashboard and are performed via Supabase PostgREST
- those internal Dashboard endpoints must not be treated as a public PayGo integration API
- BeSelly should continue to depend on the documented public API unless PayGo formally exposes a lifecycle contract
