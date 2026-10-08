import { NextRequest } from "next/server";
import { prisma } from "@/utility/prisma";
import { normalizeEik } from "@/utility/helpers/common";
import {
  apiResponse,
  resolveAuthenticatedAccountContext,
} from "@/utility/helpers/server-api";

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
    const accountContext = await resolveAuthenticatedAccountContext();
    if (!accountContext) {
      return apiResponse(null, 401, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    const body = (await request.json()) as {
      eiks: string[];
    };

    const { eiks = [] } = body;

    if (!Array.isArray(eiks) || eiks.length === 0) {
      return apiResponse({}, 200);
    }

    // Normalize EIKs
    const normalizedEiks = eiks.map((eik) => normalizeEik(eik)).filter(Boolean);

    // Fetch all organizations matching these EIKs in the user's account
    const organizations = await prisma.organization.findMany({
      where: {
        accountId: accountContext.accountId,
        bulstat: {
          in: normalizedEiks,
        },
      },
      select: {
        bulstat: true,
        current_inv_number: true,
      },
    });

    const organizationByBulstat = new Map(
      organizations.map((org) => [normalizeEik(org.bulstat), org] as const),
    );

    // Build response: for each EIK, return current_inv_number or default
    const result: Record<string, string> = {};

    for (const eik of normalizedEiks) {
      const org = organizationByBulstat.get(eik);

      if (org && org.current_inv_number !== null) {
        // Convert Decimal to string with leading zeros (10 digits)
        const invNumber = String(org.current_inv_number).padStart(10, "0");
        result[eik] = invNumber;
      } else {
        // Default for not found or null
        result[eik] = "0000000000";
      }
    }

    return apiResponse(result, 200);
  } catch (error) {
    console.error("[current-inv-numbers] Error:", error);
    return apiResponse(null, 500, {
      status: "error",
      header: "errorMessagesCommon.serverErrorHeader",
      message: "errorMessagesCommon.serverErrorMessage",
    });
  }
}
