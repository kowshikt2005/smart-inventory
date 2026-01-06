# Product Requirements Document (PRD)
## Smart Inventory & Business Management System

---

## 1. Product Overview

### 1.1 Product Name (Working Title)
**Smart Inventory & Business Management System**

### 1.2 Purpose
The product is a comprehensive, GST-compliant business management system designed to handle **customer onboarding with GST validation, sales order processing, real-time inventory management, invoice generation, payment tracking, returns processing, and business intelligence** in a unified workflow. It targets small to mid-sized businesses operating in GST-compliant environments (India-focused).

The system emphasizes **automated workflows, real-time stock management, credit validation, and role-based operations** while maintaining flexibility for business-specific requirements and manual overrides where necessary.

---

## 2. Target Users & Roles

### 2.1 User Roles

| Role | Responsibilities |
|------|-----------------|
| **Salesman** | Customer inquiries, quotation creation, order processing, payment follow-up |
| **Billing Operator** | Invoice generation, receipt processing, customer communication, document management |
| **Accountant** | Payment processing, ledger management, bank reconciliation, financial reporting |
| **Manager** | Approval processes, report analysis, strategic decisions, performance review |

Each role has **restricted access** based on responsibilities with specific workflow permissions.
Each user can also support multiple roles 
---

## 3. Technology Stack

### 3.1 Frontend Framework
- **Next.js 15 (App Router)** - Modern React framework with SSR/SSG capabilities
- **React 19** - Latest React with concurrent features
- **TypeScript 5** - Type safety and better developer experience
- **Tailwind CSS 4** - Utility-first CSS framework for rapid UI development

### 3.2 Backend & API
- **Next.js API Routes** - Built-in API endpoints with TypeScript
- **Server Actions** - Direct server-side functions for form handling
- **Middleware** - Authentication and request processing

### 3.3 Database & ORM
- **Microsoft SQL Server** - Primary relational database
- **Prisma ORM** - Type-safe database client with SQL Server support
- **T-SQL** - Stored procedures and complex business logic
- **SQL Server Management Studio (SSMS)** - Database administration

### 3.4 Authentication & Security
- **NextAuth.js v5** - Complete authentication solution
- **JWT Tokens** - Secure token-based authentication
- **bcrypt** - Password hashing
- **CORS & Rate Limiting** - API security

### 3.5 State Management
- **Zustand** - Lightweight state management
- **React Query/TanStack Query** - Server state management and caching
- **React Hook Form** - Form state management with validation

### 3.6 Validation & Schema
- **Zod** - Runtime type validation and schema validation
- **React Hook Form + Zod** - Form validation integration

### 3.7 UI Components & Design
- **Radix UI** - Headless UI components
- **Lucide React** - Modern icon library
- **Recharts** - Charts and data visualization
- **React PDF** - PDF generation for invoices and reports

### 3.8 File Handling & Storage
- **Cloudinary/AWS S3** - File upload and storage
- **Multer** - File upload handling
- **Sharp** - Image processing

### 3.9 External Integrations
- **GST API Integration** - Government GST validation service
- **Email Service** - Nodemailer with SMTP/SendGrid
- **SMS Gateway** - Twilio for notifications
- **Payment Gateway** - Razorpay/Stripe for online payments

### 3.10 Development Tools
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting
- **Husky** - Git hooks for code quality
- **Jest + Testing Library** - Unit and integration testing
- **Playwright** - End-to-end testing

### 3.11 Deployment & DevOps
- **Vercel** - Primary deployment platform (optimized for Next.js)
- **Docker** - Containerization for consistent environments
- **GitHub Actions** - CI/CD pipeline
- **Vercel Analytics** - Performance monitoring

### 3.12 Monitoring & Analytics
- **Sentry** - Error tracking and monitoring
- **Vercel Analytics** - Web analytics
- **LogRocket** - Session replay and debugging

