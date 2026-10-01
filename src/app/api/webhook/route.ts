import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/utility/prisma";
import { CREDIT_PRICING_CURRENCY } from "@/utility/credit-pricing";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-08-26.dahlia",
});

// Helper to get raw request body for Stripe signature verification
async function buffer(readable: ReadableStream<Uint8Array>): Promise<Buffer> {
  const arr = await new Response(readable).arrayBuffer();
  return Buffer.from(arr);
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("❌ Missing Stripe signature");
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req.body as ReadableStream<Uint8Array>);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch (err) {
    console.error("❌ Error verifying Stripe webhook signature:", err);
    return NextResponse.json(
      { error: `Webhook Error: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "charge.succeeded": {
        try {
          const charge = event.data.object as Stripe.Charge;

          if (!charge.payment_intent) {
            console.error("❌ Missing payment_intent in successful charge");
            break;
          }

          // Get the payment intent to access metadata
          const paymentIntent = await stripe.paymentIntents.retrieve(
            charge.payment_intent as string,
          );

          const orderIdRaw =
            paymentIntent.metadata.order_id ?? paymentIntent.metadata.orderId;

          if (!orderIdRaw) {
            console.error("❌ Missing order_id in charge succeeded event");
            break;
          }

          const orderIdNum = Number.parseInt(orderIdRaw, 10);

          if (Number.isNaN(orderIdNum)) {
            console.error("❌ Invalid order_id in charge succeeded event");
            break;
          }

          // Fetch Order as the single source of truth for amount and credits
          const order = await prisma.order.findUnique({
            where: { id: orderIdNum },
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              accountId: true,
              packageId: true,
            },
          });

          if (!order) {
            console.error(`❌ Order ${orderIdNum} not found`);
            break;
          }

          if (order.status === "PAID") {
            console.log(
              `ℹ️ Order ${orderIdNum} is already marked as PAID (idempotent)`,
            );
            break;
          }

          if (order.currency.toUpperCase() !== CREDIT_PRICING_CURRENCY) {
            console.error(`❌ Order currency mismatch: ${order.currency}`);
            break;
          }

          const orderAmount = Number.parseFloat(order.amount.toString());
          const chargeAmountInCents = charge.amount;
          const expectedChargeAmountInCents = Math.round(orderAmount * 100);

          if (chargeAmountInCents !== expectedChargeAmountInCents) {
            console.error(
              `❌ Charge amount mismatch. Expected ${expectedChargeAmountInCents}¢, got ${chargeAmountInCents}¢ (€${(chargeAmountInCents / 100).toFixed(2)})`,
            );
            break;
          }

          // Get credits amount from metadata (needed for credit transaction logging)
          const creditsAmountRaw =
            paymentIntent.metadata.credits_amount ??
            paymentIntent.metadata.creditsAmount;

          if (!creditsAmountRaw) {
            console.error("❌ Missing creditsAmount in charge succeeded event");
            break;
          }

          const creditsAmountNum = Number.parseInt(creditsAmountRaw, 10);

          if (Number.isNaN(creditsAmountNum)) {
            console.error("❌ Invalid creditsAmount in charge succeeded event");
            break;
          }

          const userIdRaw =
            paymentIntent.metadata.user_id ?? paymentIntent.metadata.userId;
          const userIdNum = userIdRaw ? Number.parseInt(userIdRaw, 10) : null;

          await prisma.$transaction(async (transaction) => {
            const account = await transaction.account.findUnique({
              where: { id: order.accountId },
              select: { creditBalance: true },
            });

            if (!account) {
              throw new Error(`Account ${order.accountId} not found`);
            }

            const newBalance = account.creditBalance + creditsAmountNum;

            await transaction.account.update({
              where: { id: order.accountId },
              data: { creditBalance: newBalance },
            });

            await transaction.creditTransaction.create({
              data: {
                type: "PURCHASE",
                amount: creditsAmountNum,
                balanceAfter: newBalance,
                note: `Purchased ${creditsAmountNum} credits for €${orderAmount.toFixed(2)}`,
                accountId: order.accountId,
                consumedByUserId: userIdNum ?? undefined,
                orderId: orderIdNum,
              },
            });

            await transaction.order.update({
              where: { id: orderIdNum },
              data: { status: "PAID" },
            });
          });

          console.log(
            `✅ Credits purchased: ${creditsAmountNum} credits added to account ${order.accountId}, amount €${orderAmount.toFixed(2)}`,
          );
          break;
        } catch (err) {
          console.error("Error processing charge.succeeded event:", err);
        }
        break;
      }

      case "charge.failed": {
        try {
          const charge = event.data.object as Stripe.Charge;

          if (!charge.payment_intent) {
            console.error("❌ No payment_intent in failed charge");
            break;
          }

          const paymentIntent = await stripe.paymentIntents.retrieve(
            charge.payment_intent as string,
          );

          const orderIdRaw =
            paymentIntent.metadata.order_id ?? paymentIntent.metadata.orderId;

          if (!orderIdRaw) {
            console.error("❌ Missing order_id in charge.failed event");
            break;
          }

          const orderIdNum = Number.parseInt(orderIdRaw, 10);

          if (Number.isNaN(orderIdNum)) {
            console.error("❌ Invalid order_id in charge.failed event");
            break;
          }

          // Update order status to FAILED if it's still PENDING
          await prisma.order.updateMany({
            where: {
              id: orderIdNum,
              status: "PENDING",
            },
            data: { status: "FAILED" },
          });

          console.log(`⚠️ Charge failed for order ${orderIdNum}`);
          break;
        } catch (err) {
          console.error("Error processing charge.failed event:", err);
        }
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
