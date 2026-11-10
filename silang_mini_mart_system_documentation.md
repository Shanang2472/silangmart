# Silang Mini Mart — System Software Documentation

**Document Title:** System Software Documentation  
**Project Name:** Silang Mini Mart — Point-of-Sale, Inventory & Delivery Management System  
**Organization/Client:** Silang Mini Mart (Cainta Branch, Quezon City, Metro Manila)  
**Document Version:** 1.0  
**Date Prepared:** July 11, 2026  
**Prepared By:** [Information Required — Author Name/Team]  
**Reviewed By:** [Information Required]  
**Approved By:** [Information Required]

---

## Table of Contents

1. Introduction  
2. System Overview  
3. Software Architecture  
4. Technology Stack  
5. Functional Requirements  
6. Non-Functional Requirements  
7. User Roles and Permissions  
8. System Modules  
9. Database Documentation  
10. User Interface Documentation  
11. System Workflow  
12. UML Documentation  
13. API Documentation  
14. Security Documentation  
15. Installation Guide  
16. User Manual  
17. Administrator Manual  
18. Testing Documentation  
19. Error Handling  
20. Backup and Recovery Plan  
21. Maintenance Plan  
22. Future Enhancements  
23. Appendix  

---

# 1. Introduction

## 1.1 Purpose

This document serves as the official system software documentation for the **Silang Mini Mart Point-of-Sale, Inventory, and Delivery Management System** (hereinafter referred to as "the System"). It provides a comprehensive technical and operational reference for developers, system administrators, business owners, end users, and academic reviewers. The documentation covers all aspects of the system from its architecture and database design to installation procedures and user manuals.

## 1.2 Background

Silang Mini Mart is a locally operated neighborhood grocery store currently operating a branch at Stall 12, Karangalan Market, Cainta, Rizal, Metro Manila. Prior to the development of this system, the store relied on manual cash register operations, handwritten inventory logs, and informal delivery coordination, resulting in inefficiencies in stock tracking, slow transaction processing, and lack of real-time sales analytics.

Recognizing the need for digital transformation, the store management commissioned the development of a full-stack, web-based management system to streamline all core business operations including point-of-sale (POS) transactions, inventory management, customer delivery tracking, value-added services (e.g., E-Load, Bills Payment, Remittance), branch analytics, and an AI-powered assistant chatbot.

## 1.3 Objectives

The primary objectives of the Silang Mini Mart System are:

1. To digitize and automate the point-of-sale process, supporting Cash, GCash, and Maya payment methods with automated change computation and receipt generation.
2. To implement a real-time inventory management system with multi-branch stock tracking, barcode scanning support, variant pricing (Retail, Pack, Box, Wholesale), and low-stock alerts.
3. To provide a customer-facing online portal for browsing products, managing delivery addresses, placing orders, and tracking deliveries in real-time on an interactive map.
4. To enable delivery riders to view and update their assigned deliveries through a dedicated rider dashboard with GPS-based route assistance.
5. To offer value-added financial services including E-Load, Bills Payment (e.g., Meralco), and Remittance (e.g., Cebuana Lhuillier, Palawan Express).
6. To provide management with comprehensive branch analytics and business intelligence dashboards.
7. To integrate an AI-powered chatbot assistant (powered by Google Gemini) tailored to each user role—Admin, Customer, Cashier, and Rider.
8. To support supplier delivery tracking and stock restocking workflows.

## 1.4 Scope

The system covers the following operational domains:

- **Point-of-Sale (POS):** Transaction processing, receipt printing, discount application (Senior Citizen, PWD, Percentage), and digital payment acceptance.
- **Inventory Management:** Product cataloging, multi-variant pricing, branch-level stock tracking, barcode management, supplier deliveries, and low-stock notifications.
- **Customer Portal:** Account management, product browsing, cart management, delivery address management, order placement, and real-time delivery tracking.
- **Delivery Management:** Delivery order creation, status tracking (Pending → Preparing → Out for Delivery → Delivered/Cancelled), driver location tracking via Leaflet maps, and ETA computation.
- **Value-Added Services (VAS):** E-Load, Bills Payment, and Remittance transaction logging.
- **Branch Analytics:** Sales summaries, top-selling products, revenue trends, and performance dashboards.
- **AI Chatbot:** Role-specific conversational AI assistants powered by Google Gemini 3.5 Flash.
- **System Administration:** User management, system settings, notifications, and branch management.

The system does **not** cover:
- E-commerce marketplace integration with external platforms (e.g., Shopee, Lazada)
- Automated payment gateway integration (GCash/Maya are logged manually by the cashier)
- Payroll or Human Resource management
- Multi-store franchise management beyond the current branch configuration

## 1.5 Limitations

1. **Authentication Security:** User passwords are currently stored in plain text in the `users` table. This is a known security gap that must be addressed before production deployment.
2. **Payment Gateway:** GCash and Maya payments are accepted but not electronically verified. The cashier manually logs the payment type.
3. **GPS Tracking:** During an active delivery, the rider dashboard sends browser GPS fixes to the server, no more often than every five seconds. The customer's map refreshes from the saved coordinates. Rider location permission, a secure HTTPS origin, internet access, and an open rider dashboard are required; browser background tracking is not guaranteed.
4. **Offline Mode:** The system requires an active network connection to the local server. There is no offline-first capability.
5. **Single Branch (Current Data):** While the architecture supports multiple branches, only one branch (Silang Mini Mart Cainta Branch) is currently configured.
6. **AI Chatbot Dependency:** The AI assistant requires an active Google Gemini API key and internet access.

## 1.6 Intended Audience

| Audience | Purpose |
|---|---|
| Software Developers | Technical implementation reference |
| System Administrators | Installation, configuration, and maintenance |
| Store Manager / Admin | Business operations and system configuration |
| Cashiers | POS and VAS transaction processing |
| Delivery Riders | Delivery dashboard usage |
| Customers | Online portal and delivery tracking |
| Academic Reviewers | Thesis/Capstone evaluation |
| IT Support Staff | Troubleshooting and system upkeep |

## 1.7 Definitions of Terms

| Term | Definition |
|---|---|
| POS | Point-of-Sale — the system used to process customer transactions at the counter |
| VAS | Value-Added Services — additional services such as E-Load, Bills Payment, and Remittance |
| SKU | Stock Keeping Unit — a unique identifier for each product |
| Barcode | A machine-readable optical label used to identify products |
| JWT | JSON Web Token — a compact, URL-safe token format used for authentication |
| Tingi / Retail | Sale of goods by individual unit or kilogram |
| Balot / Pack | A packaged bundle (typically 6 units) sold at a slight discount |
| Karton / Box | A carton of goods (typically 24 units) sold at a wholesale discount |
| Pakyaw / Wholesale | Bulk purchase of 100 or more units at the largest discount |
| ETA | Estimated Time of Arrival for delivery |
| Leaflet | An open-source JavaScript library for interactive maps |
| MariaDB | An open-source relational database management system (RDBMS), a fork of MySQL |
| SPA | Single-Page Application — a web app that dynamically rewrites the current page |
| API | Application Programming Interface — a set of defined rules for software communication |
| Gemini | Google's family of large language models used for AI chatbot functionality |
| Brgy. | Barangay — the smallest administrative division in the Philippines |
| PWD | Person With Disability — entitled to a 20% government-mandated discount |
| Senior | Senior Citizen — entitled to a 20% government-mandated discount |
| XAMPP | A free, open-source cross-platform web server solution stack (Apache + MariaDB + PHP) |

---

# 2. System Overview

## 2.1 Business Problem

Silang Mini Mart, like many small neighborhood grocery stores in Metro Manila, has historically operated using manual business processes. These include handwritten stock logs that are prone to human error, manual calculations for transactions leading to slower customer service, no formal system for tracking customer deliveries, and no centralized view of business performance metrics. The lack of a digital system results in inventory discrepancies, revenue loss from untracked sales, and poor customer experience.

## 2.2 Proposed Solution

The Silang Mini Mart System is a comprehensive, full-stack web application designed to address all identified operational challenges. It provides a unified digital platform accessible on any modern web browser across multiple device types (desktops, tablets, smartphones). The system integrates all store operations—sales, inventory, delivery, and services—into a single cohesive application with role-based access control, ensuring that each stakeholder sees only the information and functions relevant to their role.

## 2.3 Key Features

1. **Multi-Role Authentication System** — Secure login for Admin, Cashier, Rider, and Customer with role-specific dashboards.
2. **Point-of-Sale (POS) Terminal** — Barcode-enabled product lookup, multi-variant pricing, discount computation (Senior/PWD/Percentage), and support for Cash, GCash, and Maya payments.
3. **Real-Time Inventory Management** — Product CRUD with multi-image support, multi-branch stock tracking, barcode management, and automatic low-stock notifications.
4. **Multi-Variant Product Pricing** — Support for Retail (Tingi), Pack (Balot), Box (Karton), and Wholesale (Pakyaw) pricing tiers per product.
5. **Customer Portal** — A full-featured online shopping experience with product browsing, cart management, delivery address management, and order placement.
6. **Real-Time Delivery Tracking** — Interactive Leaflet map showing driver location, delivery status updates, and ETA for customers and administrators.
7. **Rider Dashboard** — Mobile-friendly dashboard for delivery riders to view assigned deliveries, update statuses, and access route assistance.
8. **Value-Added Services (VAS)** — Logging and tracking of E-Load, Bills Payment, and Remittance transactions.
9. **Branch Analytics** — Dashboard with sales charts, top product rankings, revenue summaries, and trend analysis.
10. **Supplier Delivery Management** — Record and track incoming stock deliveries from suppliers.
11. **AI Chatbot Assistant** — Google Gemini-powered conversational AI with four unique personas for Admin, Customer, Cashier, and Rider roles.
12. **System Notifications** — In-app notification system for low-stock alerts and important system events.
13. **QR Code Generation** — QR code generation for products and transactions.
14. **Multi-Branch Support** — Architecture designed to support multiple store branches.

## 2.4 Expected Benefits

| Benefit | Description |
|---|---|
| Operational Efficiency | Automated transaction processing reduces checkout time by up to 60% |
| Inventory Accuracy | Real-time stock tracking eliminates manual counting errors |
| Customer Satisfaction | Online ordering and real-time delivery tracking improves customer experience |
| Revenue Visibility | Analytics dashboard provides instant visibility into sales performance |
| Reduced Losses | Low-stock alerts prevent stockouts and lost sales |
| Scalability | Multi-branch architecture supports future store expansion |
| AI-Assisted Operations | Role-based AI chatbot reduces time spent on routine queries |

## 2.5 Overall Workflow

The system operates on a multi-role, request-response model. A user selects their role at the login screen and authenticates. Upon successful authentication, the system issues a JWT token that governs all subsequent API requests. The frontend React SPA renders a role-specific dashboard. All data is persisted in a MariaDB relational database via a Node.js/Express.js REST API backend. AI features are processed in real-time by the Google Gemini API. Delivery tracking utilizes Leaflet.js with OpenStreetMap tiles for interactive, browser-based map rendering.

---

# 3. Software Architecture

## 3.1 Architecture Overview

The Silang Mini Mart System is built using a **Monolithic Full-Stack Architecture** with a clear separation between the frontend client and backend server layers, both residing in the same Node.js process during development. In production, the frontend is compiled into a static build and served directly by the Express.js server.

## 3.2 Architectural Pattern

The system employs the **MVC (Model-View-Controller)** architectural pattern adapted for a REST API + SPA context:

- **Model:** MariaDB database tables represent the data model, accessed via the `mysql2` connection pool.
- **View:** React.js components (`.tsx` files) in the `src/components/` directory form the presentation layer.
- **Controller:** Express.js route handlers in `src/routes/` process business logic and database interactions.

Additionally, the backend follows a **Layered Architecture** pattern:
- **Presentation Layer:** React.js SPA (TypeScript, TSX)
- **API Layer:** Express.js REST API routes
- **Business Logic Layer:** Route handlers with utility functions (`src/utils/`)
- **Data Access Layer:** MySQL2 connection pool (`src/db/mysql.ts`)
- **Database Layer:** MariaDB / MySQL

## 3.3 Layer Descriptions

### 3.3.1 Frontend (Presentation Layer)
The frontend is a React.js 19 Single-Page Application written in TypeScript. The main entry point is `src/main.tsx`, which renders the root `App.tsx` component. The `App.tsx` manages global application state (current user, active view, cart, etc.) and conditionally renders the appropriate view component based on the authenticated user's role and selected navigation item. Styling is handled via Tailwind CSS v4 with motion animations via the `motion` library.

### 3.3.2 Backend API Layer
The backend is an Express.js v4 server defined in `server.ts`. It initializes the Vite development server middleware (in development mode), connects to the MariaDB database via the `mysql2` pool, and mounts all API route modules under the `/api` prefix. It also serves uploaded files from the `uploads/` directory.

### 3.3.3 API Route Modules
Each business domain has a dedicated route module in `src/routes/`:

| Route File | Prefix | Description |
|---|---|---|
| `auth.ts` | `/api/auth` | Authentication (login for all roles) |
| `products.ts` | `/api/products` | Product CRUD and variant image upload |
| `customers.ts` | `/api/customers` | Customer profile and delivery address management |
| `deliveries.ts` | `/api/deliveries` | Delivery order CRUD and status updates |
| `pos.ts` | `/api/pos` | POS transaction processing |
| `services.ts` | `/api/services` | VAS transaction logging |
| `branches.ts` | `/api/branches` | Branch management |
| `inventory.ts` | `/api/inventory` | Stock adjustment and inventory operations |
| `notifications.ts` | `/api/notifications` | System notification read/management |
| `settings.ts` | `/api/settings` | System configuration (categories, etc.) |
| `supplierDeliveries.ts` | `/api/supplier-deliveries` | Supplier delivery management |

