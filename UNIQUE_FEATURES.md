# Unique and Standout Features of Silang Mini Mart

## Scope and claim

This document identifies features that make the **implemented Silang Mini Mart system distinctive within this repository**. “Unique” means unusual, highly specific, or implemented as a combination that is not commonly found in ordinary mini-mart POS projects—not that the same feature is impossible elsewhere. A true market-wide uniqueness comparison would require researching competing systems; this document is based on the current source code and database.

## Feature summary

| # | Standout feature | Why it is distinctive |
|---|---|---|
| 1 | Unified five-party marketplace operations | Admin, cashier, customer, rider, and supplier workflows operate in one application. |
| 2 | Filipino retail-selling modes | One product supports Tingi, Balot, Karton, and Pakyaw purchasing quantities and discounts. |
| 3 | Guided proof-of-delivery workflow | Delivery completion combines customer handover, photo evidence, payment confirmation, and status closure. |
| 4 | Role-aware AI business co-pilot | Gemini receives actual inventory context and uses different instructions for each portal role. |
| 5 | Branch-aware supply chain with supplier self-service | Suppliers submit planned deliveries and costs; administrators receive and reconcile them per branch. |
| 6 | Interactive local delivery and address intelligence | OpenStreetMap, route simulation, geocoding, reverse geocoding, location search, and vehicle selection support Silang operations. |
| 7 | In-store value-added services with unified transaction history | E-Load, utility bills, and remittance services are integrated beside ordinary POS sales. |
| 8 | Real-time, role-scoped notification system | Server-sent events deliver notifications to the correct user or role, including unread and preference controls. |
| 9 | Variant-level inventory and imagery by branch | Product variants, branch stock, stock limits, variant images, and low-stock behavior are handled explicitly. |
| 10 | Store-front customer image and location profiles | Customers can select their location on a map and upload/store a business or store image. |
| 11 | Receipt-oriented completion controls | PDF/electronic receipts, service receipts, and delivery receipts close each transaction type visibly. |
| 12 | Localized Silang/Cavite operational context | Interface language, addresses, barangays, providers, maps, and delivery assumptions are tailored to the community. |

---

## 1. Unified five-party marketplace operations

### Description

Silang Mini Mart is more than a cashier-only POS. The application provides connected portals for:

- **Admin/manager:** overall operations, inventory, analytics, staff, branches, and deliveries.
- **Cashier:** POS checkout, stock lookup, payments, and value-added services.
- **Customer:** store browsing, cart and checkout, profile, order history, and delivery tracking.
- **Rider:** assigned deliveries, route tracking, status updates, payment confirmation, and proof of delivery.
- **Supplier:** branch delivery submissions, item quantities, delivery dates, unit costs, and received status.

### Business explanation

All participants work from the same system of products, branches, orders, deliveries, and inventory rather than using separate disconnected applications. This can reduce duplicate data entry and improve traceability between purchasing, fulfillment, payment, and delivery.

### Implemented evidence

The frontend includes dedicated dashboards such as the customer portal, rider dashboard, and supplier dashboard, while the backend applies role authorization to administrative, rider, supplier, and customer resources.

---

## 2. Filipino retail-selling modes: Tingi, Balot, Karton, and Pakyaw

### Description

The customer shopping experience recognizes four purchasing formats inspired by Filipino sari-sari store practices:

- **Tingi:** a single retail unit.
- **Balot:** a pack of six with a 5% discount.
- **Karton:** a box of 24 with a 10% discount.
- **Pakyaw:** a wholesale quantity of 100 with a 15% discount.

The assistant and product UI explain these formats to customers instead of treating every transaction only as one product unit.

### Business explanation

The feature supports customer choice from single-use quantities through bulk purchasing. It also permits one package definition to produce several selling tiers, which are familiar to local shoppers and potentially useful to nearby food and sari-sari businesses.

### Implemented evidence

The role-specific Gemini instructions explicitly describe the four selling formats. Product variant and quantity logic is represented in the product and customer-store code.

---

## 3. Guided proof-of-delivery workflow

### Description

Finishing a delivery is implemented as a four-stage process:

1. Rider confirms physical handover to the customer.
2. Rider takes or uploads a proof-of-delivery photograph.
3. Rider records and validates cash or digital payment evidence.
4. Rider reviews the details and marks the order delivered.

The backend stores the photo URL, uploader, upload time, handover confirmation, payment method/status, payment references, and delivery status.

### Business explanation

This reduces disputes by producing evidence that goods were handed over and that payment was accounted for. Cash-on-delivery also requires the rider to acknowledge counting the correct amount. For digital payments, a reference and successful gateway status can be recorded in the same completion flow.

### Implemented evidence

`ProofOfDeliveryModal.tsx` orchestrates the customer-facing completion steps and calls dedicated backend endpoints for photo upload, payment, and delivery status. The delivery API independently validates payment totals and handover data.

---

## 4. Role-aware Gemini AI co-pilot

### Description

The AI assistant is role-aware rather than providing one generic chatbot to every user. It is configured as:

- An **admin business advisor** focused on inventory and reporting.
- **Ate Digy**, a customer shopping assistant using actual inventory and selling tiers.
- A **rider dispatch co-pilot** for route and delivery support.
- A **store operations assistant** for cashier and staff tasks.

### Business explanation

Role-specific instructions can improve relevance and reduce inappropriate answers. For example, a customer should receive shopping guidance while a rider should receive practical delivery support. The system also supplies current inventory context and instructs the model to avoid inventing unavailable products, prices, or stock.

### Implemented evidence

`server.ts` constructs a different Gemini system instruction based on the authenticated role, appends current system data, and enforces strict accuracy rules before sending the conversation to Gemini.