### 3.13 Additional Libraries
- **date-fns** - Date manipulation and formatting
- **decimal.js** - Precise decimal calculations for financial data
- **uuid** - Unique ID generation
- **lodash** - Utility functions
- **@react-pdf/renderer** - PDF generation
- **csv-parser** - CSV file processing
- **xlsx** - Excel file handling

---

## 4. Functional Scope (Module-wise)

## 4.1 Customer Onboarding & Management

### Objective
Create and manage customers with **GST validation, automated data population, pricing control, and credit configuration**.

### Functional Requirements

#### FR-1: Customer Inquiry Handling
- System shall allow recording customer inquiries
- System shall check if customer already exists using:
  - Name matching
  - Phone number verification
  - GSTIN lookup
- If existing customer found, load customer profile with credit status and purchase history
- **Note**: Customers do not directly interact with the software system

#### FR-2: New Customer Creation Process
- Collect mandatory basic information:
  - Customer name
  - Phone number
  - Email address
- Capture 15-digit GSTIN (Format: 22AAAAA0000A1Z5)
-ADDRESS
-

#### FR-3: GST Lookup Service Integration (External Service)
- Validate GSTIN format automatically
- Fetch company details from government GST database
- Auto-populate customer information:
  - Legal company name
  - Registered address
  - State and city information
- Handle validation errors and manual override options

#### FR-4: Customer Profile Completion
- Allow user to verify and complete auto-populated details
- Configure customer-specific settings:
  - Credit limit amount
  - Credit days allowed
  - Opening balance (if any)
- System must validate all credit-related fields

#### FR-5: Rate Sheet Configuration
- Provide option to create customer-specific pricing
- Rate sheet configuration includes:
  - Item-wise custom pricing
  - Discount rules and percentages
  - Validity dates for pricing
  - Special terms and conditions
- Default to standard pricing if custom rate sheet is skipped

#### FR-6: Customer Record Finalization
- Generate unique customer ID (customer-xxxx format)
- Set customer status as Active/Inactive
- Store registration date and user who created record
- Make customer available for sales order processing

---

## 4.2 Sales Order Management

### Objective
Create and manage sales orders with **four-state workflow, virtual inventory counter synchronization, and credit validation**.

### Functional Requirements

#### FR-7: Sales Quotation Creation
- Allow item selection from product catalog
- Calculate pricing using:
  - Customer-specific rate sheet (if available)
  - Standard pricing (fallback)
- Perform automatic tax computation based on GST rules
- Generate quotation with all line items and totals

#### FR-8: Sales Order Generation
- Generate unique Sales Order number (SO-xxxx format)
- Capture order date and requested delivery date
- Create sales order from quotation or direct entry
- Lock in pricing and terms at time of order creation

#### FR-9: Sales Order State Management
- System shall manage sales orders in four distinct states:
  - **OPEN** - Order created and awaiting processing
  - **DELIVER** - Order ready for delivery/fulfillment
  - **HOLD** - Order paused (credit issues, stock shortage, etc.)
  - **REJECT** - Order cancelled or rejected
- State transitions must be tracked with timestamp and user information
- Only authorized users can change order states

#### FR-10: Virtual Inventory Counter System
- Maintain real-time virtual counter for all inventory items
- **When Sales Order is created (OPEN state)**:
  - Deduct ordered quantities from virtual available stock
  - Update virtual counter: `virtual_available = physical_stock - reserved_quantity`
  - Reserve stock for the order without affecting physical inventory
- **Virtual counter synchronization**:
  - Must remain in sync with physical inventory at all times
  - Real-time updates across all system modules
  - Prevent over-selling through virtual counter validation

#### FR-11: Customer Credit Validation
- System shall validate before order processing:
  - Current outstanding balance
  - Configured credit limit
  - Credit days compliance
  - Payment history and behavior
- If credit validation fails → Order status: "HOLD"

