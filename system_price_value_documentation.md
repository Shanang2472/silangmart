# Silang Mini Mart — System Price & Value Documentation

## Document Purpose
This document records the **estimated system price (value price)** in Philippine Peso (PHP) for the **Silang Mini Mart Point-of-Sale (POS), Inventory & Delivery Management System**, and provides a clear justification for the quoted range.

---

## 1) Estimated System Value Price (PHP)

### A. Base estimated value (custom build value)
- **₱150,000 – ₱350,000 PHP**

### B. Production-ready value (after security hardening + deployment setup)
- **₱250,000 – ₱500,000 PHP**

### C. Suggested “single quote” value
- **≈ ₱300,000 PHP**

---

## 1.1 System price value (by module price value)

> Assumption: Pricing is estimated for a **single-store deployment** (one branch), with the full feature scope delivered and documented.

| Module | Estimated Module Price (PHP) | Why this value (what it covers) |
|---|---:|---|
| **1) Point-of-Sale (POS)** | **₱70,000 – ₱140,000** | Cart + variant pricing, discount rules (Senior/PWD/percentage), payment method handling (Cash/GCash/Maya as logged), stock decrement logic integration, and **receipt generation (jsPDF)** plus transaction saving. |
| **2) Inventory Management** | **₱45,000 – ₱90,000** | Product CRUD, variant tiers (retail/pack/box/wholesale), image upload handling, barcode uniqueness/data constraints, per-branch stock records, and low-stock notification workflow. |
| **3) Delivery Management + Tracking** | **₱50,000 – ₱110,000** | Delivery order lifecycle (Pending → Preparing → Out for Delivery → Delivered/Cancelled), admin assignment workflow, rider dashboard data, and map-based tracking (Leaflet + OpenStreetMap) including rider coordinate updates/ETA field support. |
| **4) Value-Added Services (VAS)** | **₱18,000 – ₱45,000** | E-Load/Bills Payment/Remittance transaction forms and logging, fee/total computations, and history/audit-style storage in the service transaction table. |
| **5) Branch Analytics** | **₱20,000 – ₱55,000** | Aggregation queries across POS/delivery/VAS tables, dashboard KPIs, chart/report generation logic, and date/branch filtering. |
| **6) AI Assistant (Gemini integration)** | **₱25,000 – ₱75,000** | Role-based personas, backend API integration, prompt handling and response formatting, plus reliability work (rate limiting, error handling) for LLM calls. |
| **7) Security hardening + deployment readiness** | **₱20,000 – ₱85,000** | Addresses production risks: secure password storage (hashing), safer config/secrets handling, production environment checks, and migration/rollback readiness. (This is reflected in why the “production-ready” range is higher.) |

### Consolidated estimate logic (how these add up)
- **Base build** (demo/local readiness): typically **₱150k–₱350k** covers modules (1–6) + basic backend/DB integration and testing.
- **Production-ready**: add **security hardening + deployment readiness** (module 7), bringing the total to **₱250k–₱500k**.

---

## 2) Why the System Is Priced at This Range (Detailed Breakdown)

Pricing for software projects in the Philippines is usually based on **module scope**, **complexity**, **work hours**, **testing/QA**, and **deployment readiness**.

This system includes multiple business-critical modules:

### 2.1 Core Modules Included (Major Cost Drivers)
1. **Point-of-Sale (POS)**

   - Barcode/product lookup
   - Cart + quantity handling
   - Variant-based pricing
   - Discounts (Senior/PWD/percentage)
   - Payment logging (Cash, GCash, Maya as recorded methods)
   - **Receipt generation (jsPDF)**

2. **Inventory Management**
   - Product CRUD
   - Variant pricing tiers (Retail/Pack/Box/Wholesale)
   - Per-branch stock tracking
   - Low-stock notifications
   - Image/variant image upload

3. **Delivery Management + Tracking**
   - Delivery order creation and status lifecycle
   - Rider dashboard
   - Delivery map (Leaflet + OpenStreetMap)
   - Driver live coordinates update mechanism

4. **Value-Added Services (VAS) Logging**
   - E-Load, Bills Payment, Remittance transaction logging

5. **Branch Analytics**
   - Sales summaries and performance dashboards
   - Revenue trend visualization
   - Top-selling product reporting

6. **AI Assistant (Gemini integration)**
   - Role-based personas (Admin/Customer/Cashier/Rider)
   - API integration + rate limiting

Because the system covers the complete “store operations workflow” (sales → stock → delivery → services → analytics) it is priced like a **multi-module custom business application**, not a small website.

### 2.2 Project Effort and Complexity
- Full-stack development: **React (SPA) + Node/Express + MySQL/MariaDB**
- Role-based access and multiple dashboards
- Database schema design and relationship modeling
- Map feature integration (real-time-ish tracking workflow)
- Receipt/transaction record generation
- API design for multiple domains (auth, products, POS, inventory, deliveries, services, analytics)

These increase engineering time and validation/testing effort.

---

## 3) Important Pricing Adjustment: Security Gap (Value Impact)
The system documentation includes a **critical limitation**:
- **Staff passwords are stored as plain text** in the `users` table.

### Impact on value
- If the system is sold/used as **production-grade**, this must be fixed (e.g., bcrypt/Argon2 hashing and migration/update strategy).
- Without hardening, the system price is reduced to reflect production risk.

This is why:
- **Base value:** ₱150k–₱350k (works for demonstration/local use)
- **Production-ready value:** ₱250k–₱500k (assumes hardening + proper deployment)

---

## 4) What the Quoted Price Typically Includes
The quoted ranges assume the project includes (or is delivered with):
- Working features for all listed modules
- API + database integration
- Basic operational documentation (setup, workflow, manuals)
- Local deployment workflow (XAMPP + Node server)

Production-ready pricing additionally assumes:
- Security hardening (password hashing)
- Deployment setup readiness (environment configuration guidance)
- Risk remediation for public/operational usage

---

## 5) Final Suggested Quote
If you need one number for your proposal or agreement:

✅ **Suggested value price: ₱300,000 PHP**

---

## 6) Notes / Disclaimer
- This is an **estimated** price based on system scope and typical PH software project costing.
- Final pricing can vary depending on:
  - additional branches or scaling requirements
  - number of products/seed data requirements
  - required UI revisions
  - security fixes and compliance level
  - whether AI is used with real API cost exposure

