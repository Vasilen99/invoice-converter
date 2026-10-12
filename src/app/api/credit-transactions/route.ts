import { prisma } from "@/utility/prisma";
import { resolveAuthenticatedAccountContext } from "@/utility/helpers/server-api";
import { apiResponse } from "@/utility/helpers/server-api";
export async function GET() {
  try {
    const context = await resolveAuthenticatedAccountContext();

    if (!context) {
      return apiResponse(null, 404);
    }

    const transactions = await prisma.creditTransaction.findMany({
      where: {
        accountId: context.accountId,
      },
      select: {
        type: true,
        amount: true,
        createdAt: true,
        balanceAfter: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    return apiResponse(transactions, 200);
  } catch (_error) {
    return apiResponse(null, 500);
  }
}