### 3.3.4 Database Layer
The data layer uses MariaDB 10.4.32 accessed via the `mysql2` Node.js driver with connection pooling. Database migrations are run automatically at server startup via the `runMigrations()` function in `src/db/mysql.ts`.

## 3.4 Component Interaction

```
[Customer / Browser]
        |
        v
[React SPA (Vite Dev Server / Static Build)]
        |  HTTP/AJAX (fetch API)
        v
[Express.js REST API Server — server.ts]
        |
        |-- [/api/auth]         → auth.ts
        |-- [/api/products]     → products.ts
        |-- [/api/pos]          → pos.ts
        |-- [/api/deliveries]   → deliveries.ts
        |-- [/api/customers]    → customers.ts
        |-- [/api/services]     → services.ts
        |-- [/api/branches]     → branches.ts
        |-- [/api/chatbot]      → Google Gemini API (external)
        |
        v
[MySQL2 Connection Pool]
        |
        v
[MariaDB Database — silang_mini_mart]
```

## 3.5 Architecture Diagram Description

The architecture can be visualized as a three-tier web application:

- **Tier 1 (Client):** The user's browser loads the React SPA. All UI rendering is done client-side. The browser communicates with the server exclusively through fetch/AJAX HTTP requests to the REST API.
- **Tier 2 (Application Server):** The Node.js + Express.js server acts as the application logic layer. It handles authentication via JWT middleware, routes API requests to appropriate handlers, processes business logic, and communicates with both the database and external APIs (Google Gemini).
- **Tier 3 (Data):** MariaDB stores all persistent data. The `mysql2` library manages a connection pool for efficient database access.

An additional external component is the **Google Gemini API**, a cloud-based LLM service called from the Node.js backend for the AI chatbot feature. **Leaflet.js** with **OpenStreetMap** tiles provides map rendering in the browser for delivery tracking.

---

# 4. Technology Stack

## 4.1 Technology Stack Table

| Technology | Purpose | Version | Reason for Selection |
|---|---|---|---|
| **React.js** | Frontend UI Framework (SPA) | v19.0.1 | Industry-standard component-based UI library; excellent ecosystem and developer tooling |
| **TypeScript** | Programming Language | ~5.8.2 | Adds static typing to JavaScript, reducing runtime errors and improving code maintainability |
| **Vite** | Frontend Build Tool & Dev Server | v6.2.3 | Extremely fast Hot Module Replacement (HMR) during development; optimized production builds |
| **Tailwind CSS** | Utility-First CSS Framework | v4.1.14 | Rapid UI development with consistent design tokens; eliminates need for custom CSS files |
| **Express.js** | Backend REST API Framework | v4.21.2 | Minimal, flexible Node.js web framework; ideal for building RESTful APIs |
| **Node.js** | Backend Runtime Environment | [Information Required] | Enables server-side JavaScript execution; non-blocking I/O for handling concurrent requests |
| **TypeScript (tsx)** | Backend TypeScript Execution | v4.21.0 | Allows TypeScript to run directly in Node.js during development without compilation |
| **MariaDB** | Relational Database Management System | 10.4.32 | Open-source, production-grade RDBMS; fully compatible with MySQL; bundled with XAMPP |
| **mysql2** | Node.js MySQL/MariaDB Driver | v3.22.5 | Fast, promise-based MySQL client for Node.js with connection pooling support |
| **Google Gemini API (@google/genai)** | AI Large Language Model | v2.4.0 | Provides the AI chatbot functionality; state-of-the-art LLM by Google DeepMind |
| **Leaflet.js** | Interactive Map Library | v1.9.4 | Lightweight, mobile-friendly open-source JavaScript library for interactive maps using OpenStreetMap |
| **Multer** | File Upload Middleware | v2.2.0 | Handles `multipart/form-data` for product image uploads in Node.js |
| **jsPDF** | Client-Side PDF Generation | v4.2.1 | Enables receipt and report generation directly in the browser without server involvement |
| **QRCode** | QR Code Generator | v1.5.4 | Generates QR codes for products and transactions for quick barcode scanning support |
| **Lucide React** | Icon Library | v0.546.0 | Consistent, clean icon set designed for React; provides all UI icons |
| **Motion** | Animation Library | v12.23.24 | Provides smooth, performant animations and micro-interactions for enhanced UX |
| **dotenv** | Environment Variable Management | v17.2.3 | Loads environment variables from `.env` files for configuration management |
| **esbuild** | Production Build Bundler | v0.25.0 | Extremely fast JavaScript/TypeScript bundler used for production server build |
| **XAMPP** | Local Development Environment | [Information Required] | Provides a local Apache + MariaDB + PHP stack; used as the local hosting environment |

---

# 5. Functional Requirements

## 5.1 Functional Requirements Table

| Req. ID | Feature | Description | Priority | User Role |
|---|---|---|---|---|
| FR-001 | Multi-Role Login | Users authenticate with their name, role, and password/PIN | High | All |
| FR-002 | JWT Session Management | System issues JWT tokens upon successful login; tokens authorize all subsequent API calls | High | All |
| FR-003 | Role-Based Dashboard Routing | System renders the appropriate dashboard view based on authenticated user role | High | All |
| FR-004 | POS Transaction Processing | Cashier can search products by name/barcode, add to cart, apply discounts (Senior/PWD/Percentage), select payment method, and complete sale | High | Cashier, Admin |
| FR-005 | Multiple Payment Methods | System accepts Cash, GCash, and Maya as payment methods; computes change for cash payments | High | Cashier |
| FR-006 | Discount Application | System applies 20% Senior Citizen or PWD discount, or a custom percentage discount | High | Cashier |
| FR-007 | Receipt Generation | System generates a printable PDF receipt for completed transactions | Medium | Cashier, Admin |
| FR-008 | Product Catalog Management | Admin can create, read, update, and delete products with full details | High | Admin |
| FR-009 | Product Variant Pricing | Each product supports Retail, Pack, Box, and Wholesale pricing tiers with independent prices | High | Admin, Cashier, Customer |
| FR-010 | Barcode Management | Products have barcodes; cashier can scan/enter barcode to quickly find products | High | Cashier |
| FR-011 | Multi-Image Product Gallery | Products support multiple images (photos, emojis) displayed in a gallery | Medium | Admin |
| FR-012 | Stock Tracking per Branch | System tracks inventory stock levels for each product per registered branch | High | Admin |
| FR-013 | Low-Stock Notifications | System automatically generates a warning notification when product stock falls below the configured threshold | High | Admin |
| FR-014 | Stock Adjustment | Admin can manually adjust stock levels for any product at any branch | High | Admin |
| FR-015 | Product Category Management | Admin can define and manage product categories via system settings | Medium | Admin |
| FR-016 | Customer Self-Registration | Customers can register through the customer portal using their name and phone number | High | Customer |
| FR-017 | Customer Login via PIN | Registered customers log in using their name and a 4-digit PIN | High | Customer |
| FR-018 | Product Browsing & Search | Customers can browse all products by category, search by name, and view pricing variants | High | Customer |
| FR-019 | Shopping Cart Management | Customers can add products to a cart, select packaging variants, adjust quantities, and remove items | High | Customer |
| FR-020 | Delivery Address Management | Customers can save, edit, and set a default delivery address with map pin selection | High | Customer |
| FR-021 | Order Placement | Customer can submit a delivery order from their cart, selecting a delivery address | High | Customer |
| FR-022 | Delivery Fee Calculation | System calculates delivery fee (free for orders ≥ ₱1,000; ₱50 otherwise) | Medium | Customer |
| FR-023 | Real-Time Delivery Tracking | Customer can view the delivery status and driver location on an interactive Leaflet map | High | Customer |
| FR-024 | Delivery Order Management | Admin can create, view, update status, assign drivers, and cancel delivery orders | High | Admin |
| FR-025 | Rider Dashboard | Riders see their assigned deliveries with order details, customer location, and status controls | High | Rider |
| FR-026 | Rider Status Update | Rider can update delivery status (Preparing → Out for Delivery → Delivered/Cancelled) | High | Rider |
| FR-027 | Rider GPS Location Update | System records and broadcasts the rider's current GPS coordinates | Medium | Rider |
| FR-028 | E-Load Transaction Logging | Cashier can log an E-Load transaction with provider, recipient phone, amount, and service fee | High | Cashier, Admin |
| FR-029 | Bills Payment Logging | Cashier can log a Bills Payment transaction (Meralco, etc.) with account details and amounts | High | Cashier, Admin |
| FR-030 | Remittance Logging | Cashier can log a Remittance transaction (Cebuana, Palawan Express) with sender/recipient and amounts | High | Cashier, Admin |
| FR-031 | Branch Analytics Dashboard | Admin views key metrics: total sales, top products, transaction count, and revenue trends in charts | High | Admin |
| FR-032 | Supplier Delivery Management | Admin can record incoming stock deliveries from suppliers, linked to products and branches | Medium | Admin |
| FR-033 | System Notifications | System displays in-app notifications; admin can mark notifications as read | Medium | Admin |
| FR-034 | Branch Management | Admin can add and manage store branches with name, address, and GPS coordinates | Medium | Admin |
| FR-035 | User Account Management | Admin can manage user accounts (cashiers, riders) including creating and deactivating accounts | High | Admin |
| FR-036 | AI Chatbot — Admin Mode | Gemini-powered AI assistant in admin persona answers business and inventory questions | Medium | Admin |
| FR-037 | AI Chatbot — Customer Mode | Gemini-powered "Ate Digy" AI helps customers find products, understand pricing, and place orders | Medium | Customer |
| FR-038 | AI Chatbot — Rider Mode | Gemini-powered dispatch AI assists riders with routes and delivery guidance | Low | Rider |
| FR-039 | AI Chatbot — Cashier Mode | Gemini-powered AI assists cashiers with POS procedures and VAS transactions | Medium | Cashier |
| FR-040 | System Settings Management | Admin can update global settings such as product categories | Medium | Admin |
| FR-041 | QR Code Generation | System generates QR codes for products and transactions | Low | Admin, Cashier |
| FR-042 | Product Image Upload | Admin can upload photos for product variants via the inventory management interface | Medium | Admin |
| FR-043 | Customer Profile with Store Photo | Customer can upload a store/profile photo during registration | Low | Customer |
| FR-044 | Transaction History | Admin can view a complete history of all POS, delivery, and VAS transactions | High | Admin |

---

# 6. Non-Functional Requirements

## 6.1 Non-Functional Requirements Table

| Category | Requirement ID | Requirement | Target Metric |
|---|---|---|---|
| **Performance** | NFR-001 | API response time for standard queries (product list, transaction submission) | < 500ms under normal load |
| **Performance** | NFR-002 | Frontend initial page load time | < 3 seconds on a standard broadband connection |
| **Performance** | NFR-003 | Database query execution for indexed searches | < 100ms |
| **Security** | NFR-004 | All protected API endpoints must require a valid JWT Bearer token | 100% coverage of non-public endpoints |
| **Security** | NFR-005 | Passwords and PINs must be stored using a secure hashing algorithm (bcrypt recommended) | [To be implemented — currently plain text] |
| **Security** | NFR-006 | All user inputs must be sanitized and validated to prevent SQL injection | Parameterized queries used throughout |
| **Security** | NFR-007 | Rate limiting must be applied to the AI chatbot endpoint | 10 requests per IP per minute |
| **Security** | NFR-008 | File upload validation must restrict uploads to image MIME types only | Maximum 5MB per file |
| **Reliability** | NFR-009 | The system must handle database connection failures gracefully with appropriate error messages | Zero unhandled exceptions in production |
| **Reliability** | NFR-010 | Database transactions must use ACID-compliant operations for financial records | All financial writes use transactions |
| **Scalability** | NFR-011 | The database connection pool must support concurrent connections | Minimum 10 concurrent connections |
| **Scalability** | NFR-012 | The architecture must support the addition of new branches without major code changes | Branch name is a configuration parameter |
| **Availability** | NFR-013 | The system must be available during store operating hours (typically 7 AM – 9 PM) | 99% uptime during operating hours |
| **Availability** | NFR-014 | The system must run reliably on a local XAMPP environment without internet for core POS features | Core POS must work without Gemini API |
| **Maintainability** | NFR-015 | All code must be written in TypeScript with proper type definitions | No implicit `any` types in core logic |
| **Maintainability** | NFR-016 | Database schema changes must be applied via the migration system | All schema changes through `runMigrations()` |
| **Portability** | NFR-017 | The frontend must be responsive and functional on screen widths from 360px (mobile) to 1920px (desktop) | Tested at 360px, 768px, 1024px, 1920px |
| **Compatibility** | NFR-018 | The system must function correctly on Chrome, Firefox, Edge, and Safari browsers | Latest 2 versions of each browser |
| **Accessibility** | NFR-019 | All interactive elements must have descriptive labels and sufficient color contrast | WCAG 2.1 Level AA compliance as target |
| **Backup & Recovery** | NFR-020 | Daily database backups must be scheduled with a minimum 7-day retention | Automated via XAMPP scheduler or cron |

---

# 7. User Roles and Permissions

## 7.1 Admin / Manager Role

**Description:** The Administrator is the store owner or manager who has full access to all system modules.

