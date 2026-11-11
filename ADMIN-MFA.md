# Microsoft Authenticator for the owner account

The administration panel has one shared owner identity. MFA protects that identity; it does not create employee accounts or change customer sign-in.

## Enable

1. Open `/store`, sign in, then choose **الإعدادات → إعدادات الحساب → Microsoft Authenticator**.
2. Enter the current owner password and select **ربط Microsoft Authenticator**.
3. In Microsoft Authenticator choose **Add account → Other account** and scan the QR code (or enter the displayed secret manually).
4. Enter the current six-digit code and select **تأكيد وتفعيل الحماية** within ten minutes.
5. Download the ten recovery codes and store them privately, separately from the phone. They are displayed only once.

Enrollment is inactive until a valid code is confirmed. Confirmation invalidates prior owner sessions and renews the session completing enrollment. Subsequent logins require both the password and a current authenticator code or unused recovery code. A code already used for enrollment/login cannot be reused; wait for the next code.

## Recovery and management

Use a recovery code in the same code field, together with the password. Each recovery code works once. In Settings, a fresh code and the current password are required to regenerate recovery codes or disable MFA. Regeneration invalidates all previous recovery codes. Both operations revoke other sessions. To move to another phone, first verify that recovery codes are available, then disable and enroll the replacement device.

There is no email-only bypass. If both the device and recovery codes are lost, a verified operator with deployment/database access must perform an audited recovery; do not expose a public reset endpoint.

## Implementation and verification

- TOTP follows RFC 6238: SHA-1, six digits, 30-second periods, one adjacent period of clock tolerance. Accepted steps are atomically consumed.
- The secret is encrypted with AES-GCM using purpose-separated key material derived from the deployment's `SESSION_SECRET`. Preserve this secret during normal deployments; changing it also affects access to enrolled TOTP material.
- Recovery codes contain 80 bits of random entropy; only SHA-256 hashes are stored.
- QR generation happens locally in the UI. Enrollment secrets and recovery codes must never be logged, sent to analytics, or submitted to third-party QR services.
- Security responses use `Cache-Control: no-store`. Mutations require same-origin requests, a current owner session (except login), password verification, and rate limiting.
- MFA transitions rotate the shared authentication version. Password login never creates an authenticated cookie before MFA succeeds. Customer cookies have no administration privileges.
- Tests cover RFC vectors, enrollment expiry, failure rollback, session revocation, login gating, replay/concurrency, recovery rotation, and concurrent rate limits. Run `npm test`, `node node_modules/typescript/bin/tsc --noEmit`, and `npm run build`.

References: [Microsoft account setup](https://support.microsoft.com/en-us/authenticator/how-to-add-your-accounts-to-microsoft-authenticator), [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html), [local QR library](https://github.com/zpao/qrcode.react).
