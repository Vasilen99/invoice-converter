import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/utility/prisma";
import { createClient } from "@/utility/supabase/server";
import { creditsLink } from "@/utility/links";
import {
  calculateCreditPrice,
  CREDIT_PRICING_CURRENCY,
  CREDIT_PRICING_STRIPE_CURRENCY,
} from "@/utility/credit-pricing";

export type DataProps = {
  data: {
    package_id: number;
    credits_amount: number;
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
    const { package_id, credits_amount } = body.data;

    if (!Number.isInteger(package_id) || !Number.isInteger(credits_amount)) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "Невалидна заявка",
            message: "Невалидни данни за пакет или кредити",
          },
        },
        { status: 400 },
      );
    }

    const pricing = calculateCreditPrice(credits_amount);

    if (!pricing) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "Невалиден брой кредити",
            message: "Избраният брой кредити не се поддържа",
          },
        },
        { status: 400 },
      );
    }

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
    const creditPackage = await prisma.creditPackage.findFirst({
      where: {
        id: package_id,
        isActive: true,
        currency: {
          equals: CREDIT_PRICING_CURRENCY,
        },
      },
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
        amount: pricing.finalPrice.toFixed(2),
        currency: CREDIT_PRICING_CURRENCY,
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
          userId: user.id.toString(),
          creditPackageId: package_id.toString(),
          creditsAmount: pricing.credits.toString(),
          priceAmount: pricing.finalPrice.toFixed(2),
          currency: pricing.currency,
          account_id: accountId.toString(),
          package_id: package_id.toString(),
          credits_amount: pricing.credits.toString(),
          price_amount: pricing.finalPrice.toFixed(2),
          user_id: user.id.toString(),
          order_id: order.id.toString(),
        },
      },
      line_items: [
        {
          price_data: {
            currency: CREDIT_PRICING_STRIPE_CURRENCY,
            product_data: {
              name: `${creditPackage.name} - ${pricing.credits}бр. кредити`,
            },
            unit_amount: Math.round(pricing.finalPrice * 100),
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
