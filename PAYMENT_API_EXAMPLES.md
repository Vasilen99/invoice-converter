# Payment API Implementation Examples

## Frontend Integration

### Initiating a Purchase

```typescript
// Example: User selecting a credit package
const creditPackages = [
  { id: 1, credits: 100, price: 29.99, name: "Starter" },
  { id: 2, credits: 500, price: 129.99, name: "Professional" },
  { id: 3, credits: 1000, price: 249.99, name: "Enterprise" },
];

async function handlePurchaseClick(package: typeof creditPackages[0]) {
  try {
    const response = await fetch("/api/payment/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          package_id: package.id,
          price: package.price,
          credits_amount: package.credits,
          currency: "eur",
        },
      }),
    });

    const result = await response.json();

    if (!result.data?.url) {
      // Handle error
      console.error("Failed to create checkout session", result.alert);
      return;
    }

    // Redirect to Stripe checkout
    window.location.href = result.data.url;
  } catch (error) {
    console.error("Purchase failed:", error);
  }
}
```

### Handling Success/Failure Redirects

```typescript
// On /poluchavane-na-plan page
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function PaymentResultPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (status === "success") {
      // Payment succeeded - webhook should have processed it
      console.log("Payment successful!", sessionId);
      // Show success message, refresh credits display, redirect
    } else if (status === "cancelled") {
      // User cancelled payment
      console.log("Payment cancelled");
      // Show message to try again
    }
  }, [status, sessionId]);

  return (
    <div>
      {status === "success" && (
        <div className="success-alert">
          <h1>✅ Payment Successful!</h1>
          <p>Your credits will be available shortly.</p>
        </div>
      )}
      {status === "cancelled" && (
        <div className="warning-alert">
          <h1>Payment Cancelled</h1>
          <p>Your payment was cancelled. No charges were made.</p>
        </div>
      )}
    </div>
  );
}
```

## Backend Integration

### Verifying Payment in Your Services

```typescript
// In your invoice processing service
import { prisma } from "@/utility/prisma";

async function processInvoiceWithCreditDeduction(
  accountId: number,
  creditsCost: number
) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { creditBalance: true },
  });

  if (!account || account.creditBalance < creditsCost) {
    throw new Error("Insufficient credits");
  }

  // Deduct credits (in your invoice processing flow)
  const newBalance = account.creditBalance - creditsCost;

  await prisma.account.update({
    where: { id: accountId },
    data: { creditBalance: newBalance },
  });

  // Record consumption transaction
  await prisma.creditTransaction.create({
    data: {
      type: "CONSUMPTION",
      amount: creditsCost,
      balanceAfter: newBalance,
      note: "Invoice processing",
      accountId: accountId,
    },
  });
}
```

### Getting User Account Credit Balance

```typescript
import { prisma } from "@/utility/prisma";

async function getUserCredits(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountMembers: {
        select: {
          account: {
            select: {
              id: true,
              creditBalance: true,
            },
          },
        },
      },
    },
  });

  return user?.accountMembers[0]?.account.creditBalance ?? 0;
}
```

### Querying Credit Transaction History

```typescript
async function getCreditTransactionHistory(
  accountId: number,
  limit = 50
) {
  return prisma.creditTransaction.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      balanceAfter: true,
      note: true,
      createdAt: true,
    },
  });
}
```

## Stripe Configuration

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### Webhook Setup in Stripe Dashboard

1. Go to Developers → Webhooks
2. Add endpoint with your webhook URL: `https://your-domain.com/api/webhook`
3. Select events to listen for:
   - `charge.succeeded`
   - `charge.failed`
4. Copy the webhook secret and add to environment variables

## Error Scenarios & Responses

### Missing Authentication
```json
{
  "data": null,
  "alert": {
    "status": "error",
    "header": "Невалидна сесия",
    "message": "Трябва да сте влязли за да продължите"
  }
}
```

### Missing Account
```json
{
  "data": null,
  "alert": {
    "status": "error",
    "header": "Грешка при намиране на акаунт",
    "message": "Не може да се намери вашия акаунт"
  }
}
```

### Server Error
```json
{
  "data": null,
  "alert": {
    "status": "error",
    "header": "Сървърна грешка",
    "message": "Error message here"
  }
}
```

## Database Audit Trail

### View Credit Transactions for an Account

```sql
-- PostgreSQL
SELECT 
  id,
  type,
  amount,
  "balanceAfter",
  note,
  "createdAt"
FROM "CreditTransaction"
WHERE "accountId" = $1
ORDER BY "createdAt" DESC
LIMIT 50;
```

### Track Purchase History

```sql
-- Find all PURCHASE transactions
SELECT 
  ct.id,
  ct.amount as credits_purchased,
  ct."balanceAfter",
  ct."createdAt",
  o.id as order_id,
  o.status
FROM "CreditTransaction" ct
LEFT JOIN "Order" o ON ct.id = o.id
WHERE ct.type = 'PURCHASE'
ORDER BY ct."createdAt" DESC;
```

## Monitoring & Debugging

### Enable Request Logging

Add this middleware to capture payment API calls:

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/payment")) {
    console.log("Payment Request:", {
      method: request.method,
      url: request.nextUrl.pathname,
      timestamp: new Date().toISOString(),
    });
  }
  return NextResponse.next();
}
```

### Webhook Event Verification

```typescript
// Log all webhook events in development
if (process.env.NODE_ENV === "development") {
  console.log("Webhook Event Received:", {
    type: event.type,
    id: event.id,
    timestamp: new Date(event.created * 1000),
  });
}
```

## Common Issues & Solutions

### Issue: Credits not updating after payment
**Solution:** Verify:
1. Webhook secret is correct in environment variables
2. Webhook events are being received (check Stripe dashboard logs)
3. Database connection is working
4. Check server logs for error messages

### Issue: Duplicate credit transactions
**Solution:** Stripe may retry failed webhooks. Add idempotency check:

```typescript
const existingTransaction = await prisma.creditTransaction.findFirst({
  where: {
    note: `Purchased ${creditsAmount} credits from package ${packageId}`,
    createdAt: { gte: new Date(Date.now() - 60000) }, // Within last minute
  },
});

if (existingTransaction) {
  console.log("Duplicate webhook, skipping");
  break;
}
```

### Issue: Webhook not being received
**Solution:**
1. Verify webhook URL is publicly accessible
2. Check webhook secret matches in Stripe & environment
3. Review Stripe webhook logs for failed attempts
4. Ensure POST handler is correctly defined in route.ts