#### FR-12: Manager Approval for Hold Orders
- Route held orders to Manager for approval
- Manager can approve (change to OPEN) or reject orders
- Maintain approval logs with timestamp and reasoning
- Send internal notifications to relevant stakeholders

#### FR-13: Order Item Processing & Virtual Counter Updates
- Process each line item in the sales order
- Check virtual stock availability for required quantities
- Apply customer rate sheet pricing or standard pricing
- Calculate final amounts including taxes and discounts
- Update virtual counters immediately upon order state changes

#### FR-14: Invoice Creation Trigger
- **When invoice is created from OPEN/DELIVER order**:
  - Automatically change order status to "DELIVERED"
  - Convert reserved quantities to actual sales
  - Update physical inventory: `physical_stock = physical_stock - sold_quantity`
  - Adjust virtual counter: `virtual_available = physical_stock - remaining_reserved`
  - Release reserved stock allocation for the order

---

## 4.3 Inventory & Stock Management

### Objective
Ensure **real-time stock accuracy, virtual counter synchronization, and prevent over-selling** through automated monitoring.

### Functional Requirements

#### FR-15: Real-time Stock & Virtual Counter Management
- Maintain two-tier inventory system:
  - **Physical Stock**: Actual inventory in warehouse
  - **Virtual Available Stock**: Physical stock minus all reservations
- Display current stock levels and virtual available quantities
- Generate minimum stock alerts when virtual available stock is low
- Provide stock status visibility across the system

#### FR-16: Stock Reservation & Virtual Counter Updates
- **Upon Sales Order Creation (OPEN state)**:
  - Reserve stock quantities automatically
  - Update virtual counter: `virtual_available -= ordered_quantity`
  - Maintain reservation until order is delivered or cancelled
- **Virtual counter must always reflect**:
  - `virtual_available = physical_stock - total_reserved_quantities`

#### FR-17: Insufficient Virtual Stock Handling
- Check virtual available stock before allowing order creation
- Prevent order creation if virtual stock is insufficient
- Display available quantity and expected restock date
- Provide alternative product suggestions if available

#### FR-18: Automated Reorder Management
- Generate reorder alerts based on virtual available stock levels
- Analyze sales velocity for intelligent reorder suggestions
- Support manual stock replenishment processes
- Track reorder history and supplier performance

#### FR-19: Manual Stock Updates & Virtual Counter Sync
- Allow authorized users to perform manual stock additions
- Create stock journal entries (SJ-xxxx format) for all adjustments
- **Upon physical stock update**:
  - Update physical inventory immediately
  - Recalculate virtual counter: `virtual_available = new_physical_stock - reserved_quantities`
  - Maintain audit trail for all stock movements

#### FR-20: Order State Changes & Virtual Counter Impact
- **OPEN → DELIVER**: No virtual counter change (already reserved)
- **OPEN → HOLD**: Maintain reservation and virtual counter
- **OPEN → REJECT**: Release reservation, increase virtual counter
- **HOLD → OPEN**: Maintain existing reservation
- **HOLD → REJECT**: Release reservation, increase virtual counter
- **Any State → DELIVERED (via Invoice)**: Convert reservation to sale, update physical stock

#### FR-21: Virtual Counter Synchronization Monitoring
- Continuous monitoring of virtual counter accuracy
- Automated reconciliation processes
- Alert system for virtual/physical stock discrepancies
- Real-time synchronization across all system modules

---

## 4.4 Sales Fulfillment & Invoice Processing

### Objective
Convert sales orders into **legally compliant GST invoices** and update inventory systems accordingly.

### Functional Requirements

#### FR-22: Invoice Creation from Sales Orders
- Generate invoices only from sales orders in OPEN or DELIVER state
- Generate unique invoice number (INV-xxxx format)
- Perform final tax calculations based on current GST rates
- Calculate due date based on customer credit terms
- Include all required GST compliance fields

