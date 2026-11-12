# Dependency security maintenance — 2026-11-12

Upgraded Next.js and its ESLint configuration to 16.4.6, React/React DOM/React Server Components to 19.3.1, Vinext to 1.4.5, Vite to 8.3.8, and the compatible Cloudflare plugin/Workers types/Wrangler versions recorded in `package.json`. Updated affected transitive packages in the lockfile.

Three scoped overrides are intentional. Remove them only when the parent dependencies resolve patched versions without overrides:

| Parent | Dependency override | Reason |
| --- | --- | --- |
| `@esbuild-kit/core-utils` | `esbuild` 0.25.12 | Older loader pulls an esbuild development-server advisory; avoid npm's suggested Drizzle downgrade. |
| `satori` | `fflate` 0.7.5 | Patch malformed ZIP64 denial of service while retaining current Vinext. |
| `@typescript-eslint/typescript-estree` | `minimatch` 11.0.1 | Patch glob amplification denial of service; project-aware parsing checked for compatibility. |

The full `npm audit` report (including development dependencies) returned zero vulnerabilities on this maintenance run. This describes known dependency advisories at the time, not a guarantee that the entire application is vulnerability-free. Recheck regularly with `npm audit`.

Regression checks include owner MFA/recovery/replay protection, customer sign-in, order inventory concurrency, and purchase posting/deletion. TypeScript and production build checks are required before deployment. Dependency changes do not alter database contents or activate MFA for the owner.

References: [Next.js advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr), [esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99), [fflate advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98), [minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).
