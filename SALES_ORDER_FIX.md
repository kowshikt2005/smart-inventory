# Sales Order Cache Fix

## Problem
When creating a new sales order, it would only appear in the "Open" section but not in the "All Orders" section until the page was manually refreshed.

## Root Cause
The issue was caused by SWR (Stale-While-Revalidate) cache not being invalidated after creating a new order. The new order creation page would redirect to the orders list page without clearing the cached data, so the list would show stale data that didn't include the newly created order.

## Solution
Added cache invalidation using SWR's `mutate` function in the new order creation page (`smart-inventory/src/app/sales/orders/new/page.tsx`):

1. **Import mutate**: Added `import { mutate } from "swr"`
2. **Cache invalidation**: Added cache invalidation after successful order creation:
   ```typescript
   // Invalidate sales orders cache to show the new order
   mutate(key => typeof key === 'string' && key.includes('/api/sales-orders'), undefined, { revalidate: true });
   ```

## Technical Details
- The cache invalidation pattern matches all API calls to `/api/sales-orders` regardless of query parameters
- This ensures both "All Orders" and filtered views (Open, Hold, etc.) are refreshed
- The fix is applied in both success paths: normal creation and force creation (when stock warnings are overridden)

## Files Modified
- `smart-inventory/src/app/sales/orders/new/page.tsx`

## Verification
After the fix:
1. Create a new sales order
2. The order should immediately appear in both "All Orders" and "Open" sections
3. No manual page refresh should be required

## Related
The orders list page already had proper cache invalidation for other operations like status changes and deletions, so this fix brings consistency to all order operations.