**Responsibilities:**
- Manage the product catalog and pricing
- Monitor and adjust inventory stock levels
- Review and manage all delivery orders
- View branch analytics and sales reports
- Manage user accounts (cashiers, riders, customers)
- Configure system settings (categories, branches)
- Review all transaction histories (POS, VAS, Supplier Deliveries)
- Access the AI Business Advisor chatbot

**Accessible Modules:** Inventory Management, POS (view), Delivery Management, Branch Analytics, Value-Added Services, Supplier Deliveries, System Notifications, System Settings, Branch Manager Panel, AI Assistant

**Permissions:**
- Full CRUD on all product records
- Full CRUD on delivery orders
- Full CRUD on branches and users
- Read access to all transaction records
- System settings write access
- Stock adjustment authority

**Restrictions:**
- Cannot delete completed financial transactions (audit integrity)
- Cannot access other users' login credentials directly

---

## 7.2 Cashier Role

**Description:** A store staff member responsible for processing sales transactions and value-added services at the counter.

**Responsibilities:**
- Process customer purchases via the POS terminal
- Handle Cash, GCash, and Maya payments
- Apply Senior Citizen and PWD discounts
- Log E-Load, Bills Payment, and Remittance service transactions
- Print and issue receipts
- Access the AI Cashier Assistant chatbot

**Accessible Modules:** POS Terminal, Value-Added Services, AI Assistant (Cashier persona)

**Permissions:**
- Create POS transactions
- Create VAS transactions
- View product catalog and stock levels
- Generate receipts

**Restrictions:**
- Cannot access Inventory Management (edit products/stock)
- Cannot access Delivery Management admin panel
- Cannot access Branch Analytics
- Cannot manage user accounts

---

## 7.3 Delivery Rider Role

**Description:** A store employee responsible for physically delivering orders to customers.

**Responsibilities:**
- View assigned delivery orders
- Update delivery status at each stage (Preparing, Out for Delivery, Delivered, Cancelled)
- Update current GPS location for customer tracking
- Access the AI Rider Dispatch Co-pilot chatbot

**Accessible Modules:** Rider Dashboard, Delivery Map, AI Assistant (Rider persona)

**Permissions:**
- View own assigned deliveries
- Update delivery status for assigned orders
- Update driver GPS coordinates

**Restrictions:**
- Cannot access POS, Inventory, Analytics, or any Admin functions
- Cannot view other riders' assigned deliveries
- Cannot modify product or customer data

---

## 7.4 Customer Role

**Description:** A registered customer who shops online through the Silang Mini Mart Customer Portal.

**Responsibilities:**
- Browse the product catalog and search for items
- Manage their delivery addresses
- Add items to cart and place delivery orders
- Track their deliveries in real-time
- Interact with the "Ate Digy" AI shopping assistant

**Accessible Modules:** Customer Portal (Product Browsing, Cart, Order Placement, Delivery Tracking, Profile Management), AI Assistant (Customer persona)

**Permissions:**
- View all products and pricing
- Manage own delivery addresses
- Place new delivery orders
- View status of own deliveries
- Update own profile (phone number, store photo)

**Restrictions:**
- Cannot access POS, Inventory, Analytics, or Rider Dashboard
- Cannot view other customers' orders or personal data
- Cannot modify product catalog or pricing

---

# 8. System Modules

## 8.1 Authentication Module

**Purpose:** To verify the identity of users and issue session tokens that authorize access to protected API resources.

**Inputs:** User role (admin/customer/rider), name/username, password/PIN

**Outputs:** JWT Bearer Token, user profile object (username, role, name); error messages on failure

**Process Flow:**
1. User submits role, name, and password/PIN via the login form.
2. Backend validates that required fields are present.
3. For **Admin/Cashier**: Query `users` table by name and role; compare password against stored value.
4. For **Customer**: Query `customers` table by name; validate against plain PIN or SHA-256 hashed password.
5. For **Rider**: Query `users` table by name and role `rider`; compare password.
6. On success, `generateToken()` creates and signs a JWT token.
7. Token is returned to the client and stored in the browser for subsequent requests.

**Validation Rules:**
- Role must be one of: `admin`, `customer`, `rider`
- Name and password/PIN are required fields
- Password comparison for admin/rider is plain-text (⚠️ security gap)
- Customer may authenticate via plain PIN or SHA-256 hashed password

**Error Handling:**
- Missing credentials → HTTP 400
- User not found → HTTP 401 with descriptive message
- Wrong password/PIN → HTTP 401 with descriptive message
- Server error → HTTP 500

**Dependencies:** `users` table, `customers` table, `generateToken()` utility, `getPool()` from `src/db/mysql`

---

## 8.2 Point-of-Sale (POS) Module

**Purpose:** To process customer purchase transactions at the physical store counter, supporting multiple payment methods and automatic discount computation.

**Inputs:** Product selections (with variant and quantity), discount type and amount, payment method, amount paid, cashier identifier, branch

**Outputs:** Transaction record in `orders_transactions` and `orders_transaction_items` tables; receipt (PDF via jsPDF); change amount calculation

**Process Flow:**
1. Cashier opens the POS view and searches for products by name or barcode.
2. Cashier selects a product and its packaging variant (Retail/Pack/Box/Wholesale).
3. Product is added to the cart with quantity adjustable by the cashier.
4. Cashier selects discount type (none, senior, pwd, percentage) if applicable.
5. System computes subtotal, applies discount, and calculates the total.
6. Cashier selects payment method (Cash/GCash/Maya) and enters amount paid.
7. System computes change (for cash payments).
8. On confirm, the transaction is posted to the API: `POST /api/pos/transaction`.
9. Transaction header is saved to `orders_transactions`; line items to `orders_transaction_items`.
10. Stock is decremented for each sold item at the current branch.
11. A receipt is generated and can be printed.

**Validation Rules:**
- Cart must have at least one item
- Amount paid must be ≥ total for cash payments
- Discount amount must be within valid range (0–100% for percentage)
- Branch must be a valid registered branch

**Error Handling:**
- Empty cart → validation error before submission
- Insufficient payment → user prompt
- Database error → HTTP 500 with rollback

**Dependencies:** `products`, `product_variants`, `orders_transactions`, `orders_transaction_items`, `product_stock` tables; `jsPDF` library

---

## 8.3 Inventory Management Module

**Purpose:** To manage the complete product catalog, including product details, pricing variants, multi-branch stock tracking, image galleries, barcode management, and supplier deliveries.

**Inputs:** Product details (name, category, price, cost, barcode, unit, shelf location, low-stock threshold, images, variants, stock per branch)

**Outputs:** Updated `products`, `product_variants`, `product_stock` tables; low-stock notifications in `system_notifications`

**Process Flow:**
1. Admin navigates to the Inventory module.
2. Admin can view all products organized by category with stock levels per branch.
3. To add a product: Admin fills the product form, configures variants, sets stock levels, uploads images.
4. `POST /api/products` creates the product, stock records, and variant records.
5. To update: Admin edits the product form. `PUT /api/products/:id` updates the relevant records.
6. To delete: `DELETE /api/products/:id` cascades to remove stock and variant records.
7. System checks stock levels after each POS transaction and generates a low-stock notification if stock < `lowStockThreshold`.

**Validation Rules:**
- Product name, category, barcode, and price are required
- Barcode must be unique across all products
- Price and cost must be positive numbers
- Variant type must be one of: retail, package, box, wholesale
- Image uploads limited to image MIME types, maximum 5MB

**Error Handling:**
- Duplicate barcode → HTTP 400 with "Duplicate entry" error
- Invalid file type for image upload → Multer filter rejection
- Missing required fields → HTTP 400 with field-specific error message

**Dependencies:** `products`, `product_variants`, `product_stock`, `system_notifications` tables; Multer for file uploads

---

## 8.4 Customer Portal Module

**Purpose:** To provide registered customers with a full online shopping experience, including product browsing, cart management, address management, order placement, and delivery tracking.

**Inputs:** Customer name, phone, PIN; product selection and quantity; delivery address (with GPS coordinates via Leaflet map); order notes

**Outputs:** Customer record in `customers`; delivery order in `deliveries` and `delivery_items`; real-time delivery status and driver location

**Process Flow:**
1. Customer registers or logs in via the Customer Portal login screen.
2. Customer browses products by category or searches by name, viewing variant pricing.
3. Customer adds products to the cart, selecting packaging variants.
4. Customer navigates to checkout, selects/creates a delivery address on the map.
5. Order is submitted via `POST /api/deliveries`.
6. System creates a delivery record with status `Pending` and links order items.
7. Customer can view delivery status on the tracking page, which shows an interactive Leaflet map with driver location updating in near-real-time.

**Validation Rules:**
- Phone number must be provided for customer registration
- At least one item must be in cart before checkout
- A delivery address with valid GPS coordinates must be selected

**Dependencies:** `customers`, `customer_delivery_addresses`, `deliveries`, `delivery_items`, `products`, `product_variants` tables; Leaflet.js for map display

---

## 8.5 Delivery Management Module

**Purpose:** To manage the end-to-end lifecycle of customer delivery orders, from creation through assignment, out-for-delivery status, and completion.

**Inputs:** Delivery order details (customer, items, address, notes); status updates from admin/rider; driver GPS coordinates; ETA updates

**Outputs:** Delivery records in `deliveries` and `delivery_items`; real-time status and location updates for customer tracking map

**Delivery Status Lifecycle:**
`Pending` → `Preparing` → `Out for Delivery` → `Delivered` or `Cancelled`

**Process Flow:**
1. Admin views the Delivery Management panel showing all current deliveries.
2. Admin can create a new delivery order manually (walk-in delivery request).
3. Admin assigns a driver and sets the initial status to `Preparing`.
4. Rider receives the order on their Rider Dashboard.
5. Rider updates status to `Out for Delivery` and begins navigating to the customer.
6. With location permission, the rider dashboard watches high-accuracy device GPS and posts fixes (with reported accuracy) to `POST /api/deliveries/:id/location`. Only the assigned rider can update an active delivery.
7. Customer/admin maps place the rider marker at the latest saved GPS fix and request the actual road route from that position to the customer's saved order coordinates. Route refresh is throttled to every 15 seconds; the rider marker and route start follow new GPS fixes as the five-second data refresh receives them. A reported GPS-accuracy circle is drawn around the rider position.
7. Upon arrival, rider marks the delivery as `Delivered`.
8. Admin or rider can mark as `Cancelled` if delivery cannot be completed.

**Error Handling:**
- Invalid status transition → validation error
- Driver not assigned → cannot move to `Out for Delivery`
- Network loss during location update → retry mechanism on client

**Dependencies:** `deliveries`, `delivery_items`, `customers`, `users` tables; Leaflet.js

---

## 8.6 Value-Added Services (VAS) Module

**Purpose:** To log and track financial service transactions processed at the store counter: E-Load, Bills Payment, and Remittance.

**Inputs:** Service type, provider name, recipient (phone/account number), sender/account name, amount, service fee

**Outputs:** Service transaction record in `service_transactions` table; service fee revenue tracking

**Process Flow:**
1. Cashier navigates to the Value-Added Services module.
2. Cashier selects service type: E-Load, Bills Payment, or Remittance.
3. Cashier fills in provider-specific details and amounts.
4. System computes total amount (amount + service fee).
5. Transaction is submitted via `POST /api/services`.
6. Transaction is logged with a status of `Completed`, `Pending`, or `Failed`.

**Dependencies:** `service_transactions` table

---

## 8.7 Branch Analytics Module

**Purpose:** To provide the store manager with a visual business intelligence dashboard showing key performance indicators, sales trends, and product performance metrics.

**Inputs:** Date range filter; branch selection

**Outputs:** Aggregated sales data, charts (revenue trends, category breakdown), top-selling products list, transaction count, total revenue

**Process Flow:**
1. Admin navigates to the Branch Analytics module.
2. System queries `orders_transactions`, `orders_transaction_items`, `deliveries`, `delivery_items`, and `service_transactions` tables.
3. Data is aggregated and returned to the frontend.
4. Charts and tables are rendered using React state-managed visual components.

**Dependencies:** `orders_transactions`, `orders_transaction_items`, `deliveries`, `service_transactions` tables

---

## 8.8 AI Assistant Module

**Purpose:** To provide role-specific conversational AI assistance powered by Google Gemini 3.5 Flash, helping each user type with their specific tasks.

**Inputs:** User role, user name, conversation history (last 10 messages), current user message (max 500 characters)

**Outputs:** Plain-text AI response (markdown stripped for natural conversation style)

**Roles and Personas:**

| Role | Persona | Focus |
|---|---|---|
| Admin | Silang Mini Mart AI Business Advisor | Inventory, analytics, security, business growth |
| Customer | "Ate Digy" — AI Shopping Assistant | Product recommendations, pricing, delivery info |
| Rider | Rider Dispatch Co-pilot | Route guidance, safety tips, delivery support |
| Cashier | Store Operations Assistant | POS procedures, GCash/Maya, discounts, VAS |

**Dependencies:** `@google/genai` SDK; `GEMINI_API_KEY` environment variable; rate limiter middleware

---

# 9. Database Documentation

## 9.1 Database Overview

**Database Name:** `silang_mini_mart`  
**DBMS:** MariaDB 10.4.32  
**Character Set:** `utf8mb4` (supports full Unicode including Filipino characters and emojis)  
**Collation:** `utf8mb4_general_ci`  
**Storage Engine:** InnoDB (for foreign key and transaction support)

