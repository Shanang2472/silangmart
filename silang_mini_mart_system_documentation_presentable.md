# Silang Mini Mart — System Software Documentation

> **Point-of-Sale (POS), Inventory & Delivery Management System**

---

## Document Info

| Field | Value |
|---|---|
| **Document Title** | System Software Documentation |
| **Project** | Silang Mini Mart — POS, Inventory & Delivery |
| **Version** | 1.1 |
| **Date** | 2026-07-14 |
| **Prepared By** | [Information Required] |
| **Reviewed By** | [Information Required] |
| **Approved By** | [Information Required] |

---

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. System Overview](#2-system-overview)
- [3. Software Architecture](#3-software-architecture)
- [4. Technology Stack](#4-technology-stack)
- [5. Functional Requirements](#5-functional-requirements)
- [6. Non-Functional Requirements](#6-non-functional-requirements)
- [7. User Roles and Permissions](#7-user-roles-and-permissions)
- [8. System Modules](#8-system-modules)
- [9. Database Documentation](#9-database-documentation)
- [10. User Interface Documentation](#10-user-interface-documentation)
- [11. System Workflow](#11-system-workflow)
- [12. UML Documentation](#12-uml-documentation)
- [13. API Documentation](#13-api-documentation)
- [14. Security Documentation](#14-security-documentation)
- [15. Installation Guide](#15-installation-guide)
- [16. User Manual](#16-user-manual)
- [17. Administrator Manual](#17-administrator-manual)
- [18. Testing Documentation](#18-testing-documentation)
- [19. Error Handling](#19-error-handling)
- [20. Backup and Recovery Plan](#20-backup-and-recovery-plan)
- [21. Maintenance Plan](#21-maintenance-plan)
- [22. Future Enhancements](#22-future-enhancements)
- [23. Appendix](#23-appendix)

---

## 1. Introduction

### 1.1 Purpose

This document provides a **technical and operational reference** for:
- Developers
- System administrators
- Store management
- Cashiers, riders, and customers (user-facing manual sections)
- Academic reviewers (capstone/thesis evaluation)

### 1.2 Background

Silang Mini Mart previously relied on **manual** processes:
- Handwritten inventory logs
- Manual calculations for sales
- Informal delivery coordination

These led to:
- Stock tracking delays and inaccuracies
- Slower checkout
- Limited reporting/visibility
- Lack of real-time delivery updates

### 1.3 Objectives

| Objective | What it enables |
|---|---|
| Digitize POS | Fast checkout, automated change, receipts |
| Real-time inventory | Multi-branch stock tracking and low-stock alerts |
| Customer portal | Browse → cart → order → delivery tracking |
| Rider dashboard | Delivery status updates + map tracking |
| Value-added services | E-Load, Bills Payment, Remittance logging |
| Branch analytics | Sales KPIs, trends, top products |
| AI chatbot assistant | Role-based Q&A using Google Gemini |

### 1.4 Scope

In scope:
- POS transactions
- Inventory management
- Customer portal and delivery tracking
- Rider dashboard
- Value-added services
- Branch analytics
- Supplier delivery workflows
- AI assistant

> **Out of scope (current version):** e-commerce marketplace integrations, automated payment verification APIs, HR/payroll, multi-franchise enterprise management.

### 1.5 Limitations (Known Issues)

> ⚠️ These limitations are documented intentionally for transparency.

1. **Passwords stored in plain text** for staff users in `users` table.
2. GCash/Maya are logged by cashier without electronic verification.
3. Live rider GPS is sent by the rider's browser while a delivery is active. HTTPS, location permission, internet access, and an open dashboard are required; background browser tracking is not guaranteed.
4. No offline-first mode.
5. Only one branch is configured in the dataset (architecture supports more).
6. AI chatbot requires Gemini API key and internet connectivity.

### 1.6 Intended Audience

| Audience | Purpose |
|---|---|
| Developers | Technical implementation reference |
| Admin/System Admin | Installation & maintenance |
| Store Manager/Admin | Configuration & operations |
| Cashiers | POS + VAS transaction processing |
| Delivery Riders | Dashboard usage |
| Customers | Portal & tracking |
| Academic reviewers | Thesis/capstone evaluation |

---

## 2. System Overview

### 2.1 Business Problem

Small neighborhood grocery operations often suffer from:
- inventory mismatch
- slow checkout
- unclear delivery status
- lack of analytics

### 2.2 Proposed Solution

A full-stack **web-based system** that integrates store operations under a single **role-based** application.

### 2.3 Key Features (Quick Look)

- ✅ Multi-role authentication (Admin/Cashier/Rider/Customer)
- ✅ POS terminal (barcode/name lookup, discounts, cash & digital payment logging)
- ✅ Inventory with variants and per-branch stock tracking
- ✅ Customer portal (cart, addresses, order placement, live tracking)
- ✅ Delivery tracking map (Leaflet + OpenStreetMap)
- ✅ Rider dashboard status updates
- ✅ VAS logging (E-Load, Bills, Remittance)
- ✅ Branch analytics dashboards
- ✅ Supplier delivery management
- ✅ AI assistant (Gemini personas)

### 2.4 Expected Benefits

| Benefit | Impact |
|---|---|
| Operational efficiency | Less time per transaction |
| Inventory accuracy | Reduced manual errors |
| Customer satisfaction | Transparent delivery tracking |
| Revenue visibility | Dashboards & trend analysis |
| Reduced stockouts | Low-stock notifications |

---

## 3. Software Architecture

### 3.1 Architecture Overview

- **Frontend:** React SPA (TypeScript)
- **Backend:** Node.js + Express.js REST API
- **Database:** MariaDB via `mysql2` connection pool

### 3.2 Architectural Pattern

- MVC-inspired separation (Model = DB, View = React components, Controller = Express routes)
- Layered architecture:
  - Presentation: React
  - API: Express routes
  - Business logic: route handlers + `src/utils/`
  - Data access: `src/db/mysql.ts`
  - Persistence: MariaDB

### 3.3 High-Level Interaction

```text
[Browser]
   | HTTP/AJAX (fetch)
   v
[Express API Server (server.ts)]
   |--- /api/auth, /api/pos, /api/products, ...
   |
   v
[MariaDB]

[External]
   ^
   | HTTPS
[Google Gemini API] (AI assistant)
```

---

## 4. Technology Stack

| Category | Tech |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Motion |
| Backend | Express.js, Node.js, TypeScript |
| Database | MariaDB, mysql2 |
| AI | @google/genai (Gemini API) |
| Maps | Leaflet.js + OpenStreetMap tiles |
| Utilities | Multer (uploads), jsPDF (receipts), QRCode (QR generation) |

---

## 5. Functional Requirements

### Functional Requirements (Summary)

| Req. ID | Feature | Role(s) | Priority |
|---|---|---|---|
| FR-001 | Multi-role login | All | High |
| FR-004 | POS transaction processing | Cashier/Admin | High |
| FR-008 | Product catalog CRUD | Admin | High |
| FR-012 | Stock tracking per branch | Admin | High |
| FR-023 | Real-time delivery tracking | Customer | High |
| FR-026 | Rider status update | Rider | High |
| FR-028 | E-Load logging | Cashier/Admin | High |
| FR-031 | Branch analytics | Admin | High |
| FR-036 | AI chatbot (Admin persona) | Admin | Medium |

---

## 6. Non-Functional Requirements

| Category | ID | Requirement |
|---|---|---|
| Security | NFR-004 | JWT required for protected endpoints |
| Security | NFR-005 | Password hashing required (currently TODO) |
| Performance | NFR-001 | API response < 500ms under normal load |
| Availability | NFR-013 | 99% uptime during store hours |
| Reliability | NFR-009 | Graceful DB failures |

> ⚠️ Current implementation note: hashing is required as a security hardening step.

---

## 7. User Roles and Permissions

### Admin / Manager
- Full access to inventory, POS (view), deliveries, analytics, users, settings

### Cashier
- POS and VAS processing
- Applies discounts

### Delivery Rider
- Views assigned deliveries
- Updates delivery status and GPS coordinates

### Customer
- Product browsing and ordering
- Delivery tracking
- Manages delivery addresses

---

## 8. System Modules

### 8.1 Authentication

- JWT issued after login
- Protected endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
```

> ⚠️ Limitation: staff password storage is plain text.

### 8.2 Point-of-Sale (POS)

- Barcode/name lookup
- Variant pricing tiers
- Discounts: Senior/PWD/Percentage
- Payment method logging: Cash, GCash, Maya
- Cash change computation
- Receipt generation using jsPDF
- Stock decrement integration

### 8.3 Inventory Management

- Product CRUD
- Variant pricing (retail/pack/box/wholesale)
- Per-branch stock tracking
- Low-stock notifications
- Image gallery and variant images via Multer

### 8.4 Customer Portal

- Browse by category
- Cart management
- Address management with map pins
- Order placement
- Delivery tracking map

### 8.5 Delivery Management

Status lifecycle:

`Pending → Preparing → Out for Delivery → Delivered/Cancelled`

Includes admin assignment and rider status updates.

### 8.6 Value-Added Services (VAS)

- E-Load
- Bills Payment
- Remittance

Transactions are logged for audit-style history.

### 8.7 Branch Analytics

- Sales summaries
- Top-selling products
- Revenue trends by date range

### 8.8 AI Assistant (Gemini)

Role-based personas:
- Admin: Business advisor
- Customer: Ate Digy shopping assistant
- Cashier: POS operations assistant
- Rider: Delivery dispatch co-pilot

---

## 9. Database Documentation

### 9.1 Database Overview

- **DB Name:** `silang_mini_mart`
- **DBMS:** MariaDB 10.4.32
- **Charset:** `utf8mb4`

### 9.2 Entities (High-level)

- `branches`
- `users`
- `customers`
- `customer_delivery_addresses`
- `products`
- `product_stock`
- `product_variants`
- `deliveries`, `delivery_items`
- `orders_transactions`, `orders_transaction_items`
- `service_transactions`
- `supplier_deliveries`, `supplier_delivery_items`
- `system_notifications`
- `system_settings`

---

## 10. User Interface Documentation

> Visual documentation placeholders are preserved.

### 10.1 Role-Based Login
- Role selector (Admin/Cashier, Rider, Customer)
- Name/Password-PIN

> 📷 **Screenshot placeholder:** Login Screen

### 10.2 POS Terminal (Cashier)
- Product search
- Variant selection
- Cart panel
- Discounts + payment
- Receipt generation

> 📷 **Screenshot placeholder:** POS Terminal

### 10.3 Inventory Management (Admin)
- Product grid + stock columns
- Add/Edit product modal

> 📷 **Screenshot placeholder:** Inventory Management

---

## 11. System Workflow

### 11.1 Customer Order Workflow
1. Register/Login
2. Browse and add to cart
3. Select address on map
4. Place delivery order
5. Track status live

### 11.2 POS Workflow
1. Cashier login
2. Search/scan products
3. Select variants + quantity
4. Apply discounts
5. Choose payment method
6. Confirm transaction
7. Generate receipt
8. Deduct stock

---

## 12. UML Documentation

Use-case / activity / sequence descriptions are retained as narrative sections.

---

## 13. API Documentation

Key conventions:
- JWT via `Authorization: Bearer <token>`
- REST endpoints under `/api/*`

---

## 14. Security Documentation

### Critical Gap (Must Fix)

> ⚠️ **Staff passwords in `users` table are stored in plain text.**

Recommended remediation:
- bcrypt/argon2 hashing migration
- credential reset procedure

### File Upload Security
- Multer image type filter (`image/*`)
- max 5MB per file

---

## 15. Installation Guide

High-level:
- Install XAMPP
- Install Node.js
- Copy project into `htdocs`
- Configure `.env.local`
- Import `silang_mini_mart.sql`
- Run `npm install` then `npm run dev`

---

## 16. User Manual

Customer:
- Browse products
- Add to cart
- Place delivery order
- Track delivery

Cashier:
- Run POS
- Apply discounts
- Log VAS transactions
- Print receipt

Rider:
- View assigned deliveries
- Update status and GPS

---

## 17. Administrator Manual

- Manage inventory and stock
- Assign and oversee deliveries
- View analytics and notifications
- Manage system settings
- Database backup/restore

---

## 18. Testing Documentation

Includes:
- Unit test cases
- Integration test cases
- System test cases
- UAT templates

---

## 19. Error Handling

Troubleshooting table retained with examples:
- Missing `GEMINI_API_KEY`
- MySQL service not running
- JWT invalid/expired
- Duplicate barcode

---

## 20. Backup and Recovery Plan

Includes:
- Backup schedule
- Backup locations
- Manual backup command
- Recovery procedures and RTO/RPO objectives

---

## 21. Maintenance Plan

- Preventive maintenance (weekly/daily checks)
- Corrective maintenance process
- Adaptive and perfective maintenance suggestions

---

## 22. Future Enhancements

A prioritized roadmap including:
- bcrypt password hashing (critical)
- HTTPS/SSL deployment
- User management UI
- Automated backups
- Offline POS (PWA)
- payment API integration

---

## 23. Appendix

- Screenshot placeholders
- Source code structure
- Database schema summary
- Sample report placeholders

---

*End of Document*
