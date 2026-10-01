# PayGo Product Lifecycle Discovery

## Final Investigation Status

**STATUS: COMPLETED**

This investigation closes the lifecycle scope required by the Lab: it separates what is confirmed through the public PayGo API from what was observed directly in the authenticated PayGo Dashboard Network session, without promoting internal implementation details into a public integration contract.

---

## 1. Confirmed through the public API

### Create product

**DOCUMENTED + OBSERVED**

The Lab confirms that the public PayGo API supports product creation via:

```http
POST /products
```

Evidence in the repository:

- `apps/api/src/lib/paygo-client.ts` implements `createProduct()`
- `packages/shared/src/schemas.ts` validates required product fields
- `apps/api/src/services/product.service.ts` persists the returned PayGo product ID
- `docs/paygo-behavior.md` records a real successful product creation

### List products

**DOCUMENTED + OBSERVED**

The Lab confirms that the public PayGo API supports product listing via:

```http
GET /products
```

Evidence in the repository:

- `PayGoClient.listProducts()` performs `GET /products`
- the Lab exposes a comparison route in `apps/api/src/routes/product.routes.ts`
- product listing is documented and observed in the working behavior log

---

## 2. Confirmed through Dashboard Network observation

### Product update

**OBSERVED — Dashboard implementation**

The Dashboard performs a product update through Supabase PostgREST using:

```http
PATCH https://rouxavcvorjiwhpjhsye.supabase.co/rest/v1/products?id=eq.<PRODUCT_ID>&select=*
```

Observed behavior:

- HTTP status: `200 OK`
- the Dashboard submits the full product object, not only the changed field
- the update includes fields such as:
  - `name`
  - `price`
  - `description`
  - `banner_bottom_urls`
  - `banner_side_url`
  - `banner_top_urls`
  - `enable_coupons`
  - `file_url`
  - `image_url`
  - `payment_multicaixa`
  - `payment_reference`
  - `payment_stripe`
  - `thank_you_url`
  - `ticket_mode`
  - `upsell_enabled`
- `updated_at` is refreshed after modification

This confirms:

> Product update is observed at Dashboard level.

### Price update

**OBSERVED — Dashboard implementation**

The product price was changed from `1` to `5` through the same Dashboard update mechanism:

```http
PATCH /rest/v1/products?id=eq.<PRODUCT_ID>&select=*
```

This confirms:

> Product price update is confirmed at Dashboard level.

### Description update

**OBSERVED — Dashboard implementation**

The Dashboard update request includes the modified product description and persists it via the same `PATCH` flow.

This confirms:

> Product description update is observed at Dashboard level.

---

## 3. Delete flow observed in the Dashboard

### Payment existence check before delete

**OBSERVED — Dashboard implementation**

Before deleting the test product, the Dashboard performed:

```http
HEAD https://rouxavcvorjiwhpjhsye.supabase.co/rest/v1/payments?select=id&product_id=eq.<PRODUCT_ID>
```

Observed result:

- HTTP status: `200 OK`

This proves that the Dashboard checks whether associated payments exist before deleting the product.

### Product deletion

**OBSERVED — Dashboard implementation**

The deletion itself was observed as:

```http
DELETE https://rouxavcvorjiwhpjhsye.supabase.co/rest/v1/products?id=eq.<PRODUCT_ID>
```

Observed result:

- HTTP status: `204 No Content`

The Dashboard also previously performed a related delete against:

```http
DELETE https://rouxavcvorjiwhpjhsye.supabase.co/rest/v1/product_ticket_zones?product_id=eq.<PRODUCT_ID>
```

with `204 No Content`.

These observations support the following precise statement:

> The PayGo Dashboard performs a real DELETE against the `products` resource after checking for associated payments.

### Business rule when payments exist

**UNKNOWN**

We observed that the Dashboard checks for related payments before deletion, but we did not observe or confirm the business rule applied when payments are present.

The following remain unknown:

- allow delete
- block delete
- archive instead of delete
- require confirmation
- another conditional rule

---

## 4. Dashboard Internal API vs Public Integration API

The requests observed in the authenticated Dashboard session are internal implementation details of the PayGo application:

```http
/rest/v1/products
/rest/v1/payments
/rest/v1/product_ticket_zones
```

These are Supabase PostgREST calls used by the Dashboard. They are strong evidence of the internal implementation, but they are not sufficient to promote the endpoints to a public PayGo integration contract.

The Lab must continue to use only the endpoints already documented and implemented in the public integration layer:

```http
POST /products
GET /products
POST /payments
GET /payment-status/{payment_id}
POST /checkout-links
GET /sales
POST /withdrawals
```

This means the Lab should keep the following distinction explicit:

- Dashboard internal implementation: **OBSERVED**
- Public PayGo integration contract: **DOCUMENTED / OBSERVED only where confirmed by the Lab**
- Internal Dashboard endpoints promoted to public API: **NOT ALLOWED / NOT VALIDATED**

---

## 5. What remains unknown

The following items are still unknown and should stay that way unless a formal PayGo contract or live official documentation confirms them:

- public third-party update endpoint
- public third-party delete endpoint
- official lifecycle contract for product mutation
- exact semantics of hard delete vs soft delete in the underlying database
- exact business rule when deleting a product with existing payments
- idempotent product creation semantics beyond the observed Lab behavior
- official synchronization mechanism for external catalogs and third-party integrations

---

## 6. Engineering conclusion

The PayGo Dashboard can edit and delete products through internal Supabase PostgREST calls, but that does not mean those endpoints are a public integration API.

The correct engineering stance for BeSelly is:

- continue to depend only on documented/public PayGo API operations
- treat Dashboard network observations as internal implementation evidence
- do not add `PATCH /products` or `DELETE /products` to the public integration client based only on Dashboard internals
- keep the product synchronization logic explicit and local until PayGo documents a supported lifecycle contract

---

## 7. Final status

**Investigation complete for the Lab scope.**

### Confirmed

- Create product
- List products
- Product edit in Dashboard
- Product price update in Dashboard
- Product description update in Dashboard
- Product delete in Dashboard
- payment existence check before delete
- related `product_ticket_zones` delete request in Dashboard

### Unknown / not promoted to public API

- public update endpoint
- public delete endpoint
- hard delete semantics
- soft delete semantics
- delete business rule when payments exist
- official product sync contract for third-party integrations

This closes the lifecycle investigation without creating unsupported production dependencies.
