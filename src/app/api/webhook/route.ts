import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/utility/prisma";

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

          // Get the payment intent to access metadata
          const paymentIntent = await stripe.paymentIntents.retrieve(
            charge.payment_intent as string,
          );

          const { account_id, credits_amount, package_id, user_id, order_id } =
            paymentIntent.metadata;

          if (!account_id || !credits_amount || !package_id || !order_id) {
            console.error(
              "❌ Missing required metadata in charge succeeded event",
            );
            break;
          }

          const accountIdNum = parseInt(account_id);
          const creditsAmountNum = parseInt(credits_amount);
          const packageIdNum = parseInt(package_id);
          const userIdNum = parseInt(user_id);

          // Get current account balance
          const account = await prisma.account.findUnique({
            where: { id: accountIdNum },
            select: { creditBalance: true },
          });

          if (!account) {
            console.error(`❌ Account ${accountIdNum} not found`);
            break;
          }

          const newBalance = account.creditBalance + creditsAmountNum;

          // Update account credit balance
          await prisma.account.update({
            where: { id: accountIdNum },
            data: { creditBalance: newBalance },
          });

          // Create credit transaction record
          await prisma.creditTransaction.create({
            data: {
              type: "PURCHASE",
              amount: creditsAmountNum,
              balanceAfter: newBalance,
              note: `Purchased ${creditsAmountNum} credits from package ${packageIdNum}`,
              accountId: accountIdNum,
              consumedByUserId: userIdNum || undefined,
            },
          });

          // Update order status if one exists
          await prisma.order.update({
            where: {
              id: parseInt(order_id),
              accountId: accountIdNum,
              packageId: packageIdNum,
            },
            data: { status: "PAID" },
          });

          console.log(
            `✅ Credits purchased: ${creditsAmountNum} credits added to account ${accountIdNum}`,
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

          // Get the payment intent to access metadata
          if (!charge.payment_intent) {
            console.error("❌ No payment_intent in failed charge");
            break;
          }

          const paymentIntent = await stripe.paymentIntents.retrieve(
            charge.payment_intent as string,
          );

          const { account_id, package_id, order_id } = paymentIntent.metadata;

          if (!account_id || !package_id || !order_id) {
            console.error(
              "❌ Missing required metadata in charge failed event",
            );
            break;
          }

          const accountIdNum = parseInt(account_id);
          const packageIdNum = parseInt(package_id);

          // Update order status to FAILED
          await prisma.order.update({
            where: {
              id: parseInt(order_id),
              accountId: accountIdNum,
              packageId: packageIdNum,
              status: "PENDING",
            },
            data: { status: "FAILED" },
          });

          console.log(
            `⚠️ Charge failed for account ${accountIdNum}, package ${packageIdNum}`,
          );
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
