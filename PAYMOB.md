# Paymob test integration

This release provides administrator-only TEST configuration and hosted Unified Checkout testing. Customer Paymob checkout and LIVE activation remain disabled. No real credentials are committed or supplied by this release.

In `/store`, open Settings → Paymob. Copy TEST Public Key, Secret Key and HMAC from Paymob Settings → API Keys. API Key is optional and encrypted for later use; Create Intention uses Secret Key. Enter your account's matching TEST integration IDs; IDs alone do not establish the enabled payment methods. Blank secret fields retain the saved values. Saving requires the current administrator password and authenticated session.

Secrets are AES-GCM encrypted using a key derived from SESSION_SECRET; changing that secret requires re-entering Paymob credentials and affects verification of outstanding attempts. Configuration responses return presence flags, never secret values. Provider client secrets are encrypted at rest and exposed only to the authenticated administrator for checkout.

- Webhook: `https://neocoffeestore.com/api/paymob/webhook`
- Return: `https://neocoffeestore.com/payment/return` (each intention supplies its own attempt query parameter)

Start the EGP 100 TEST from settings using test billing contact details and Paymob's documented test card. No local order or stock reservation is created. A signed callback matching provider order, integration, EGP currency and amount confirms the test. Redirect query strings never determine success. Duplicate callbacks are idempotent; failed callbacks cannot overwrite paid state. Refund/void/authorization or conflicting successful transactions require review. Raw callbacks and card details are not stored. Unsupported callback field shapes fail closed.

Pending: enter actual TEST credentials, complete a Paymob sandbox payment and verify callback delivery. Then implement/verify customer order reconciliation and release LIVE activation separately. The integration is not ready to accept real customer payments.

Reference: https://developers.paymob.com/paymob-docs/intention-apis/create-intention