The database consists of **14 tables** organized around the following business entities: Users, Products, Customers, Deliveries, Orders (POS), Services, Supplier Deliveries, Branches, and System configuration.

## 9.2 Entity Descriptions

| Entity | Table | Description |
|---|---|---|
| Branch | `branches` | Physical store branch locations |
| User | `users` | Staff accounts (admin, cashier, rider) |
| Customer | `customers` | Registered customer profiles |
| Customer Address | `customer_delivery_addresses` | Saved delivery addresses for customers |
| Product | `products` | Core product catalog |
| Product Stock | `product_stock` | Per-branch inventory stock levels |
| Product Variant | `product_variants` | Pricing variants (retail/pack/box/wholesale) per product |
| Delivery | `deliveries` | Customer delivery orders |
| Delivery Item | `delivery_items` | Line items for each delivery order |
| POS Transaction | `orders_transactions` | POS transaction headers |
| POS Transaction Item | `orders_transaction_items` | Line items for each POS transaction |
| Service Transaction | `service_transactions` | VAS transaction records (E-Load, Bills, Remittance) |
| Supplier Delivery | `supplier_deliveries` | Incoming stock deliveries from suppliers |
| Supplier Delivery Item | `supplier_delivery_items` | Line items for each supplier delivery |
| System Notification | `system_notifications` | In-app system notifications |
| System Settings | `system_settings` | Key-value configuration store |

## 9.3 Table Descriptions and Data Dictionary

### Table: `branches`
Stores information about each physical store branch.

| Column | Data Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | AUTO_INCREMENT | Unique branch identifier |
| `name` | VARCHAR(120) | NO | UNIQUE | — | Branch name (used as FK in other tables) |
| `address` | TEXT | NO | — | `''` | Full physical address |
| `lat` | DOUBLE | NO | — | 0 | GPS latitude coordinate |
| `lng` | DOUBLE | NO | — | 0 | GPS longitude coordinate |
| `is_active` | TINYINT(1) | NO | — | 1 | 1 = Active, 0 = Inactive |
| `created_at` | TIMESTAMP | NO | — | CURRENT_TIMESTAMP | Record creation timestamp |

---

### Table: `users`
Stores staff account credentials and roles.

| Column | Data Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | AUTO_INCREMENT | Unique user identifier |
| `name` | VARCHAR(120) | NO | — | — | Full display name |
| `username` | VARCHAR(120) | NO | UNIQUE | — | Login username |
| `password` | VARCHAR(255) | NO | — | — | Password (⚠️ plain text; should be hashed) |
| `role` | ENUM | NO | — | — | `admin`, `cashier`, or `rider` |
| `status` | ENUM | NO | — | `'active'` | `active` or `inactive` |
| `created_at` | TIMESTAMP | NO | — | CURRENT_TIMESTAMP | Record creation timestamp |

---

### Table: `customers`
Stores registered customer profiles for the online portal.

| Column | Data Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | AUTO_INCREMENT | Unique customer identifier |
| `name` | VARCHAR(120) | NO | UNIQUE | — | Customer full name (used as natural key) |
| `phone` | VARCHAR(30) | NO | — | — | Mobile phone number |
| `pin` | VARCHAR(255) | NO | — | `'1234'` | 4-digit login PIN |
| `store_image` | VARCHAR(255) | YES | — | NULL | URL to store/business photo |
| `barangay` | VARCHAR(100) | NO | — | — | Barangay address |
| `address` | TEXT | NO | — | — | Full delivery address |
| `profile_picture_url` | TEXT | YES | — | NULL | Customer profile picture URL |
| `store_photo_url` | TEXT | YES | — | NULL | Customer's store photo URL |
| `lat` | DOUBLE | NO | — | — | Customer home GPS latitude |
| `lng` | DOUBLE | NO | — | — | Customer home GPS longitude |
| `store_lat` | DOUBLE | YES | — | NULL | Customer store GPS latitude |
| `store_lng` | DOUBLE | YES | — | NULL | Customer store GPS longitude |
| `password_hash` | VARCHAR(255) | YES | — | NULL | SHA-256 hashed password (alternative to PIN) |
| `created_at` | TIMESTAMP | NO | — | CURRENT_TIMESTAMP | Record creation timestamp |

---

### Table: `customer_delivery_addresses`
Stores multiple saved delivery addresses per customer.

| Column | Data Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | AUTO_INCREMENT | Unique address identifier |
| `customer_name` | VARCHAR(120) | NO | INDEX | — | References `customers.name` |
| `label` | VARCHAR(120) | YES | — | NULL | Address label (e.g., "Home", "Default") |
| `address_text` | TEXT | NO | — | — | Full address description |
| `lat` | DOUBLE | NO | — | — | GPS latitude of address |
| `lng` | DOUBLE | NO | — | — | GPS longitude of address |
| `is_default` | TINYINT(1) | NO | — | 0 | 1 = Default address for this customer |
| `created_at` | TIMESTAMP | NO | — | CURRENT_TIMESTAMP | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | — | CURRENT_TIMESTAMP | Last update timestamp |

---

### Table: `products`
Core product catalog with pricing and metadata.

| Column | Data Type | Nullable | Key | Default | Description |
|---|---|---|---|---|---|
| `id` | VARCHAR(64) | NO | PK | — | Product ID (e.g., `prod-8396`) |
| `name` | VARCHAR(160) | NO | — | — | Product name in English |
| `tagalogName` | VARCHAR(160) | YES | — | NULL | Product name in Filipino/Tagalog |
| `category` | VARCHAR(120) | NO | — | — | Product category |
| `price` | DECIMAL(10,2) | NO | — | — | Base retail selling price (PHP) |
| `cost` | DECIMAL(10,2) | NO | — | — | Supplier cost price (PHP) |
| `shelfLocation` | VARCHAR(200) | NO | — | — | Physical shelf assignment (e.g., "Shelf A") |
| `barcode` | VARCHAR(64) | NO | UNIQUE | — | Product barcode number |
| `unit` | ENUM | NO | — | — | Base unit: `kg`, `can`, `pack`, `bottle`, `pc`, `bag` |
| `lowStockThreshold` | INT(11) | NO | — | — | Alert threshold for low stock notification |
| `imagePlaceholderColor` | VARCHAR(20) | YES | — | NULL | Hex color code for UI placeholder |
| `images_json` | LONGTEXT (JSON) | YES | — | NULL | JSON array of product images (URLs or emojis) |
| `created_at` | TIMESTAMP | NO | — | CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | NO | — | CURRENT_TIMESTAMP ON UPDATE | Last modification timestamp |

---

### Table: `product_stock`
Tracks stock levels per product per branch.

| Column | Data Type | Nullable | Key | Description |
|---|---|---|---|---|
| `product_id` | VARCHAR(64) | NO | PK, FK → `products.id` | References product |
| `branch` | VARCHAR(120) | NO | PK | Branch name (composite primary key) |
| `stock` | INT(11) | NO | — | Current stock quantity |

---

### Table: `product_variants`
Defines pricing variants (Retail, Pack, Box, Wholesale) for each product.

| Column | Data Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Auto-increment identifier |
| `product_id` | VARCHAR(64) | NO | FK → `products.id` | References parent product |
| `type` | ENUM | NO | UNIQUE(product_id, type) | `retail`, `package`, `box`, `wholesale` |
| `label` | VARCHAR(200) | NO | — | Display label (e.g., "Daily Retail (1 kg)") |
| `qtyPerUnit` | INT(11) | NO | — | Number of base units per variant unit |
| `price` | DECIMAL(10,2) | NO | — | Selling price for this variant (PHP) |
| `cost` | DECIMAL(10,2) | NO | — | Cost price for this variant (PHP) |
| `unitName` | VARCHAR(40) | NO | — | Unit name (e.g., "kg", "pack", "box", "bulk") |
| `image` | VARCHAR(255) | YES | — | Image URL or emoji for this variant |

---

### Table: `deliveries`
Stores customer delivery orders and their tracking information.

| Column | Data Type | Nullable | Key | Description |
|---|---|---|---|---|
| `id` | BIGINT UNSIGNED | NO | PK | Auto-increment internal ID |
| `delivery_id` | VARCHAR(64) | NO | UNIQUE | Unique delivery reference (e.g., `DEL-0289`) |
| `branch` | VARCHAR(120) | NO | — | Originating branch name |
| `customer_name` | VARCHAR(120) | NO | — | Customer's full name |
| `customer_phone` | VARCHAR(30) | NO | — | Customer's mobile number |
| `address` | TEXT | NO | — | Delivery address text |
| `barangay` | VARCHAR(100) | NO | — | Customer's barangay |
| `lat` | DOUBLE | NO | — | Customer GPS latitude |
| `lng` | DOUBLE | NO | — | Customer GPS longitude |
| `status` | ENUM | NO | — | `Pending`, `Preparing`, `Out for Delivery`, `Delivered`, `Cancelled` |
| `delivery_fee` | DECIMAL(10,2) | NO | — | Delivery fee charged (PHP) |
| `total_amount` | DECIMAL(10,2) | NO | — | Total order amount including fee (PHP) |
| `driver_name` | VARCHAR(120) | NO | — | Assigned rider's name |
| `driver_lat` | DOUBLE | NO | — | Rider's current GPS latitude |
| `driver_lng` | DOUBLE | NO | — | Rider's current GPS longitude |
| `driver_location_updated_at` | TIMESTAMP | YES | NULL | Server time of the latest rider GPS fix |
| `eta_minutes` | INT(11) | NO | — | Estimated delivery time in minutes |
| `notes` | TEXT | YES | — | Special delivery instructions |
| `timestamp` | TIMESTAMP | NO | — | Last status update timestamp |
| `created_at` | TIMESTAMP | NO | — | Order creation timestamp |

---

### Table: `delivery_items`
Stores the line items (products) for each delivery order.

| Column | Data Type | Key | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK | Auto-increment |
| `delivery_pk` | BIGINT UNSIGNED | FK → `deliveries.id` | References parent delivery |
| `product_id` | VARCHAR(64) | — | Product identifier |
| `name` | VARCHAR(200) | — | Product name at time of order |
| `quantity` | INT(11) | — | Quantity ordered |
| `price` | DECIMAL(10,2) | — | Unit price at time of order |

---

### Table: `orders_transactions`
Stores POS transaction headers.

| Column | Data Type | Key | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK | Auto-increment |
| `txn_id` | VARCHAR(64) | UNIQUE | Transaction reference (e.g., `TXN-826573`) |
| `branch` | VARCHAR(120) | — | Branch where transaction occurred |
| `subtotal` | DECIMAL(10,2) | — | Pre-discount total (PHP) |
| `discountType` | ENUM | — | `none`, `senior`, `pwd`, `percentage` |
| `discountAmount` | DECIMAL(10,2) | — | Discount value applied (PHP) |
| `total` | DECIMAL(10,2) | — | Final total after discount (PHP) |
| `paymentMethod` | ENUM | — | `Cash`, `GCash`, `Maya` |
| `amountPaid` | DECIMAL(10,2) | — | Amount tendered by customer (PHP) |
| `change_amount` | DECIMAL(10,2) | — | Change returned to customer (PHP) |
| `timestamp` | TIMESTAMP | — | Transaction completion time |
| `cashier` | VARCHAR(120) | — | Name of the cashier who processed the transaction |
| `created_at` | TIMESTAMP | — | Record creation timestamp |

---

### Table: `service_transactions`
Records Value-Added Service transactions.

| Column | Data Type | Key | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK | Auto-increment |
| `service_txn_id` | VARCHAR(64) | UNIQUE | VAS transaction reference ID |
| `branch` | VARCHAR(120) | — | Branch where service was processed |
| `type` | ENUM | — | `E-Load`, `Bills Payment`, `Remittance` |
| `provider` | VARCHAR(160) | — | Service provider name |
| `recipient` | VARCHAR(120) | — | Phone number or account number |
| `sender_or_account_name` | VARCHAR(160) | — | Customer/sender name |
| `amount` | DECIMAL(10,2) | — | Service amount (PHP) |
| `service_fee` | DECIMAL(10,2) | — | Store service fee (PHP) |
| `total_amount` | DECIMAL(10,2) | — | Total collected from customer (PHP) |
| `status` | ENUM | — | `Completed`, `Pending`, `Failed` |
| `timestamp` | TIMESTAMP | — | Service completion timestamp |
| `created_at` | TIMESTAMP | — | Record creation timestamp |

---

### Table: `system_notifications`
Stores in-app system notifications.

| Column | Data Type | Key | Description |
|---|---|---|---|
| `id` | VARCHAR(64) | PK | Unique notification ID |
| `type` | ENUM | — | `info`, `warning`, `success`, `danger` |
| `title` | VARCHAR(200) | — | Notification title |
| `message` | TEXT | — | Notification message body |
| `timestamp` | VARCHAR(64) | — | ISO timestamp string |
| `product_id` | VARCHAR(64) | YES | Related product ID (nullable) |
| `branch` | VARCHAR(120) | YES | Related branch (nullable) |
| `is_read` | TINYINT(1) | — | 0 = Unread, 1 = Read |
| `created_at` | TIMESTAMP | — | Record creation timestamp |

---

### Table: `system_settings`
Key-value store for system-wide configuration.

| Column | Data Type | Key | Description |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK | Auto-increment |
| `setting_key` | VARCHAR(120) | UNIQUE | Configuration key (e.g., `categories`) |
| `setting_value` | LONGTEXT (JSON) | — | JSON-encoded setting value |
| `updated_at` | TIMESTAMP | — | Last modification timestamp |

