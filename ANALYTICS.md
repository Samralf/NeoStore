# Neo Coffee — Google Analytics 4

## Current implementation status

The storefront integration is prepared. It is inactive unless the deployed Worker has a valid `GA_MEASUREMENT_ID` for the owner's GA4 web stream. Account/property creation, stream configuration and live data receipt must be verified separately; code installation alone does not establish them.

## Account setup checklist (requires the owner's Analytics account)

1. Reuse a suitable existing GA4 property, or create `Neo Coffee Store` in the owner's account. Use reporting time zone Egypt/Cairo and currency EGP.
2. Create/reuse a Web stream for `https://neocoffeestore.com`, named `Neo Coffee — Website`. Record the Measurement ID beginning `G-`.
3. Turn off Enhanced Measurement for this stream. This integration explicitly controls page views to avoid duplicate history events and collection of form contents or unsanitized link/query data. Native GA4 session, first-visit and engagement measurement remain part of the Google tag.
4. Keep Google Signals and advertising personalization off. Do not enable user-provided-data collection.
5. Set event data retention to 14 months if desired for longer explorations; this is a property setting, not something the application applies.
6. Define an internal-traffic rule for the owner's known public IP if required. Keep filters in Testing until checked, because active exclusion removes data from processing.
7. Mark `order_placed` as a key event after it appears. It means an order was accepted, not that money was collected. Do not equate it with paid revenue. No purchase/payment-reconciliation or refunds integration is included.
8. Configure Worker variable `GA_MEASUREMENT_ID` with the actual stream ID. Keep it in the deployment configuration/account; it is a public identifier, not an API secret. `wrangler deploy --keep-vars` preserves existing deployed variables.
9. Verify a consented test visit in Realtime and inspect DebugView/Tag Assistant as appropriate. Confirm one page_view per actual page change and a view_item for a product. Never create a real order merely to test analytics.

## What is collected

| Event / metric | Meaning |
| --- | --- |
| page_view | Store, product and privacy page views; URL query strings and fragments are removed |
| users / sessions / first_visit | GA4 browser-based audience and visits, subject to consent, browser storage and blockers |
| user_engagement | Active foreground engagement time from the Google tag |
| country / device | Approximate geography and device characteristics from GA4 |
| view_item_list / select_item / view_item | Catalog and product-detail interactions |
| add_to_cart / remove_from_cart / view_cart | Shopping cart interactions |
| begin_checkout / add_payment_info | Checkout initiation and selected payment method |
| order_placed | Successful order creation; reported value is order total, not proof of payment |
| contact_whatsapp | Click on the floating WhatsApp support link |

Admin routes are outside the store layout and do not load this analytics integration. Checkout names, phone numbers, emails, addresses, OTP codes and receipt files are never forwarded by the analytics event helper. Events have an explicit parameter allowlist. Google scripts are not requested before consent; refusal preserves normal shopping. Consent can be withdrawn from the Privacy settings button.

## Where to read reports

- **Realtime:** current activity after accepting analytics.
- **Reports → Engagement → Pages and screens** (or **Examine user behavior**): page views, active users and average engagement time by page. Names depend on the property's report collection.
- **Acquisition → Traffic acquisition:** sessions and source/medium; referrers are reduced to their origin. This implementation strips URL campaign parameters as part of URL sanitization, so UTM campaign attribution is not currently implemented.
- **User attributes → Demographic details:** use Country as the dimension. No Google Signals is needed for the basic geographic dimension.
- **Engagement → Events / Key events:** cart and checkout events plus order_placed. For a custom funnel use view_item → add_to_cart → begin_checkout → order_placed.
- **Explore:** combine Page path with Views, Active users, Sessions and Average engagement time; add Country as a breakdown. Event-level custom parameters may require custom definitions before they can be used in explorations.

## Important interpretation

- Measurement starts after activation and visitor consent; historical traffic is not reconstructed.
- Users are not a guaranteed count of individual people: different browsers/devices and cookie resets affect the count.
- Engagement time means active/foreground time, not all elapsed time with a tab open.
- Countries are approximate, and VPN/proxy usage can change them.
- Reports need processing time; Realtime is the first verification point. Declined consent, ad blockers and network failures produce gaps.
- The order database remains the source of truth for orders and money. Browser analytics is not an accounting ledger.

## Verification

`npm test` includes analytics cases for Measurement ID validation, consent, duplicate initialization/pageviews, query removal, event parameter filtering and consent withdrawal. Live GA4 verification remains mandatory after linking the actual stream.

## Official references

- [Google: measure pageviews](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Google: ecommerce events](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)
- [Google: consent mode](https://developers.google.com/tag-platform/security/guides/consent)
- [Google: Pages and screens report](https://support.google.com/analytics/answer/12926732)
