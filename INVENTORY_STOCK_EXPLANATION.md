# Inventory Stock Issue Explanation & Solution

## The Problem
You see **100 stock** in the items section, but when creating an invoice from a sales order, it shows **0 available stock**.

## Why This Happens

The inventory system uses a **Virtual Counter System** with three key values:

1. **Physical Stock**: 100 (actual warehouse inventory)
2. **Reserved Quantity**: 100 (stock reserved by open sales orders)  
3. **Available Stock**: 0 (calculated as: Physical Stock - Reserved Quantity = 100 - 100 = 0)

### The Flow:
1. **When you create a sales order** with 100 units:
   - System reserves 100 units by incrementing `reservedQuantity`
   - Physical stock remains 100, but available stock becomes 0
   - The order shows as "Available" initially, but subsequent orders will show "Unavailable"

2. **When you try to create an invoice**:
   - System checks if there's enough physical stock for the order
   - Since all 100 units are reserved by the sales order itself, there's effectively 0 available for new operations

## The Solution

### 1. **Enhanced Stock Display**
The items page now shows:
- **Total**: Physical stock (100)
- **Reserved**: Stock reserved by orders (100) 
- **Available**: Stock available for new orders (0) - shown in red when 0

### 2. **View Reservations Feature**
- Click the "View Reservations" button on items with reserved stock
- See exactly which sales orders are reserving your stock
- Get detailed breakdown of reservations per order

### 3. **How to Free Up Reserved Stock**

You have two options:

**Option A: Create Invoice (Recommended)**
- Go to Sales Orders page
- Find the order reserving the stock
- Click "Create Invoice" 
- This will:
  - Deduct 100 from physical stock (100 → 0)
  - Release 100 from reserved quantity (100 → 0)
  - Available stock remains 0, but the order is fulfilled

**Option B: Cancel/Reject the Order**
- Go to Sales Orders page  
- Find the order reserving the stock
- Change status to "Rejected" or delete the order
- This will:
  - Release 100 from reserved quantity (100 → 0)
  - Physical stock remains 100
  - Available stock becomes 100

## Key Points to Remember

1. **Physical Stock** = What's actually in your warehouse
2. **Reserved Quantity** = What's promised to customers via sales orders
3. **Available Stock** = What you can promise to new customers
4. **Sales orders reserve stock immediately** when created
5. **Invoices consume physical stock** and release reservations
6. **Rejected/deleted orders release reservations** without consuming stock

## Files Modified
- `smart-inventory/src/app/masters/items/page.tsx` - Enhanced stock display
- `smart-inventory/src/app/api/items/[id]/reservations/route.ts` - New API endpoint

## Quick Fix for Your Current Situation
1. Go to Sales Orders page
2. Find the order that's reserving your 100 units
3. Either create an invoice from it (if you want to fulfill the order) or reject/delete it (if you want to free up the stock)
4. The stock will then be available for new operations