---

## 9.4 Entity Relationships

```
products (1) ──────< product_stock (many)  [product_id]
products (1) ──────< product_variants (many)  [product_id]
deliveries (1) ──────< delivery_items (many)  [delivery_pk → id]
orders_transactions (1) ──────< orders_transaction_items (many)  [txn_pk → id]
supplier_deliveries (1) ──────< supplier_delivery_items (many)  [supplier_delivery_pk → id]
customers (1) ──────< customer_delivery_addresses (many)  [customer_name]
```

---

# 10. User Interface Documentation

## 10.1 Login Screen

**Screen Name:** Role-Based Login  
**Purpose:** Authenticates all user types (Admin, Cashier, Rider, Customer)  
**Route:** `/` (default landing page)

**Components:**
- Store branding header (Silang Mini Mart logo and name)
- Role selector buttons (Admin/Cashier, Rider, Customer)
- Name/username input field
- Password/PIN input field (masked)
- "Sign In" submit button
- Error message display area

**Validation Rules:**
- All fields required
- Role must be selected before submission

**Navigation Flow:** Successful login → Role-specific dashboard view

> 📷 **[Screenshot Placeholder: Login Screen]**

---

## 10.2 Admin Dashboard — Inventory Management

**Screen Name:** Inventory Management  
**Purpose:** Allows admin to manage the full product catalog, stock levels, and variants  
**Access:** Admin only

**Components:**
- Product search bar
- Category filter tabs
- Product grid/list view with thumbnail, name, category, price, and stock levels
- "Add Product" button → opens product form modal
- Per-product Edit (pencil icon) and Delete (trash icon) action buttons
- Low-stock badge indicator
- Branch stock columns (Branch A stock, Branch B stock)

**Input Fields (Product Form):**
- Product name (text)
- Tagalog name (text, optional)
- Category (dropdown from system settings)
- Retail price (PHP, decimal)
- Cost price (PHP, decimal)
- Shelf location (text)
- Barcode (text)
- Unit type (dropdown: kg, can, pack, bottle, pc, bag)
- Low-stock threshold (integer)
- Stock quantity per branch (integer per branch)
- Image gallery (multi-image upload or emoji)
- Packaging variants (Retail, Pack, Box, Wholesale) with labels, qty, price, cost, unit name

**Validation Rules:**
- Required: name, category, price, cost, barcode, unit, shelfLocation
- Barcode must be unique
- Price and cost must be positive numbers

**Navigation Flow:** Inventory → Edit Product Modal → Save → Updated Product List

> 📷 **[Screenshot Placeholder: Inventory Management Screen]**
> 📷 **[Screenshot Placeholder: Add/Edit Product Modal]**

---

## 10.3 POS Terminal

**Screen Name:** Point-of-Sale Terminal  
**Purpose:** Enables cashiers to process customer purchases  
**Access:** Admin, Cashier

**Components:**
- Product search bar (name or barcode)
- Product result list with variant selector
- Shopping cart panel (right side)
- Cart items list with qty control (+/–) and remove button
- Subtotal, Discount section, and Total display
- Payment method selector (Cash/GCash/Maya)
- Amount paid input (for cash)
- Change display
- "Process Transaction" confirm button
- Transaction history tab

> 📷 **[Screenshot Placeholder: POS Terminal Screen]**

---

## 10.4 Delivery Management Panel

**Screen Name:** Delivery Management  
**Purpose:** Admin view for managing all delivery orders  
**Access:** Admin

**Components:**
- Delivery order list with status badge (color-coded)
- Filter by status (Pending, Preparing, Out for Delivery, Delivered, Cancelled)
- Delivery detail view (customer info, items, address, driver info)
- Interactive Leaflet map showing customer and driver pin
- Status update dropdown with confirm button
- "Create New Delivery" button
- Driver assignment selector

> 📷 **[Screenshot Placeholder: Delivery Management Screen]**
> 📷 **[Screenshot Placeholder: Delivery Map View]**

---

## 10.5 Customer Portal

**Screen Name:** Customer Shopping Portal  
**Purpose:** Online shopping interface for registered customers  
**Access:** Customer

**Components:**
- Top navigation bar (Home, Categories, Cart, Track Order, Profile)
- Product browsing grid with category tabs
- Product card (image, name, price variants, add to cart button)
- Shopping cart drawer (slide-in from right)
- Delivery address form with interactive Leaflet map pin
- Order summary and confirmation screen
- Delivery tracking map view

> 📷 **[Screenshot Placeholder: Customer Portal — Browse Products]**
> 📷 **[Screenshot Placeholder: Customer Portal — Cart & Checkout]**
> 📷 **[Screenshot Placeholder: Customer Portal — Delivery Tracking Map]**

---

## 10.6 Rider Dashboard

**Screen Name:** Rider Delivery Dashboard  
**Purpose:** Allows delivery riders to view and manage their deliveries  
**Access:** Rider

**Components:**
- List of assigned deliveries with status and customer info
- Map view showing customer delivery location
- Status update buttons (Preparing → Out for Delivery → Delivered)
- Customer phone number with call link
- Delivery item list
- AI chatbot sidebar

> 📷 **[Screenshot Placeholder: Rider Dashboard Screen]**

---

## 10.7 Branch Analytics Dashboard

**Screen Name:** Branch Analytics  
**Purpose:** Business intelligence dashboard for the store manager  
**Access:** Admin

**Components:**
- Key metric cards (Total Revenue, Total Transactions, Total Deliveries, VAS Revenue)
- Revenue trend line chart (daily/weekly/monthly)
- Top-selling products ranked list
- Product category sales breakdown (pie/bar chart)
- Date range filter
- Branch selector

> 📷 **[Screenshot Placeholder: Branch Analytics Dashboard]**

---

## 10.8 Value-Added Services (VAS) Screen

**Screen Name:** Value-Added Services  
**Purpose:** Logs E-Load, Bills Payment, and Remittance transactions  
**Access:** Admin, Cashier

**Components:**
- Service type selector tabs (E-Load / Bills Payment / Remittance)
- Provider selector (provider-specific sub-forms)
- Recipient/account number input
- Amount and service fee inputs
- Total amount computation display
- Submit transaction button
- VAS transaction history table

> 📷 **[Screenshot Placeholder: VAS Screen — E-Load Form]**

---

# 11. System Workflow

## 11.1 Customer Order Workflow

1. **Registration/Login:** Customer registers with name, phone, and PIN, or logs in with existing credentials.
2. **Browse Products:** Customer browses the product catalog by category or uses the search bar.
3. **Select Variants:** Customer selects the desired packaging variant (Tingi, Balot, Karton, Pakyaw).
4. **Add to Cart:** Customer adds items to the shopping cart with desired quantities.
5. **Set Delivery Address:** Customer selects or creates a delivery address using the interactive map.
6. **Place Order:** Customer reviews the cart, confirms the delivery address, and submits the order.
7. **Order Processing:** Admin receives the new order and assigns a rider.
8. **Out for Delivery:** Rider collects the order and updates status; map shows rider location.
9. **Delivery Tracking:** Customer monitors the rider's location in real-time on the tracking map.
10. **Delivery Completion:** Rider marks the delivery as `Delivered`; customer receives confirmation.

---

## 11.2 POS / Cashier Transaction Workflow

1. **Cashier Login:** Cashier selects the Admin/Cashier role, enters name and password.
2. **Product Lookup:** Cashier scans a barcode or searches by product name.
3. **Variant Selection:** Cashier selects packaging variant (Tingi/Balot/Karton/Pakyaw) and quantity.
4. **Cart Management:** Cashier adjusts quantities as needed; system displays running subtotal.
5. **Discount Application:** If applicable, cashier applies Senior/PWD/Percentage discount.
6. **Payment Processing:** Cashier selects payment method; enters amount paid for cash transactions.
7. **Transaction Confirmation:** System computes change and confirms the sale.
8. **Receipt Issuance:** System generates a PDF receipt for the customer.
9. **Stock Deduction:** System automatically deducts sold quantities from branch inventory.

---

## 11.3 Administrator Workflow

1. **Admin Login:** Admin selects Admin/Cashier role, enters name and password.
2. **Dashboard Navigation:** Admin accesses the full admin menu (Inventory, Analytics, Deliveries, etc.).
3. **Daily Monitoring:** Admin reviews notifications (low-stock alerts), delivery statuses, and pending orders.
4. **Inventory Management:** Admin adds new products, adjusts stock, updates pricing, or removes products.
5. **Delivery Oversight:** Admin reviews incoming delivery orders, assigns riders, and monitors progress.
6. **Supplier Receiving:** When goods arrive, admin records the supplier delivery to update stock.
7. **Analytics Review:** Admin reviews the Branch Analytics dashboard for business performance insights.
8. **End-of-Day Operations:** Admin reviews the day's POS transactions and VAS logs.
9. **System Maintenance:** Admin manages user accounts, updates system settings, and backs up the database.

---

# 12. UML Documentation

## 12.1 Use Case Diagram Description

**Actors:**
- Administrator (Admin)
- Cashier
- Customer
- Delivery Rider
- Google Gemini API (external system)

**Use Cases — Admin:**
- Manage Products (CRUD)
- Manage Stock Levels
- View Inventory
- Manage Delivery Orders
- Assign Delivery Riders
- View Branch Analytics
- Manage User Accounts
- Manage Branches
- Manage Supplier Deliveries
- View System Notifications
- Configure System Settings
- Use AI Assistant (Admin persona)

**Use Cases — Cashier:**
- Process POS Transaction
- Apply Discounts
- Generate Receipt
- Log E-Load Transaction
- Log Bills Payment Transaction
- Log Remittance Transaction
- Use AI Assistant (Cashier persona)

**Use Cases — Customer:**
- Register Account
- Login
- Browse Products
- Add to Cart
- Manage Delivery Addresses
- Place Delivery Order
- Track Delivery in Real-Time
- Use AI Assistant (Customer/Ate Digy persona)

**Use Cases — Rider:**
- Login
- View Assigned Deliveries
- Update Delivery Status
- Update GPS Location
- Use AI Assistant (Rider persona)

**Include/Extend Relationships:**
- `Process POS Transaction` includes `Apply Discounts`, `Select Payment Method`, `Generate Receipt`
- `Place Delivery Order` includes `Select Delivery Address`
- `Use AI Assistant` extends from all role-specific use cases

---

## 12.2 Activity Diagram Description

### POS Transaction Activity Flow:
1. [Start] → Cashier opens POS module
2. → Search product by name or barcode
3. → [Product found?] Yes → Select packaging variant → Add to cart
4. → [More items?] Yes → loop to step 2
5. → [No] → Apply discount (optional)
6. → Select payment method
7. → [Cash?] Yes → Enter amount paid → Compute change
8. → Confirm transaction
9. → Save to database → Deduct stock
10. → Generate PDF receipt
11. [End]

### Delivery Tracking Activity Flow:
1. [Start] Customer places order
2. → System creates Delivery record (status: Pending)
3. → Admin assigns rider (status: Preparing)
4. → Rider picks up order (status: Out for Delivery)
5. → Rider's GPS updated periodically on map
6. → Customer tracks on live map
7. → [Delivered?] Yes → Rider marks Delivered
8. → [Cancelled?] → Rider/Admin marks Cancelled
9. [End]

---

## 12.3 Sequence Diagram Description

### Login Sequence:
1. User submits credentials (role, name, password)
2. Browser → `POST /api/auth/login` (Express.js)
3. Express → Query `users` or `customers` table (MariaDB)
4. MariaDB → Returns user record or empty
5. Express → Validates credentials
6. Express → If valid: `generateToken()` → Returns JWT + user profile
7. Express → If invalid: Returns HTTP 401 with error message
8. Browser → Stores JWT in memory/state → Renders role dashboard

---

## 12.4 Class Diagram Description

**Key Classes (TypeScript Interfaces mapped to Classes):**

- **Product** {id, name, tagalogName, category, price, cost, stockByBranch, barcode, unit, lowStockThreshold, images, variants: PackagingVariant[]}
- **PackagingVariant** {type, label, qtyPerUnit, price, cost, unitName, image}
- **Transaction** {id, branch, items, subtotal, discountType, discountAmount, total, paymentMethod, amountPaid, change_amount, cashier}
- **Delivery** {id, branch, customerName, customerPhone, address, barangay, coordinates, status, items, deliveryFee, totalAmount, driverName, driverCoordinates, etaMinutes}
- **ServiceTransaction** {id, branch, type, provider, recipient, senderOrAccountName, amount, serviceFee, totalAmount, status}
- **SupplierDelivery** {id, supplierName, branch, deliveryDate, items, totalCost, status, receivedBy}
- **SystemNotification** {id, type, title, message, timestamp, productId, branch, read}

**Relationships:**
- Product `1` — `*` PackagingVariant (one product has many variants)
- Transaction `1` — `*` TransactionItem (one transaction has many items)
- Delivery `1` — `*` DeliveryItem (one delivery has many items)
- SupplierDelivery `1` — `*` SupplierDeliveryItem

---

## 12.5 ER Diagram Description