#### FR-23: Invoice Processing & Inventory Updates
- Generate PDF invoice with company branding
- **Internal Distribution Only**: No direct customer email interaction
- **Automatic Sales Order State Change**:
  - Change order status from OPEN/DELIVER to "DELIVERED"
  - Update order completion timestamp
- **Physical Inventory Updates**:
  - Deduct sold quantities from physical stock
  - `physical_stock = physical_stock - invoiced_quantity`
- **Virtual Counter Synchronization**:
  - Release reserved stock allocation
  - Recalculate virtual available: `virtual_available = new_physical_stock - remaining_reservations`
- Create accounting entries for sales recording
- Update customer ledger with invoice amount

---

## 4.5 Purchase Management

### Objective
Manage supplier relationships, purchase orders, and goods receipt to maintain optimal inventory levels and cost control.

### Functional Requirements

#### FR-24: Supplier Management
- Maintain comprehensive supplier database with:
  - Supplier name, contact details, GSTIN
  - Payment terms and credit periods
  - Product catalog and pricing
  - Performance ratings and history
- Track supplier performance metrics:
  - Delivery timeliness
  - Quality ratings
  - Price competitiveness
  - Payment compliance

#### FR-25: Purchase Order Creation
- Generate purchase orders from:
  - Automatic reorder alerts (when stock falls below minimum)
  - Manual purchase requests
  - Sales demand forecasting
- Generate unique PO number (PO-xxxx format)
- Include all required details:
  - Supplier information
  - Item specifications and quantities
  - Agreed pricing and terms
  - Expected delivery dates

#### FR-26: Purchase Order Approval Workflow
- Route purchase orders for approval based on amount thresholds:
  - Manager approval for orders above defined limits
  - Auto-approval for routine reorders within limits
- Maintain approval audit trail
- Send PO to suppliers upon approval

#### FR-27: Goods Receipt Processing
- Record goods received against purchase orders
- Support partial receipts and multiple deliveries
- Quality inspection workflow:
  - Accept goods (add to inventory)
  - Reject goods (return to supplier)
  - Partial acceptance with quality notes
- Generate Goods Receipt Note (GRN-xxxx format)

#### FR-28: Purchase Invoice Processing
- Match supplier invoices with:
  - Purchase orders
  - Goods receipt notes
  - Agreed pricing terms
- Three-way matching validation
- Handle price variances and discrepancies
- Route for approval if variances exceed tolerance

#### FR-29: Inventory Updates from Purchases
- **Upon Goods Receipt Acceptance**:
  - Increase physical stock: `physical_stock += received_quantity`
  - Update virtual counter: `virtual_available = new_physical_stock - reserved_quantities`
  - Update inventory valuation with purchase cost
  - Create stock movement entry (type: PURCHASE_IN)
- **Real-time synchronization** with sales order system
- Automatic evaluation of pending sales orders when stock increases

#### FR-30: Supplier Payment Management
- Track supplier invoices and payment due dates
- Generate payment schedules based on terms
- Record payments and update supplier ledger
- Maintain supplier outstanding balances
- Generate supplier aging reports

---

## 4.6 Payment & Financial Management

### Objective
Track payments accurately, update customer ledgers, and maintain **bank reconciliation** with comprehensive financial reporting.

### Functional Requirements

#### FR-31: Payment Receipt Processing
- Support multiple payment modes:
  - Cash receipts
  - Bank transfers
  - Cheque deposits
  - Digital payments
- Record payment date and reference details

#### FR-32: Receipt Generation
- Generate unique receipt number (RCP-xxxx format)
- Record amount received and bank account details
- Map payments to specific invoices
- Handle partial payments and advance receipts

#### FR-33: Customer Ledger Management
- Update customer ledger automatically upon payment
- Recalculate outstanding balance in real-time
- Maintain complete payment history
- Update customer credit status based on payments

#### FR-34: Bank Reconciliation
- Match receipts against bank statements
- Verify bank account balances
- Flag discrepancies for investigation
- Maintain reconciliation status and history

