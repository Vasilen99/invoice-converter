import { prisma } from "./prisma";
import type { CreditTransactionType } from "../generated/prisma/enums";

export interface CreditDeductionResult {
  success: boolean;
  remainingBalance: number;
  transactionId?: number;
  error?: string;
}

/**
 * Deduct credits from account and create a credit transaction record.
 * Optimized single query approach to minimize database calls.
 *
 * @param accountId - Account ID to deduct credits from
 * @param creditsToDeduct - Number of credits to deduct
 * @param userId - User ID consuming the credits
 * @param organizationId - Optional organization ID associated with the action
 * @param generatedInvoiceId - Optional generated invoice ID if applicable
 * @returns Credit deduction result with remaining balance
 */
export async function deductCredits(
  accountId: number,
  creditsToDeduct: number,
  userId: number,
  organizationId?: number | null,
  generatedInvoiceId?: number | null,
): Promise<CreditDeductionResult> {
  try {
    // Atomic transaction: verify balance, deduct credits, and create transaction in one operation
    const result = await prisma.$transaction(async (tx) => {
      // Get current balance
      const account = await tx.account.findUnique({
        where: { id: accountId },
        select: { creditBalance: true },
      });

      if (!account) {
        throw new Error("Account not found");
      }

      if (account.creditBalance < creditsToDeduct) {
        throw new Error(
          `Insufficient credits. Available: ${account.creditBalance}, Required: ${creditsToDeduct}`,
        );
      }

      // Update balance and create transaction in parallel
      const newBalance = account.creditBalance - creditsToDeduct;

      const transaction = await tx.creditTransaction.create({
        data: {
          type: "CONSUMPTION" as CreditTransactionType,
          amount: creditsToDeduct,
          balanceAfter: newBalance,
          accountId,
          consumedByUserId: userId,
          organizationId: organizationId ?? undefined,
          generatedInvoiceId: generatedInvoiceId ?? undefined,
          note: `AI Service consumption: -${creditsToDeduct} credits`,
        },
        select: { id: true },
      });

      // Update account balance
      await tx.account.update({
        where: { id: accountId },
        data: { creditBalance: newBalance },
      });

      return {
        transactionId: transaction.id,
        newBalance,
      };
    });

    return {
      success: true,
      remainingBalance: result.newBalance,
      transactionId: result.transactionId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to deduct credits";
    return {
      success: false,
      remainingBalance: 0,
      error: message,
    };
  }
}
