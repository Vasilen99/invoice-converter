import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/utility/prisma";
import { createClient } from "@/utility/supabase/server";
import { creditsLink } from "@/utility/links";

export type DataProps = {
  data: {
    package_id: number;
    price: number;
    credits_amount: number;
    currency?: string;
  };
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-08-26.dahlia",
});

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body: DataProps = await req.json();
    const origin = req.nextUrl.origin;
    const { price, package_id, credits_amount, currency = "eur" } = body.data;

    // Get authenticated user
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getClaims();

    if (!authData?.claims.sub) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "Невалидна сесия",
            message: "Трябва да сте влязли за да продължите",
          },
        },
        { status: 401 },
      );
    }

    // Get user with their account
    const user = await prisma.user.findFirst({
      where: {
        auth_uid: authData.claims.sub,
      },
      select: {
        id: true,
        accountMembers: {
          select: {
            account: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.accountMembers.length) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "Грешка при намиране на акаунт",
            message: "Не може да се намери вашия акаунт",
          },
        },
        { status: 404 },
      );
    }

    const accountId = user.accountMembers[0].account.id;

    // Verify the package exists
    const creditPackage = await prisma.creditPackage.findUnique({
      where: { id: package_id },
    });

    if (!creditPackage) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "Невалиден пакет",
            message: "Избраният пакет не съществува",
          },
        },
        { status: 404 },
      );
    }

    // Create Order record before creating Stripe session
    const order = await prisma.order.create({
      data: {
        amount: price.toString(),
        currency: currency,
        status: "PENDING",
        accountId: accountId,
        packageId: package_id,
        provider: "STRIPE",
      },
    });

    // Create Checkout Session for one-time purchase
    const params: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      mode: "payment",
      payment_intent_data: {
        metadata: {
          account_id: accountId.toString(),
          package_id: package_id.toString(),
          credits_amount: credits_amount.toString(),
          user_id: user.id.toString(),
          order_id: order.id.toString(),
        },
      },
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: `Credits Package - ${credits_amount} credits`,
              description: `Purchase ${credits_amount} credits for invoice processing`,
            },
            unit_amount: Math.round(Number(price) * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}${creditsLink}?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${creditsLink}?status=cancelled`,
    };

    const checkoutSession = await stripe.checkout.sessions.create(params);

    return NextResponse.json(
      { data: { url: checkoutSession.url, sessionId: checkoutSession.id } },
      { status: 200 },
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Internal server error";
    console.error("Payment session error:", err);

    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "Сървърна грешка",
          message: errorMessage,
        },
      },
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