#### FR-35: Financial Reporting
- Generate comprehensive sales summaries
- Create collection reports and aging analysis
- Provide outstanding balance reports
- Support period-wise financial analysis

---

## 4.7 Returns & Adjustments

### Objective
Handle sales returns efficiently with **proper authorization, inventory impact, and financial adjustments**.

### Functional Requirements

#### FR-36: Sales Return Request Processing
- Capture customer return requests with details:
  - Return reason and justification
  - Item condition assessment
  - Return date and urgency
- Validate return eligibility against company policies

#### FR-37: Return Authorization Workflow
- Require Manager approval for all returns
- Check return policy compliance
- Generate unique return ID (SR-xxxx format)
- Set authorization date and approving manager

#### FR-38: Return Processing
- Process physical item receipt and inspection
- Conduct quality inspection of returned items
- Calculate refund amount or credit note value
- Create credit note documentation

#### FR-39: Inventory and Financial Adjustments
- Create stock journal entry (SJ-xxxx format) for returned items
- Increase stock levels for resalable items
- Adjust inventory valuation appropriately
- Credit customer account with return amount
- Update customer ledger and send credit note via email

---

## 4.8 Business Intelligence & Reporting

### Objective
Provide **real-time business insights, comprehensive reporting, and data-driven decision support** for management.

### Functional Requirements

#### FR-40: Data Aggregation Engine
- Aggregate data from all system modules:
  - Sales transactions and trends
  - **Purchase data and supplier performance**
  - Financial performance metrics
  - Inventory movement and valuation
  - Customer behavior and preferences
- Ensure real-time data synchronization

#### FR-41: Comprehensive Report Generation
- Generate detailed reports across all business areas:
  - Sales performance reports
  - **Purchase and supplier performance reports**
  - Financial statements and summaries
  - Stock movement and valuation reports
  - Customer analysis and segmentation reports
  - **Supplier analysis and payment reports**
- Support multiple output formats (PDF, Excel, CSV)

#### FR-42: Claim and Price Analysis
- Calculate price differences and variances
- Perform brand-wise claim analysis
- Generate claim amount summaries
- Provide period-wise claim analysis and trends

#### FR-43: Ledger Management System
- Maintain comprehensive ledger systems:
  - Customer ledger with transaction history
  - **Supplier ledger with purchase and payment history**
  - Bank ledger with reconciliation status
  - Item ledger with stock movements
  - Generate financial statements automatically

#### FR-44: Real-time Dashboard Updates
- Provide real-time business metrics and KPIs
- Track performance indicators continuously
- Generate automated alerts for critical situations
- Support mobile notifications for key stakeholders

#### FR-45: Management Insights & Analytics
- Deliver advanced business analytics
- Perform profitability analysis by product/customer
- Identify trends and patterns in business data
- Provide performance metrics for strategic decision making

---

## 5. Role-based Workflow Integration

### 5.1 Salesman Workflow
- Handle customer inquiries and onboarding
- Create quotations and process sales orders
- Follow up on pending approvals and payments
- Maintain customer relationships

### 5.2 Billing Operator Workflow
- Generate invoices from confirmed orders
- Process payment receipts and documentation
- Handle customer communication regarding billing
- Manage document distribution and filing

### 5.3 Accountant Workflow
- Process all payment transactions (customer and supplier)
- Maintain and reconcile ledger accounts
- Perform bank reconciliation activities
- Generate financial reports and statements
- **Manage supplier invoice processing and payments**
- **Handle purchase order approvals within authority limits**

### 5.4 Manager Workflow
- Approve credit holds and return requests
- **Approve purchase orders above threshold limits**
- Analyze business performance reports
- Make strategic decisions based on insights
- Review and monitor overall system performance
- **Supplier relationship management and negotiations**

---

## 6. Non-Functional Requirements