**Entities and Primary Keys:**
- `branches` (id PK)
- `users` (id PK, username UNIQUE)
- `customers` (id PK, name UNIQUE)
- `customer_delivery_addresses` (id PK)
- `products` (id PK, barcode UNIQUE)
- `product_stock` (product_id + branch COMPOSITE PK)
- `product_variants` (id PK, product_id + type UNIQUE)
- `deliveries` (id PK, delivery_id UNIQUE)
- `delivery_items` (id PK)
- `orders_transactions` (id PK, txn_id UNIQUE)
- `orders_transaction_items` (id PK)
- `service_transactions` (id PK, service_txn_id UNIQUE)
- `supplier_deliveries` (id PK, supplier_delivery_id UNIQUE)
- `supplier_delivery_items` (id PK)
- `system_notifications` (id PK)
- `system_settings` (id PK, setting_key UNIQUE)

**Foreign Key Relationships:**
- `product_stock.product_id` → `products.id` (CASCADE DELETE)
- `product_variants.product_id` → `products.id` (CASCADE DELETE)
- `delivery_items.delivery_pk` → `deliveries.id` (CASCADE DELETE)
- `orders_transaction_items.txn_pk` → `orders_transactions.id` (CASCADE DELETE)
- `supplier_delivery_items.supplier_delivery_pk` → `supplier_deliveries.id` (CASCADE DELETE)

---

## 12.6 Deployment Diagram Description

**Nodes:**
1. **Developer/Store Workstation** — Runs XAMPP (MariaDB on port 3306) and Node.js application server (port 3000)
2. **Client Devices** (PC, Tablet, Mobile) — Web browsers on the same local network connecting to `https://<server-ip>:3000` when a trusted LAN TLS certificate is configured; otherwise HTTP is available for non-GPS local use
3. **Google Cloud** — External Google Gemini API accessed over HTTPS from the Node.js server

**Communication Links:**
- Client Browser ←HTTPS (configured LAN certificate)→ Node.js Express Server (port 3000)
- Node.js Server ←TCP→ MariaDB (localhost:3306)
- Node.js Server ←HTTPS→ Google Gemini API (api.generativeai.google.com)

---

# 13. API Documentation

## 13.1 Authentication

All protected endpoints require the following HTTP header:

```
Authorization: Bearer <JWT_TOKEN>
```

Tokens are obtained from `POST /api/auth/login`.

---

## 13.2 Authentication Endpoints

### POST /api/auth/login
Authenticates a user and returns a JWT token.

| Field | Value |
|---|---|
| **URL** | `/api/auth/login` |
| **Method** | POST |
| **Authentication** | None (public) |

**Request Body:**
```json
{
  "role": "admin",
  "name": "AdminSilang",
  "password": "admin"
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "token": "<JWT_STRING>",
  "user": {
    "username": "admin",
    "role": "admin",
    "name": "AdminSilang"
  }
}
```

**Error Responses:**
| Code | Description |
|---|---|
| 400 | Missing required fields |
| 401 | Invalid credentials |
| 500 | Server error |

---

## 13.3 Product Endpoints

### GET /api/products
Returns all products with variants and stock levels per branch.

| Field | Value |
|---|---|
| **Method** | GET |
| **Authentication** | None (public) |

**Success Response (200):**
```json
{
  "ok": true,
  "products": [
    {
      "id": "prod-8396",
      "name": "Sinandomeng rice",
      "category": "Rice & Grains",
      "price": 1508.00,
      "stockBranchA": 86,
      "stockBranchB": 0,
      "variants": [
        { "type": "retail", "label": "Daily Retail (1 kg)", "price": 1508.00 }
      ]
    }
  ]
}
```

### POST /api/products
Creates a new product. **Requires Admin JWT.**

### PUT /api/products/:id
Updates an existing product. **Requires Admin JWT.**

### DELETE /api/products/:id
Deletes a product and all related stock/variant records. **Requires Admin JWT.**

### POST /api/products/:id/variant-images
Uploads images for product variants. **Requires Admin JWT.** Content-Type: `multipart/form-data`.

---

## 13.4 POS Endpoints

### POST /api/pos/transaction
Submits a new POS transaction.

**Request Body:**
```json
{
  "txn_id": "TXN-826573",
  "branch": "Silang Mini Mart Cainta Branch",
  "subtotal": 3016.00,
  "discountType": "none",
  "discountAmount": 0,
  "total": 3016.00,
  "paymentMethod": "Cash",
  "amountPaid": 3016.00,
  "change_amount": 0,
  "cashier": "AdminSilang",
  "items": [
    { "product_id": "prod-8396", "name": "Sinandomeng rice", "price": 1508.00, "quantity": 2, "unit": "kg" }
  ]
}
```

**Success Response (200):**
```json
{ "ok": true, "txnId": "TXN-826573" }
```

---

## 13.5 Delivery Endpoints

### GET /api/deliveries
Returns all delivery orders. **Requires JWT.**

### POST /api/deliveries
Creates a new delivery order. **Requires JWT.**

### PUT /api/deliveries/:id
Updates delivery status, driver info, or ETA. **Requires JWT.**

### POST /api/deliveries/:id/location
Stores a live GPS fix for the authenticated rider's assigned delivery while its status is `Out for Delivery`. Requires rider JWT.

**Request Body:**
```json
{ "latitude": 14.607, "longitude": 121.104, "accuracyMeters": 12 }
```

The server validates coordinate ranges, records the update timestamp and reported accuracy, and recalculates a distance-based ETA. Customer maps receive location updates through the existing five-second delivery polling and request an actual road route from the rider's current GPS fix to the customer's order coordinates. If the routing service is unavailable, the map reports that and shows a direct line instead; it does not invent a road route. Device location requires HTTPS, browser permission, and an active network connection.

---

## 13.6 Customer Endpoints

### GET /api/customers
Returns all customers. **Requires Admin JWT.**

### POST /api/customers
Creates a new customer account.

### PUT /api/customers/:name/addresses
Saves or updates customer delivery addresses.

---

## 13.7 Chatbot Endpoint

### POST /api/chatbot

| Field | Value |
|---|---|
| **URL** | `/api/chatbot` |
| **Method** | POST |
| **Authentication** | Rate limited (10 req/min/IP) |

**Request Body:**
```json
{
  "role": "customer",
  "name": "Vincent",
  "messages": [
    { "sender": "user", "text": "Magkano ang bigas?" }
  ],
  "userMessage": "Magkano ang bigas?"
}
```

**Success Response (200):**
```json
{
  "reply": "Ang Sinandomeng rice po ay nagbebenta ng ₱1,508 per kilo, o ₱32,573 per karton! Gusto po ninyo magdagdag sa cart?"
}
```

**Error Codes:**
| Code | Description |
|---|---|
| 400 | Missing `role` or `userMessage` |
| 429 | Rate limit exceeded |
| 500 | Gemini API error |

---

# 14. Security Documentation

## 14.1 Authentication

The system uses **JWT (JSON Web Token)** for stateless authentication. Upon successful login, the server generates a signed JWT using a secret key (defined in environment variables). This token is stored client-side and sent with every protected API request in the `Authorization: Bearer <token>` header.

> ⚠️ **Critical Gap:** User passwords in the `users` table are currently stored as **plain text**. This is a significant security vulnerability that must be remediated before any production deployment. Bcrypt or Argon2 hashing should be implemented immediately.

## 14.2 Authorization

The system implements **Role-Based Access Control (RBAC)** through Express.js middleware:
- `requireAuth` middleware validates the JWT token on all protected routes.
- `requireRole(['admin'])` middleware restricts specific endpoints to users with the `admin` role.
- Customer endpoints verify the customer's identity through their JWT claims.

## 14.3 Password Hashing

| User Type | Current Method | Recommended Method |
|---|---|---|
| Staff (Admin/Cashier/Rider) | ⚠️ Plain text | bcrypt (cost factor ≥ 12) |
| Customer (PIN) | ⚠️ Plain text | bcrypt |
| Customer (Password) | SHA-256 hash | bcrypt (upgrade SHA-256 to bcrypt) |

## 14.4 Session Management

- JWT tokens do not have a server-side session store; they are stateless.
- Token expiry should be configured (recommended: 8 hours for staff, 24 hours for customers).
- On logout, the client discards the token. There is currently no token blacklisting mechanism.

## 14.5 Input Validation

- All API route handlers validate required fields using helper functions (`parseString()`, `parseNumber()`).
- Parameterized queries are used throughout the codebase, preventing SQL injection.
- Request bodies are parsed by `express.json()` middleware with implicit size limits.

## 14.6 SQL Injection Prevention

All database queries use **parameterized queries** via the `mysql2` library (the `?` placeholder syntax). No raw string concatenation of user input into SQL queries is present in the codebase.

```typescript
// Example of safe parameterized query:
pool.query('SELECT * FROM users WHERE name = ? AND role = ?', [name, role]);
```

## 14.7 XSS Prevention

- React.js escapes all rendered values by default, preventing Cross-Site Scripting (XSS) attacks in the UI.
- AI chatbot responses have markdown characters stripped on the server side before sending to the client.

## 14.8 CSRF Protection

- [Information Required — CSRF tokens should be implemented for state-changing form submissions if the app is deployed on a public domain]

## 14.9 File Upload Security

Product image uploads are handled by Multer with the following restrictions:
- File type filter: only `image/*` MIME types accepted
- Maximum file size: 5MB per file
- Unique, randomly generated filenames prevent path traversal attacks
- Files stored in a dedicated `uploads/variant-images/` directory, not the application root

## 14.10 Encryption

- JWT tokens are signed (not encrypted) using a secret key. Sensitive data should not be stored in JWT payloads.
- HTTPS should be enforced in production to encrypt data in transit.
- [Information Required — SSL/TLS certificate configuration for production deployment]

## 14.11 Audit Logs

- All POS transactions are permanently recorded in `orders_transactions` with cashier name and timestamp.
- All delivery status changes are timestamped.
- [Information Required — Comprehensive audit logging for admin actions (user management, stock adjustments) should be implemented]

## 14.12 Rate Limiting

The AI chatbot endpoint uses a custom `rateLimiter` middleware imported from `src/utils/authMiddleware.ts` to prevent abuse of the Gemini API.

---

# 15. Installation Guide

## 15.1 Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | Dual-core 1.8GHz | Quad-core 2.5GHz or higher |
| RAM | 4GB | 8GB or higher |
| Storage | 10GB free disk space | 50GB SSD |
| Network | 100 Mbps LAN | 1 Gbps LAN (for multi-device access) |
| Display | 1024×768 | 1920×1080 |

## 15.2 Software Requirements

| Software | Version | Notes |
|---|---|---|
| Windows OS | Windows 10/11 or Windows Server 2019+ | Or equivalent Linux/macOS for dev |
| XAMPP | 8.2+ | Provides MariaDB and phpMyAdmin |
| Node.js | v18 LTS or higher | Required for backend |
| npm | v9 or higher | Bundled with Node.js |
| Modern Web Browser | Chrome 120+, Firefox 120+, Edge 120+ | For accessing the system |
| Git | 2.40+ | For version control |

## 15.3 Dependencies

All Node.js dependencies are listed in `package.json` and installed via `npm install`.

## 15.4 Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
APP_URL=http://localhost:3000

# Database Configuration (if not using defaults)
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=silang_mini_mart
```

> ⚠️ **Never commit `.env.local` or `.env` files containing real API keys to version control.**

## 15.5 Installation Steps

### Step 1: Install XAMPP
1. Download XAMPP from https://www.apachefriends.org/ (version 8.2+)
2. Install XAMPP to `C:\xampp\`
3. Launch XAMPP Control Panel and start the **MySQL** service.

### Step 2: Install Node.js
1. Download Node.js LTS from https://nodejs.org/
2. Install Node.js, ensuring npm is included.
3. Verify installation: `node --version` and `npm --version`

### Step 3: Clone/Copy the Project
1. Copy the project folder to `C:\xampp\htdocs\silang-mini-mart\`
   ```
   C:\xampp\htdocs\silang-mini-mart\
   ├── server.ts
   ├── src/
   ├── package.json
   └── ...
   ```

### Step 4: Install Node.js Dependencies
Open a terminal in the project directory:
```powershell
cd C:\xampp\htdocs\silang-mini-mart
npm install
```

### Step 5: Configure Environment
1. Copy `.env` to `.env.local` (or create `.env.local`)
2. Add your `GEMINI_API_KEY` from Google AI Studio (https://aistudio.google.com/)
3. Configure database credentials if non-default

## 15.6 Database Setup

### Step 6: Create Database
1. Open phpMyAdmin at http://localhost/phpmyadmin
2. Click "New" to create a new database
3. Database name: `silang_mini_mart`
4. Character set: `utf8mb4`
5. Collation: `utf8mb4_general_ci`
6. Click "Create"

### Step 7: Import Database Schema and Data
1. In phpMyAdmin, select the `silang_mini_mart` database
2. Click the "Import" tab
3. Click "Choose File" and select `silang_mini_mart.sql` from the project root
4. Click "Go" to import

Alternatively, use the MySQL CLI:
```bash
mysql -u root -p silang_mini_mart < C:\xampp\htdocs\silang-mini-mart\silang_mini_mart.sql
```

## 15.7 Build and Run Instructions

### Development Mode (with Hot Reload):
```powershell
npm run dev
```
The server starts at http://localhost:3000

### Production Build:
```powershell
npm run build
node dist/server.cjs
```

## 15.8 Deployment Steps (Local Network)

1. For phone GPS/PWA support, configure HTTPS as described in the README's **Enable trusted HTTPS for a Windows LAN** section. A phone must trust the certificate issuer; changing the URL scheme alone does not enable HTTPS.
2. Start the server: `npm run dev`
3. Use the `https://<server-ip>:3000` address printed in the console on devices connected to the same Wi-Fi/LAN.
4. Configure the device's browser bookmarks for quick access. Plain HTTP remains available only when HTTPS certificate paths are not configured, and browser GPS will not work there on other devices.

