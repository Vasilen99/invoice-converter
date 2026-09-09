import { notFound } from "next/navigation";
import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";
import type { OrganizationLight } from "../../../../utility/types";

export type GeneratedInvoiceSummary = {
  id: number;
  displayNumber: string;
  issueDate: string;
  totalAmount: string;
  currency: string;
  status: "DRAFT" | "ISSUED" | "VOID" | "CREDIT_NOTE";
  contragentName: string;
  lineItemsCount: number;
  createdAt: string;
};

export type OrganizationWithGeneratedInvoices = OrganizationLight & {
  generatedInvoices: GeneratedInvoiceSummary[];
};

export async function getOrganizationsWithGeneratedInvoices(): Promise<{
  organizations: OrganizationWithGeneratedInvoices[];
  hasAccount: boolean;
  accountId: number | null;
  composerName: string | null;
}> {
  const user = await getUserServer();
  if (!user?.sub) {
    return notFound();
  }

  try {
    const userData = await prisma.user.findUnique({
      where: {
        auth_uid: user.sub,
      },
      select: {
        id: true,
        accountMembers: {
          where: {
            user: {
              auth_uid: user.sub,
            },
          },
          select: {
            accountId: true,
          },
          take: 1,
        },
      },
    });

    if (!userData) {
      return notFound();
    }

    const accountMember = userData.accountMembers?.[0];
    if (!accountMember) {
      return {
        organizations: [],
        hasAccount: false,
        accountId: null,
        composerName: null,
      };
    }

    const account = await prisma.account.findUnique({
      where: {
        id: accountMember.accountId,
      },
      select: {
        id: true,
        composer_name: true,
      },
    });

    if (!account) {
      return {
        organizations: [],
        hasAccount: false,
        accountId: null,
        composerName: null,
      };
    }

    const organizations = await prisma.organization.findMany({
      where: {
        accountId: account.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        bulstat: true,
        vatNumber: true,
        molName: true,
        email: true,
        invoiceSeriesPrefix: true,
        bank: true,
        iban: true,
        bic: true,
        address: true,
        generatedInvoices: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            invoiceSeries: true,
            invoiceNumber: true,
            issueDate: true,
            totalAmount: true,
            currency: true,
            status: true,
            createdAt: true,
            contragent: {
              select: {
                name: true,
              },
            },
            lineItems: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    const formattedOrganizations: OrganizationWithGeneratedInvoices[] =
      organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        bulstat: organization.bulstat,
        vatNumber: organization.vatNumber,
        molName: organization.molName,
        email: organization.email,
        invoiceSeriesPrefix: organization.invoiceSeriesPrefix,
        bank: organization.bank,
        iban: organization.iban,
        bic: organization.bic,
        address: organization.address as OrganizationLight["address"],
        generatedInvoices: organization.generatedInvoices.map((invoice) => ({
          id: invoice.id,
          displayNumber: `${invoice.invoiceSeries}${String(invoice.invoiceNumber).padStart(10, "0")}`,
          issueDate: invoice.issueDate.toISOString(),
          totalAmount: invoice.totalAmount.toString(),
          currency: invoice.currency,
          status: invoice.status,
          contragentName: invoice.contragent.name,
          lineItemsCount: invoice.lineItems.length,
          createdAt: invoice.createdAt.toISOString(),
        })),
      }));

    return {
      organizations: formattedOrganizations,
      hasAccount: true,
      accountId: account.id,
      composerName: account.composer_name,
    };
  } catch (error) {
    console.error("[generated-invoices/action] Error:", error);
    return {
      organizations: [],
      hasAccount: true,
      accountId: null,
      composerName: null,
    };
  }
}
