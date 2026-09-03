import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../utility/prisma";
import { getUserServer } from "../../../../../utility/get-user-server";

/**
 * POST /api/organizations/current-inv-numbers
 *
 * Takes an array of EIKs (bulstats) and returns the current_inv_number for each
 * organization that exists in the user's account.
 *
 * For organizations not found, returns "0000000000" as the default value.
 *
 * Request body:
 * {
 *   "eiks": ["123456789", "987654321"]
 * }
 *
 * Response:
 * {
 *   "data": {
 *     "123456789": "000000001",
 *     "987654321": "0000000000"  // not found, default
 *   }
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const user = await getUserServer();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      eiks: string[];
    };

    const { eiks = [] } = body;

    if (!Array.isArray(eiks) || eiks.length === 0) {
      return NextResponse.json({ data: {} }, { status: 200 });
    }

    // Get user's account
    const accountMember = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: user.sub,
        },
      },
      select: {
        accountId: true,
      },
    });

    if (!accountMember) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Normalize EIKs
    const normalizedEiks = eiks
      .map((eik) => (eik ?? "").trim())
      .filter(Boolean);

    // Fetch all organizations matching these EIKs in the user's account
    const organizations = await prisma.organization.findMany({
      where: {
        accountId: accountMember.accountId,
        bulstat: {
          in: normalizedEiks,
        },
      },
      select: {
        bulstat: true,
        current_inv_number: true,
      },
    });

    // Build response: for each EIK, return current_inv_number or default
    const result: Record<string, string> = {};

    for (const eik of normalizedEiks) {
      const org = organizations.find(
        (o: { bulstat: string | null; current_inv_number: any }) =>
          (o.bulstat ?? "").trim() === eik,
      );

      if (org && org.current_inv_number !== null) {
        // Convert Decimal to string with leading zeros (10 digits)
        const invNumber = String(org.current_inv_number).padStart(10, "0");
        result[eik] = invNumber;
      } else {
        // Default for not found or null
        result[eik] = "0000000000";
      }
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error("[current-inv-numbers] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch current invoice numbers" },
      { status: 500 },
    );
  }
}