### 6.1 Performance
- Stock availability checks must complete within 2 seconds
- Credit validation must process within 1 second
- Real-time inventory updates across all modules
- Support for concurrent user operations

### 6.2 Security
- Role-based access control with granular permissions
- Audit logs for all critical business operations
- Data encryption for sensitive financial information
- Secure GST API integration with proper authentication

### 6.3 Compliance
- Full GST compliance for Indian tax regulations
- Proper invoice formatting and numbering
- Data retention policies for financial records
- Audit trail maintenance for regulatory requirements

### 6.4 Scalability
- Support for multiple branches (future enhancement)
- Multi-warehouse inventory management capability
- Scalable architecture for growing transaction volumes
- API-ready for third-party integrations

---

## 7. Technical Architecture

### 7.1 System Integration Points
- **GST Lookup Service**: External API for GSTIN validation
- **Email Service**: Automated document distribution
- **Bank Integration**: Future enhancement for direct bank feeds

### 7.2 Data Flow Architecture
- Real-time data synchronization across all modules
- Event-driven updates for inventory and financial changes
- **Virtual Counter Synchronization**: Continuous sync between physical inventory and virtual available stock
- **Sales Order State Management**: Four-state workflow (OPEN, DELIVER, HOLD, REJECT)
- Centralized data aggregation for reporting and analytics
- Automated workflow triggers based on business rules
- **Inventory-Invoice Integration**: Automatic inventory updates upon invoice creation

### 7.3 Database Design
- **Microsoft SQL Server** as primary database
- **Normalized schema** for data integrity
- **Stored procedures** for complex business logic including virtual counter management
- **Triggers** for automated data updates and inventory synchronization
- **Views** for reporting and analytics
- **Virtual Counter Tables**: Separate tracking for physical vs. virtual available inventory
- **Sales Order State Tracking**: Audit trail for all state changes

---

## 8. Implementation Phases

### Phase 1: Core Operations 
- Customer onboarding with GST validation
- Sales order management 
- Basic inventory management and stock reservation
- Invoice generation and payment processing

### Phase 2: Advanced Features 
- Returns and adjustments workflow
- Comprehensive reporting and analytics
- Advanced inventory management features
- Bank reconciliation and financial reporting

### Phase 3: Enhancement & Integration 
- Advanced business intelligence features
- Third-party system integrations
- Performance optimization and scaling

---

## 9. Success Metrics

### 9.1 Business Metrics
- 50% reduction in order processing time
- 30% improvement in inventory accuracy
- 25% reduction in credit-related issues
- 40% faster invoice generation

### 9.2 Technical Metrics
- 99.9% system uptime
- < 2 second average response time
- Zero data loss incidents
- 95% user satisfaction score

---

## 10. Assumptions & Constraints

- Single branch and single warehouse only (Phase 1)
- GST lookup is **mandatory** for all customers
- Partial invoicing is **not supported**
- Credit overrides require **Manager approval only**
- Web-only application (desktop-first)

---

## 11. Engineering & Development Guidelines

### 11.1 Coding Standards
- Strict TypeScript with no `any` types
- Component-based architecture with reusable UI components
- Comprehensive error handling and validation
- Unit and integration testing coverage > 80%

### 11.2 Folder Structure
```
/src
  /app
    /api
      /customers
      /orders
      /inventory
      /invoices
      /payments
      /suppliers
      /purchases
    /dashboard
    /customers
    /sales
    /inventory
    /purchases
    /suppliers
    /reports
    /settings
  /components
    /ui (Radix UI components)
    /forms
    /tables
    /charts
    /layout
  /lib
    /database (Prisma client)
    /auth (NextAuth config)
    /validations (Zod schemas)
    /utils
    /constants
  /types
  /hooks
  /services
    /gst-api
    /email
    /pdf-generator
```

### 11.3 Data Security & Compliance
- All sensitive data encrypted
- Audit logs for all critical operations
- Regular automated backups
- Compliance with industry standards

---

**End of PRD**