---

# 16. User Manual

## 16.1 Getting Started — Login

1. Open a web browser on any device connected to the store network.
2. Navigate to `http://localhost:3000` (or the store server's IP address).
3. The login screen appears. Select your role:
   - **Admin/Cashier** for store staff
   - **Rider** for delivery riders
   - **Customer** for online shoppers
4. Enter your display name (exactly as registered) and your password or PIN.
5. Click "Sign In."

---

## 16.2 Customer Registration

1. On the login screen, select the "Customer" role.
2. If you are a new customer, click "Register" or "Create Account."
3. Enter your full name, mobile phone number, and barangay/address.
4. Set your delivery coordinates by clicking on the map.
5. Choose a 4-digit PIN.
6. Click "Register." You will be logged in automatically.

---

## 16.3 Browsing Products (Customer)

1. After logging in as a customer, you will see the product catalog.
2. Browse by scrolling through categories (Rice & Grains, Canned Goods, Beverages, etc.).
3. Use the search bar to find a specific product by name.
4. Click on a product card to view available variants and pricing.

---

## 16.4 Adding to Cart and Checkout (Customer)

1. On a product card, select the desired packaging variant (e.g., Tingi, Balot, Karton).
2. Click "Add to Cart" (+).
3. Click the cart icon to open the cart drawer.
4. Adjust quantities using the +/– buttons; remove items with the trash icon.
5. Click "Checkout" when ready.
6. Select or confirm your delivery address on the map.
7. Click "Place Order" to submit.

---

## 16.5 Tracking a Delivery (Customer)

1. After placing an order, navigate to the "Track Order" or "Deliveries" section.
2. Your active delivery will appear with the current status.
3. Click "View on Map" to open the real-time tracking map.
4. The map shows your delivery address (house pin) and the rider's current location (rider pin).
5. The ETA countdown is displayed on the tracking screen.

---

## 16.6 Processing a POS Transaction (Cashier)

1. Log in with the Admin/Cashier role.
2. Navigate to the POS Terminal module.
3. Search for a product by name or scan/type the barcode.
4. Select the packaging variant and quantity, then click "Add to Cart."
5. Repeat for all items.
6. If the customer has a Senior Citizen or PWD ID, select the appropriate discount type.
7. Select the payment method: Cash, GCash, or Maya.
8. For cash, enter the amount paid. The system displays the change.
9. Click "Process Transaction" to complete the sale.
10. Click "Print Receipt" to generate a PDF receipt.

---

## 16.7 Logging a Value-Added Service (Cashier)

1. Navigate to the "Value-Added Services" module.
2. Select the service type (E-Load, Bills Payment, or Remittance).
3. Fill in the required details:
   - **E-Load:** Select telco provider, enter recipient phone number, load amount.
   - **Bills Payment:** Select biller (Meralco, etc.), enter account number, amount.
   - **Remittance:** Select service (Cebuana, Palawan Express), enter sender/recipient names and amount.
4. System auto-computes the service fee and total amount.
5. Collect the total from the customer and click "Submit Transaction."

---

## 16.8 Using the AI Assistant

1. Click the chat icon (floating button) available on any screen.
2. Type your question in the chat box.
3. The AI responds based on your role:
   - **Admin:** Business questions, inventory advice, analytics insights.
   - **Customer:** Product recommendations, pricing help, delivery info.
   - **Cashier:** POS procedures, discount rules, VAS guidance.
   - **Rider:** Route advice, delivery tips, incentive info.
4. The conversation history is maintained within the session.

---

# 17. Administrator Manual

## 17.1 User Management

1. Navigate to the admin settings or user management panel.
2. To add a new cashier or rider:
   - Access the database via phpMyAdmin or a dedicated admin panel.
   - Insert a new record into the `users` table with the appropriate `role` (`cashier` or `rider`).
   - Set `status` to `active`.
3. To deactivate a user:
   - Update the user's `status` to `inactive` in the `users` table.
   - The user will no longer be able to log in.

> 📌 **Note:** A dedicated User Management UI in the frontend is **[Information Required — to be implemented in a future version]**.

---

## 17.2 Product and Inventory Management

1. Log in as Admin and navigate to "Inventory Management."
2. **Add Product:** Click "Add Product," fill in all required fields, configure variants, set branch stock levels, and save.
3. **Edit Product:** Click the edit icon on any product; modify fields and save.
4. **Adjust Stock:** For supplier deliveries, use the "Supplier Deliveries" module to record incoming goods. The system updates stock automatically.
5. **Delete Product:** Click the delete icon. This is irreversible — all stock and variant records are cascaded deleted.

---

## 17.3 Database Backup

1. Open phpMyAdmin at http://localhost/phpmyadmin.
2. Select the `silang_mini_mart` database in the left panel.
3. Click "Export" in the top menu.
4. Select "Quick" export method and format "SQL."
5. Click "Go" to download the `.sql` backup file.
6. Save the file to a secure location (USB drive, cloud storage, or another PC).

**Recommended Schedule:** Daily backups at end of business day.

---

## 17.4 Database Restore

1. Create a fresh `silang_mini_mart` database in phpMyAdmin if restoring to a new server.
2. Select the database and click "Import."
3. Choose the `.sql` backup file.
4. Click "Go" to restore.

---

## 17.5 System Notifications Monitoring

1. The bell icon in the admin header displays unread notification count.
2. Click the bell to open the notifications panel.
3. Review all notifications, especially **low-stock warnings** (danger type).
4. Act on low-stock notifications by placing supplier orders or updating stock.
5. Click "Mark as Read" on individual notifications or "Mark All as Read."

---

## 17.6 System Configuration

1. Navigate to System Settings.
2. **Product Categories:** Add, remove, or reorder product categories used throughout the system.
3. **Branch Management:** Add new branches with name, address, and GPS coordinates.
4. Settings are stored in the `system_settings` table as JSON values.

---

## 17.7 Server Monitoring

1. The Node.js server logs are displayed in the terminal where `npm run dev` is running.
2. Monitor logs for error messages, failed API calls, or database connection issues.
3. Database server status can be monitored via the XAMPP Control Panel.

---

# 18. Testing Documentation

## 18.1 Unit Test Cases

| Test ID | Module | Test Description | Test Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| UT-001 | Auth | Valid admin login | 1. POST `/api/auth/login` with valid admin credentials | HTTP 200 with JWT token | [Information Required] | [Information Required] |
| UT-002 | Auth | Invalid password | 1. POST `/api/auth/login` with wrong password | HTTP 401 error message | [Information Required] | [Information Required] |
| UT-003 | Auth | Missing role field | 1. POST `/api/auth/login` without `role` | HTTP 400 error | [Information Required] | [Information Required] |
| UT-004 | Products | Get all products | 1. GET `/api/products` | HTTP 200 with products array | [Information Required] | [Information Required] |
| UT-005 | Products | Add product (duplicate barcode) | 1. POST `/api/products` with duplicate barcode | HTTP 400 duplicate entry error | [Information Required] | [Information Required] |
| UT-006 | POS | Process valid transaction | 1. POST `/api/pos/transaction` with valid payload | HTTP 200 with transaction ID | [Information Required] | [Information Required] |
| UT-007 | POS | Discount computation (Senior) | 1. Set discountType to `senior` on ₱1,000 subtotal | discountAmount = ₱200, total = ₱800 | [Information Required] | [Information Required] |
| UT-008 | Deliveries | Create delivery | 1. POST `/api/deliveries` with valid payload | HTTP 200 with delivery ID | [Information Required] | [Information Required] |
| UT-009 | Deliveries | Update status | 1. PUT `/api/deliveries/:id` with `status: "Out for Delivery"` | HTTP 200, status updated | [Information Required] | [Information Required] |
| UT-010 | File Upload | Upload valid image | 1. POST `/api/products/:id/variant-images` with JPEG file | HTTP 200, image URL returned | [Information Required] | [Information Required] |
| UT-011 | File Upload | Reject non-image file | 1. POST `/api/products/:id/variant-images` with PDF file | HTTP 400 or 422 error | [Information Required] | [Information Required] |

## 18.2 Integration Test Cases

| Test ID | Module | Test Description | Test Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| IT-001 | Auth + POS | Cashier login then process transaction | 1. Login as cashier 2. Use JWT to POST `/api/pos/transaction` | Both steps succeed | [Information Required] | [Information Required] |
| IT-002 | POS + Inventory | POS transaction reduces stock | 1. Note stock before 2. Process POS transaction for 2kg 3. Check stock after | Stock decremented by 2 | [Information Required] | [Information Required] |
| IT-003 | Customer + Delivery | Customer places order, admin views it | 1. Login as customer 2. POST delivery 3. Login as admin 4. GET deliveries | Admin sees new order | [Information Required] | [Information Required] |
| IT-004 | Delivery + Rider | Rider updates delivery status | 1. Login as rider 2. PUT `/api/deliveries/:id` with status update | Status changes, customer tracking updates | [Information Required] | [Information Required] |
| IT-005 | Inventory + Notifications | Low-stock alert generation | 1. Set stock below threshold 2. Process sale 3. Check notifications | Low-stock notification appears | [Information Required] | [Information Required] |
| IT-006 | VAS | Log E-Load, check transaction history | 1. POST `/api/services` for E-Load 2. GET `/api/services` | Transaction appears in history | [Information Required] | [Information Required] |

## 18.3 System Test Cases

| Test ID | Module | Test Description | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| ST-001 | Full POS Workflow | Complete a POS transaction from product search to receipt | Receipt generated, stock decremented, transaction saved | [Information Required] | [Information Required] |
| ST-002 | Full Delivery Workflow | Customer orders → Admin assigns → Rider delivers → Delivered status | All status transitions succeed; customer map updates | [Information Required] | [Information Required] |
| ST-003 | AI Chatbot | Send message as each role | Appropriate role-specific response received | [Information Required] | [Information Required] |
| ST-004 | Multi-Device Access | Two browsers access system simultaneously | Both function independently without conflict | [Information Required] | [Information Required] |
| ST-005 | Responsive UI | Access system on 375px mobile viewport | All UI elements accessible and functional | [Information Required] | [Information Required] |

## 18.4 User Acceptance Test Cases

| Test ID | Feature | Tester Role | Test Scenario | Pass Criteria | Status |
|---|---|---|---|---|---|
| UAT-001 | Login | Cashier | Cashier logs in with their credentials | Successfully reaches POS dashboard within 5 seconds | [Information Required] |
| UAT-002 | POS Transaction | Cashier | Cashier processes a 3-item mixed cart with GCash payment | Transaction completed, receipt downloadable | [Information Required] |
| UAT-003 | Customer Order | Customer | Customer browses, adds to cart, and places a delivery order | Order appears in admin delivery panel | [Information Required] |
| UAT-004 | Delivery Tracking | Customer | Customer tracks an active delivery on the map | Driver pin visible and updating on the map | [Information Required] |
| UAT-005 | Inventory | Admin | Admin adds a new product with 2 variants and sets stock | Product appears in inventory and POS search | [Information Required] |
| UAT-006 | Analytics | Admin | Admin views today's sales in the analytics dashboard | Sales data displayed correctly in charts | [Information Required] |
| UAT-007 | VAS | Cashier | Cashier logs an E-Load transaction for Smart 50 load | Transaction recorded, appears in VAS history | [Information Required] |

---

# 19. Error Handling

## 19.1 Troubleshooting Guide

| Error | Cause | Solution | Prevention |
|---|---|---|---|
| **"GEMINI_API_KEY is not defined"** | Missing API key in environment file | Add `GEMINI_API_KEY=<your_key>` to `.env.local` | Always configure environment before starting server |
| **"Cannot connect to MySQL server"** | XAMPP MySQL service not running | Open XAMPP Control Panel and start MySQL | Add MySQL auto-start to XAMPP settings |
| **HTTP 401 "Maling password"** | Incorrect login credentials entered | Verify correct name and password/PIN | Double-check case sensitivity of name field |
| **HTTP 401 "Invalid or expired token"** | JWT token expired or tampered | Log out and log back in | Set reasonable token expiry; refresh on activity |
| **Barcode already exists (HTTP 400)** | Duplicate barcode when adding product | Change the barcode number to a unique value | Validate barcode uniqueness before form submission |
| **"No update fields provided" (HTTP 400)** | PUT request sent with empty body | Ensure at least one field is included in the update payload | Frontend should validate before sending |
| **File upload rejected** | Non-image file or file exceeding 5MB | Use an image file (JPG/PNG/WEBP) under 5MB | Frontend should validate file type and size before upload |
| **Delivery map not loading** | No internet connection for OpenStreetMap tiles | Check internet connection; Leaflet requires online map tiles | Cache map tiles where possible for offline use |
| **Port 3000 already in use** | Another process using port 3000 | Run `netstat -ano | findstr :3000` to find and terminate the conflicting process | Use a different port or stop conflicting services |
| **"relation does not exist" error** | Database not initialized | Run `npm run dev` (auto-runs migrations) or import `silang_mini_mart.sql` | Always import schema before first run |
| **Blank screen after login** | JavaScript error in the browser | Open browser DevTools (F12) → Console tab; report error message | Enable error boundary in React components |
| **Product images not displaying** | Image URL invalid or file missing from uploads/ | Re-upload the product image through the inventory form | Ensure the `uploads/` directory is preserved during updates |
| **Slow performance on older hardware** | Insufficient RAM or CPU | Close unnecessary applications; increase connection pool size | Ensure minimum hardware requirements are met |
| **Changes not reflecting (cache)** | Browser or Vite cache outdated | Hard refresh: Ctrl+Shift+R (browser); restart dev server | Vite's HMR handles most cases automatically |

---

# 20. Backup and Recovery Plan

## 20.1 Backup Schedule

| Backup Type | Frequency | Method | Storage Location |
|---|---|---|---|
| Full Database Backup | Daily (end of business day) | phpMyAdmin Export → SQL | Local USB Drive + Google Drive |
| Incremental Backup | Every 4 hours during business hours | Scheduled script (mysqldump) | Local backup folder |
| Uploads Directory Backup | Weekly | File copy / zip compression | USB Drive |
| Application Code Backup | On each code change | Git commit and push | GitHub Repository |

## 20.2 Backup Storage

- **Primary:** Local USB drive labeled "SILANG MART BACKUP" stored in the store's secure drawer.
- **Secondary:** Google Drive folder shared with store owner — automatic cloud backup.
- **Tertiary:** Git repository on GitHub (code only; database excluded).

## 20.3 Backup Procedure

```bash
# Manual MySQL backup (run in XAMPP terminal or Windows CMD):
"C:\xampp\mysql\bin\mysqldump" -u root silang_mini_mart > "D:\backups\silang_mini_mart_%DATE%.sql"

# Using phpMyAdmin (manual):
# 1. Open http://localhost/phpmyadmin
# 2. Select silang_mini_mart database
# 3. Click Export → Quick → SQL → Go
```

## 20.4 Recovery Procedures

### Scenario 1: Database Corruption
1. Stop the Node.js server.
2. Open XAMPP Control Panel; stop then restart MySQL.
3. Open phpMyAdmin; drop the corrupted `silang_mini_mart` database.
4. Create a fresh `silang_mini_mart` database.
5. Import the most recent `.sql` backup file.
6. Restart the Node.js server.

### Scenario 2: Server Hardware Failure
1. Obtain a replacement PC with XAMPP and Node.js installed.
2. Copy the project files from the backup or Git repository.
3. Import the database from the last backup.
4. Configure the `.env.local` file.
5. Run `npm install` then `npm run dev`.
6. Update any bookmarks or shortcuts on store devices to the new server IP.

## 20.5 Disaster Recovery Time Objectives

| Scenario | Recovery Time Objective (RTO) | Recovery Point Objective (RPO) |
|---|---|---|
| Database restore from backup | < 30 minutes | Last daily backup (max 1 day data loss) |
| Full server replacement | < 2 hours | Last daily backup |
| Application code restore | < 15 minutes | Last Git commit (no data loss) |

---

# 21. Maintenance Plan

## 21.1 Preventive Maintenance

| Activity | Frequency | Responsible |
|---|---|---|
| Database backup verification | Weekly | System Administrator |
| Review low-stock notifications and reorder | Daily | Store Manager |
| Check Node.js server logs for errors | Daily | System Administrator |
| XAMPP and MariaDB software updates | Monthly | System Administrator |
| Node.js and npm dependency updates (`npm audit fix`) | Monthly | Developer |
| Disk space monitoring (uploads folder) | Weekly | System Administrator |
| Test all user login roles | Weekly | System Administrator |
| Review and archive old transaction records | Quarterly | Store Manager |

## 21.2 Corrective Maintenance

Corrective maintenance addresses bugs and issues identified during operations:
1. **Bug Identification:** Reported by users (cashiers, riders, customers) or discovered in logs.
2. **Issue Logging:** Document the bug with steps to reproduce, error messages, and affected module.
3. **Prioritization:** Critical (system down) → High (data loss risk) → Medium (feature broken) → Low (UI glitch).
4. **Fix Development:** Developer analyzes, codes fix in a development branch.
5. **Testing:** Test the fix in a local environment before deployment.
6. **Deployment:** Apply the fix to the production server (restart required).
7. **Verification:** Confirm the issue is resolved and document the resolution.

## 21.3 Adaptive Maintenance

Adaptive maintenance involves updating the system to accommodate environmental changes:
- Updating Node.js version when LTS support ends.
- Updating the Gemini AI model when a newer model is available.
- Updating Leaflet.js when OpenStreetMap changes API requirements.
- Adding new product categories as the store expands its product range.
- Adding new store branches to the branches table.
- Adapting discount rules if government regulations change Senior/PWD discount rates.

## 21.4 Perfective Maintenance

Planned improvements to enhance system performance and usability:
- Implementing bcrypt password hashing (critical security improvement).
- Adding a dedicated User Management UI for the admin panel.
- Implementing token refresh mechanism for extended sessions.
- Adding automated cron-based backup scripts.
- Optimizing database queries with additional indexes as data grows.
- Implementing Progressive Web App (PWA) features for offline POS capability.
- Adding automated unit tests with a testing framework (e.g., Vitest, Jest).

---

# 22. Future Enhancements

## 22.1 Recommended Future Improvements

| Priority | Enhancement | Category | Description |
|---|---|---|---|
| **Critical** | Bcrypt Password Hashing | Security | Implement bcrypt for all stored passwords/PINs to eliminate the current plain-text vulnerability |
| **Critical** | HTTPS/SSL Configuration | Security | Configure SSL certificate for production deployment to encrypt all data in transit |
| **High** | User Management UI | Usability | Build a frontend interface for admins to manage staff accounts without phpMyAdmin access |
| **High** | Automated Database Backup | Reliability | Implement scheduled mysqldump scripts with cloud sync to eliminate manual backup dependency |
| **High** | Offline POS Mode (PWA) | Availability | Implement Progressive Web App with IndexedDB caching for POS functionality during network outages |
| **High** | GCash/Maya API Integration | Automation | Integrate with GCash for Business and Maya Business APIs for automated digital payment verification |
| **Medium** | Mobile App (React Native) | Scalability | Develop a native mobile app for the Customer Portal and Rider Dashboard |
| **Medium** | Advanced Analytics | Analytics | Add profit margin analysis, inventory turnover rates, and demand forecasting |
| **Medium** | Customer Loyalty Program | Business | Implement a points-based loyalty system to encourage repeat purchases |
| **Medium** | SMS/Push Notifications | UX | Integrate SMS notifications (via Semaphore or Twilio) for delivery status updates |
| **Medium** | Automated Low-Stock Reordering | Automation | Automatically generate supplier purchase orders when stock falls below threshold |
| **Medium** | Multi-Store Franchise Management | Scalability | Extend the multi-branch architecture with branch-level reporting and centralized admin oversight |
| **Medium** | Barcode Scanner Hardware Integration | Efficiency | Integrate physical barcode scanner devices for faster POS product lookup |
| **Low** | AI-Powered Sales Forecasting | AI/ML | Use historical sales data to predict future demand and optimize stock levels |
| **Low** | Shopee/Lazada Integration | E-Commerce | Sync product catalog and inventory with popular e-commerce platforms |
| **Low** | Customer Reviews and Ratings | UX | Allow customers to rate products and deliveries for quality feedback |
| **Low** | Multi-Language Support | Accessibility | Add full Filipino language localization option throughout the system |
| **Low** | Automated Audit Logs | Security | Implement comprehensive audit logging for all admin actions with tamper-proof storage |

---

# 23. Appendix

## Appendix A: Screenshots
> 📷 **[Placeholder: Insert login screen screenshot]**  
> 📷 **[Placeholder: Insert POS terminal screenshot]**  
> 📷 **[Placeholder: Insert inventory management screenshot]**  
> 📷 **[Placeholder: Insert customer portal screenshot]**  
> 📷 **[Placeholder: Insert delivery tracking map screenshot]**  
> 📷 **[Placeholder: Insert branch analytics dashboard screenshot]**  
> 📷 **[Placeholder: Insert rider dashboard screenshot]**  
> 📷 **[Placeholder: Insert value-added services screenshot]**  
> 📷 **[Placeholder: Insert AI chatbot screenshot]**  

---

## Appendix B: Source Code Structure

```
silang-mini-mart/
├── server.ts                  # Main Express.js server entry point
├── package.json               # Project metadata and dependencies
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
├── .env                       # Base environment variables
├── .env.local                 # Local secrets (not committed to Git)
├── silang_mini_mart.sql       # Complete database schema and seed data
├── uploads/                   # Uploaded product images (auto-created)
│   ├── store-pictures/        # Customer store photos
│   └── variant-images/        # Product variant images
├── dist/                      # Production build output (auto-generated)
└── src/
    ├── main.tsx               # React SPA entry point
    ├── App.tsx                # Root React component (main application logic)
    ├── types.ts               # TypeScript type/interface definitions
    ├── index.css              # Global CSS styles
    ├── initialData.ts         # Initial seed data reference
    ├── components/            # React UI components
    │   ├── LoginView.tsx          # Login screen
    │   ├── POSView.tsx            # Point-of-Sale terminal
    │   ├── InventoryView.tsx      # Inventory management
    │   ├── CustomerPortal.tsx     # Customer online portal
    │   ├── DeliveryTracker.tsx    # Delivery management (admin)
    │   ├── DeliveryMap.tsx        # Interactive Leaflet delivery map
    │   ├── RiderDashboard.tsx     # Rider delivery dashboard
    │   ├── BranchAnalytics.tsx    # Sales analytics dashboard
    │   ├── BranchManagerPanel.tsx # Branch management panel
    │   ├── ValueAddedServices.tsx # E-Load, Bills, Remittance
    │   ├── AIAssistant.tsx        # AI chatbot component
    │   ├── SystemNotificationToast.tsx # In-app notifications
    │   └── InventoryVariantImagesFields.tsx # Variant image upload
    ├── routes/                # Express.js API route handlers
    │   ├── api.ts             # Main API router (mounts all sub-routers)
    │   ├── auth.ts            # Authentication routes
    │   ├── products.ts        # Product CRUD routes
    │   ├── pos.ts             # POS transaction routes
    │   ├── deliveries.ts      # Delivery management routes
    │   ├── customers.ts       # Customer profile routes
    │   ├── services.ts        # VAS transaction routes
    │   ├── branches.ts        # Branch management routes
    │   ├── inventory.ts       # Stock adjustment routes
    │   ├── notifications.ts   # System notification routes
    │   ├── settings.ts        # System settings routes
    │   └── supplierDeliveries.ts # Supplier delivery routes
    ├── db/
    │   └── mysql.ts           # MySQL2 connection pool and migrations
    ├── utils/
    │   ├── authHelper.ts      # JWT token generation
    │   ├── authMiddleware.ts  # JWT validation and rate limiter middleware
    │   ├── branchUtils.ts     # Branch name validation helper
    │   ├── productUtils.ts    # Product-related utility functions
    │   └── routeUtils.ts      # Shared route utility functions
    └── types/                 # Additional TypeScript type definitions
```

---

## Appendix C: Database Schema Summary

The `silang_mini_mart` database contains **16 tables** (including those from the SQL schema):

| Table | Records (at documentation date) |
|---|---|
| `branches` | 1 |
| `users` | 5 (2 cashiers, 1 admin, 2 riders) |
| `customers` | 2 |
| `customer_delivery_addresses` | 2 |
| `products` | 1 (demo; expand as needed) |
| `product_stock` | 1 |
| `product_variants` | 4 (Retail, Pack, Box, Wholesale) |
| `deliveries` | 3 (sample orders) |
| `delivery_items` | 6 |
| `orders_transactions` | 1 |
| `orders_transaction_items` | 2 |
| `service_transactions` | 0 |
| `supplier_deliveries` | 0 |
| `supplier_delivery_items` | 0 |
| `system_notifications` | 0 |
| `system_settings` | 1 (categories configuration) |

> 📋 **[Placeholder: Insert full ER diagram image]**

---

## Appendix D: Sample Reports

> 📋 **[Placeholder: Insert sample daily sales report printout]**  
> 📋 **[Placeholder: Insert sample transaction receipt PDF]**  
> 📋 **[Placeholder: Insert sample inventory status report]**  

---

## Appendix E: Configuration Files

### `.env.local` Template
```env
GEMINI_API_KEY=your_gemini_api_key_here
APP_URL=http://localhost:3000
```

### `system_settings` — Default Categories
```json
[
  "Rice & Grains",
  "Canned Goods",
  "Noodles & Instant",
  "Milk & Dairy",
  "Bread & Bakery",
  "Beverages",
  "Snacks",
  "Toiletries",
  "Household",
  "Other"
]
```

---

## Appendix F: User Acceptance Testing Form Template

**Project:** Silang Mini Mart POS & Delivery Management System  
**Tester Name:** ___________________________  
**Role:** ___________________________  
**Date Tested:** ___________________________

| Test Case ID | Feature Tested | Steps Performed | Pass / Fail | Remarks |
|---|---|---|---|---|
| UAT-001 | Login | | | |
| UAT-002 | POS Transaction | | | |
| UAT-003 | Customer Order | | | |
| UAT-004 | Delivery Tracking | | | |
| UAT-005 | Inventory Management | | | |
| UAT-006 | Branch Analytics | | | |
| UAT-007 | VAS (E-Load) | | | |

**Overall Assessment:** ☐ Accepted  ☐ Accepted with Minor Revisions  ☐ Rejected

**Tester Signature:** ___________________________  
**Date:** ___________________________

---

*End of Document*

---
**Document Control:**  
Version 1.0 | July 11, 2026 | Silang Mini Mart System Documentation  
*This document is subject to revision as the system evolves. All updates should be recorded in the document version history.*
