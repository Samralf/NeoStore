# Customer login and checkout

Public storefront: `/`. Administration: `/store` (admin authentication required, noindex). Product and privacy pages use `/product/:id` and `/privacy`; their previous `/store/...` paths permanently redirect. API paths and the Google OAuth callback remain unchanged. Successful Google sign-in returns to `/`.

- Google sign-in or email/verified mobile plus password are available in Sign in.
- Existing customers first sign in using their existing Google/mobile method, then set a password in the profile. New mobile accounts verify once before setting a password. Passwords must be 12–128 characters.
- Login email is stored separately from the editable profile/contact email. Mobile login uses the verified number in customer_accounts, never a delivery contact number. Google identities are matched by Google subject, not by an editable email.
- A valid signed customer session completes checkout without another OTP. Guests still verify their phone. Delivery contact details remain required.
- Password changes require the current password. Google/mobile verification remains an alternative login method; email-only password recovery is not implemented.
- Passwords use salted PBKDF2 with a server-side pepper, request throttling, and HttpOnly session cookies. Password hashes are excluded from the existing business-data export. Rotating SESSION_SECRET invalidates sessions and requires password re-enrollment.
- The customer_passwords table is created lazily on first use. No existing password or account data is overwritten during deployment.

## Order save fix

Production orders.source is NOT NULL without a default. Website order insertion explicitly supplies website. Stock conflicts return 409; other persistence failures return 500 with a distinct message. Success returns the saved NC- order number for the confirmation screen.

The regression suite uses the inspected production orders schema and checks successful Google/session checkout, the saved order number/source, shipping discount, guest/tampered-session rejection, password aliases and changes, and Google account separation. No synthetic orders are created in production by this suite.
