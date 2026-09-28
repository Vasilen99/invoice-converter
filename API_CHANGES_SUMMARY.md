# Payment API Rework Summary

## Overview
Both payment APIs have been reworked to handle **one-time credit purchases** instead of subscriptions. The implementation now properly integrates with the Stripe API v2026-08-26.dahlia and updates the account credit balance via database transactions.

## Changes Made

### 1. Payment Session API (`src/app/api/payment/session/route.ts`)

#### Key Changes:
- **Removed subscription mode** - Changed from `mode: "subscription"` to `mode: "payment"` for one-time purchases
- **Updated metadata structure** - Now includes:
  - `account_id`: The user's account ID (for credit update)
  - `package_id`: The credit package being purchased
  - `credits_amount`: Number of credits to add
  - `user_id`: The user who made the purchase
- **Improved error handling** - Added comprehensive validation and error responses
- **Simplified product creation** - Uses inline `product_data` instead of external product IDs

#### Request Payload:
```typescript
{
  data: {
    package_id: number;        // Your CreditPackage ID
    price: number;             // Price amount (will be multiplied by 100 for cents)
    credits_amount: number;    // Number of credits to purchase
    currency?: string;         // Optional, defaults to "eur"
  }
}
```

#### Response:
```typescript
{
  data: {
    url: string;      // Stripe checkout URL
    sessionId: string; // Checkout session ID
  }
}
```

### 2. Webhook Handler (`src/app/api/webhook/route.ts`)

#### Key Changes:
- **Removed subscription events** - No longer handles:
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`

- **Added charge events** - Now handles:
  - `charge.succeeded` - When payment is successful
  - `charge.failed` - When payment fails

#### `charge.succeeded` Flow:
1. Retrieves payment intent metadata with account/credit info
2. Gets current account credit balance
3. **Updates account creditBalance** with new purchased credits
4. **Creates CreditTransaction record** with type `PURCHASE`
5. Updates Order status to `PAID`

#### `charge.failed` Flow:
1. Retrieves payment intent metadata
2. Updates related Order status to `FAILED`

#### Database Operations:

**Account Update:**
```typescript
// creditBalance is incremented by credits_amount
await prisma.account.update({
  where: { id: accountId },
  data: { creditBalance: newBalance }
});
```

**Credit Transaction:**
```typescript
await prisma.creditTransaction.create({
  data: {
    type: "PURCHASE",           // CreditTransactionType.PURCHASE
    amount: creditsAmount,       // Credits purchased
    balanceAfter: newBalance,    // New account balance
    note: `Purchased ${creditsAmount} credits from package ${packageId}`,
    accountId: accountId,
    consumedByUserId: userId     // Optional
  }
});
```

## Database Schema Usage

### Account Model
- `creditBalance`: Updated with purchased credits (incremented)

### CreditTransaction Model
- Records all credit purchases with type `PURCHASE`
- Tracks balance changes for audit trail
- Links user, account, and order information

### Order Model
- Status updated from `PENDING` to `PAID` on successful charge
- Status updated to `FAILED` on failed charge

## Configuration Requirements

Ensure your Stripe webhook is configured to listen for:
- `charge.succeeded`
- `charge.failed`

## Error Handling

Both endpoints include comprehensive error handling:
- Missing authentication → 401 Unauthorized
- Missing account → 404 Not Found
- Invalid request payload → 400 Bad Request
- Server errors → 500 Internal Server Error

All errors are logged with descriptive console messages for debugging.

## Flow Diagram

```
User → POST /api/payment/session
        ↓
   Create Checkout Session (mode: "payment")
   Metadata: account_id, package_id, credits_amount, user_id
        ↓
   Return Stripe checkout URL
        ↓
User → Stripe Checkout Page → Complete Payment
        ↓
Stripe → Webhook: charge.succeeded
        ↓
   Update Account.creditBalance += credits_amount
   Create CreditTransaction (type: PURCHASE)
   Update Order.status = PAID
        ↓
✅ Credits Available in Account
```

## Testing Checklist

- [ ] POST to `/api/payment/session` with valid payload
- [ ] Verify checkout URL is generated
- [ ] Complete payment in Stripe test mode
- [ ] Verify `charge.succeeded` webhook is received
- [ ] Check Account.creditBalance is updated correctly
- [ ] Verify CreditTransaction record is created
- [ ] Test payment failure scenario
- [ ] Verify Order.status is updated to FAILED
- [ ] Check error handling with invalid payloads

## Breaking Changes

- No longer supports subscription-based billing
- Webhook events changed from subscription to charge events
- Removed dependency on BookAService-specific database models
- Simplified metadata structure for better maintainability
