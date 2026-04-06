# Seed Data Date Ranges

## Transaction Dates (Updated for 2026)

All seeded transactions are dated in **December 2025 - February 2026** to ensure they appear in current reports.

### Purchase Transactions
- **PO-0001 & PI-0001**: Dec 15-22, 2025 (Samsung products)
- **PO-0002 & PI-0002**: Jan 5-10, 2026 (Apple products)
- **PO-0003 & PI-0003**: Jan 8-16, 2026 (Lenovo products)
- **PO-0004 & PI-0004**: Jan 12-20, 2026 (Dell products)

### Sales Transactions
- **SO-0001 & INV-0001**: Jan 20-22, 2026 (Tech Solutions)
- **SO-0002 & INV-0002**: Jan 23-25, 2026 (Digital World)
- **SO-0003 & INV-0003**: Jan 26-27, 2026 (Retail Hub)
- **SO-0004 & INV-0004**: Jan 28-30, 2026 (Smart Electronics - Partial)
- **INV-0005**: Feb 1, 2026 (Direct invoice - Tech Solutions)

### Returns
- **SR-0001**: Feb 2, 2026 (Sales Return)
- **PR-0001**: Jan 25, 2026 (Purchase Return)

### Stock Adjustments
- **SJ-0001**: Feb 3, 2026 (Damage adjustment)

### Opening Balances
- **All Opening Balances**: Dec 31, 2025

## Report Date Filters to Use

To see all seeded data in reports, use these date ranges:

### Sales Register
- **Start Date**: `2026-01-01`
- **End Date**: `2026-02-28`
- **Expected Results**: 5 invoices totaling ₹16.18L

### Purchase Register
- **Start Date**: `2025-12-01`
- **End Date**: `2026-02-28`
- **Expected Results**: 4 invoices totaling ₹38.74L

### Outstanding Report
- **No date filter needed** - Shows all unpaid/partial invoices
- **Expected Results**:
  - INV-0001: ₹1,78,339 outstanding (Tech Solutions)
  - INV-0003: ₹2,17,109 outstanding (Retail Hub)
  - INV-0004: ₹1,06,812 outstanding (Smart Electronics)

## Financial Summary (As of Feb 6, 2026)

### Purchases
- **Total Purchased**: ₹38.74L
- **Paid to Vendors**: ₹10.5L
- **Outstanding Payable**: ₹28.24L

### Sales
- **Total Sales**: ₹16.18L
- **Received from Customers**: ₹10.62L
- **Outstanding Receivable**: ₹5.55L

### Net Position
- **Cash Out (Purchases - Vendor Payments)**: -₹28.24L
- **Cash In (Sales - Customer Receipts)**: -₹5.55L
- **Working Capital Required**: ₹22.69L