---

## 5. Branch-aware supplier delivery and receiving

### Description

The supplier portal allows a supplier to select a destination branch, proposed delivery date, products, quantities, and unit costs. Administrators can view suppliers’ deliveries, receive them, and update inventory. Supplier deliveries retain item-level quantities and cost information.

### Business explanation

The feature connects purchase-order-style planning with the store’s receiving process while keeping supplier activity separated from sensitive administrative functions. It creates an auditable path from a supplier delivery notice to physical branch reception and stock changes.

### Implemented evidence

`SupplierDashboard.tsx` and `src/routes/supplierDeliveries.ts` support supplier self-service creation, role authorization, branch targeting, totals, status, and receiving workflows.

---

## 6. Interactive local delivery maps and address intelligence

### Description

The delivery map uses Leaflet and both street-map and satellite layers. It supports:

- Search for Silang locations using geocoding.
- Reverse geocoding from a map point.
- Automatic address and barangay population.
- Branch, customer, and rider markers.
- Real road routes from the OSRM routing service.
- Animated distance-based rider movement.
- Motorcycle, truck, and tricycle vehicle selection.
- Fullscreen map mode and map resizing.

### Business explanation

This lets staff record the customer location without relying only on a typed address, while riders receive a visual route and customers can follow delivery progress. Local road routing is more operationally useful than a simple static store/customer pin.

### Implemented evidence

`DeliveryMap.tsx` handles map interactions and layers; `src/utils/routeUtils.ts` performs location search, reverse geocode, routing, and route-point generation.

---

## 7. In-store value-added services beside ordinary retail sales

### Description

The cash register environment also records three community service categories:

- **E-Load and mobile promos:** network, phone number, load amount, and service fee.
- **Bills payment:** provider, account details, payer name, bill amount, and fee.
- **Remittance and cash-in:** provider, sender, recipient, amount, and fee.

Every service produces a transaction record and printable receipt.

### Business explanation

Neighborhood stores often earn ancillary service fees and attract repeat visits. Integrating these transactions with the point-of-sale branch context prevents value-added-service activity from being managed in separate notes or spreadsheets.

### Implemented evidence

`ValueAddedServices.tsx`, the service API, and the `service_transactions` database table store and display these transactions.

---

## 8. Real-time, role-scoped notifications

### Description

The system supports notification preferences, unread counts, individual reads, mark-all-read actions, notification deletion, and server-sent events. Notifications can be personal to a user or targeted to a role. The frontend maintains active and system notification views.

### Business explanation

Operational events can reach only the users who need to act on them. For example, delivery or service events can remain separated from unrelated administrator messages. SSE also avoids requiring users to repeatedly refresh to discover a new event.

### Implemented evidence

The notification API exposes read and preference operations, and the backend establishes role/user-aware SSE streams through `/api/events`.

---

## 9. Variant-level inventory and imagery by branch

### Description

Products can contain variants, and each variant can have:

- Its own name and image.
- Per-branch stock records.
- A bulk stock limit.
- Individual stock-limit alerts.
- Inventory adjustment and image upload support.

### Business explanation

The feature prevents inventory from being simplified to one quantity for every branch and every package type. It is particularly useful when colors, sizes, flavors, or retail pack forms differ and when branches replenish at different rates.

### Implemented evidence

The schema contains `product_variants` and `product_stock`, while product routes provide variant image upload and bulk stock-limit functionality.

---

## 10. Store-front customer image and location profiles

### Description

Customer/shop profiles support an address, barangay, map coordinates, and a store image. Staff can upload the customer/store picture, and riders can use the profile’s map position and image when locating the destination.

### Business explanation

An image and precise coordinate can be more useful than a textual address in an area with similar road names or unclear landmarks. It also lets riders identify business customers when arriving at the correct building.

### Implemented evidence

Customer profile and store-image endpoints are implemented, and rider/customer delivery views reference coordinates and store images.

---

## 11. Transaction-completion receipts

### Description

The application has separate completion artifacts for POS sales, value-added services, and deliveries. Depending on the transaction, it can generate a PDF receipt, print a service receipt, or display delivery details in a receipt modal.

### Business explanation

Providing proof of completion at the counter and after delivery helps customers verify items, total amount, service details, and fulfillment status. Keeping these artifacts aligned with transaction type is more practical than using one generic receipt layout.

### Implemented evidence

The system imports `jspdf` and implements dedicated delivery and service receipt components.

---

## 12. Localized Silang/Cavite operational context

### Description

The interface and workflows are designed for the local community rather than as an entirely generic international retail template. They use English–Filipino conversational text, local barangay/address conventions, Philippine peso, common Philippine network and utility providers, and Silang/Cavite route examples.

### Business explanation

Localization reduces user training and makes address, payment, and service workflows feel familiar to staff and customers. It also lets terminology such as “E-Load,” “Bayad Bills,” “Pera Padala,” and “Pakyaw” communicate daily business use directly.

### Implemented evidence

This context appears throughout the UI, backend routing assumptions, seeded locations, provider lists, and role-specific AI prompts.

---

## Most defensible top differentiators

For a presentation or thesis defense, the strongest combined differentiators are:

1. A **single system connecting POS, customers, riders, and suppliers**.
2. **Proof of delivery plus COD/digital payment verification** in one completion flow.
3. **Filipino selling modes** combined with **actual inventory-aware AI guidance**.
4. **Branch-specific supplier receiving and variant inventory**.
5. **Localized maps, address geocoding, live delivery tracking, and notifications**.
6. **Neighborhood value-added services integrated into the same transaction system**.

These features are more compelling when presented as an integrated solution for a small Philippine mini-mart rather than as individual technologies used in isolation.
