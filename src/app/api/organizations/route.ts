import { prisma } from "@/utility/prisma";
import { resolveAuthenticatedAccountContext } from "@/utility/helpers/server-api";
import { apiResponse } from "@/utility/helpers/server-api";

export async function GET() {
  try {
    const context = await resolveAuthenticatedAccountContext();

    if (!context) {
      return apiResponse(null, 404);
    }

    const organizations = await prisma.organization.findMany({
      where: {
        accountId: context.accountId,
      },
      select: {
        id: true,
        name: true,
        bulstat: true,
        generatedInvoices: {
          select: {
            _count: true,
            totalAmount: true,
            createdAt: true,
          },
        },
        contragents: {
          select: {
            _count: true,
          },
        },
      },
      orderBy: {
        generatedInvoices: {
          _count: "desc",
        },
      },
    });

    return apiResponse(organizations, 200);
  } catch (_error) {
    return apiResponse(null, 500);
  }
}
