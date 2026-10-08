import { NextRequest, NextResponse } from "next/server";
import { BulgarianInvoiceData } from "../../../types";
import { getUserServer } from "@/utility/get-user-server";
import { prisma } from "@/utility/prisma";
import {
  resolveInvoiceTemplateHtml,
  renderInvoiceTemplateHtml,
} from "@/utility/invoice-template-renderer";

export const runtime = "nodejs";

function v(val: string | undefined): string {
  return val ?? "";
}

async function getAccountSavedTemplateForCurrentUser(): Promise<
  string | undefined
> {
  try {
    const user = await getUserServer();

    if (!user?.sub) {
      return undefined;
    }

    const accountMember = await prisma.accountMember.findFirst({
      where: {
        user: {
          auth_uid: user.sub,
        },
      },
      select: {
        account: {
          select: {
            inv_template: true,
          },
        },
      },
    });

    return accountMember?.account.inv_template ?? undefined;
  } catch (error) {
    console.warn("[generate-pdf] Failed to resolve account template", error);
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  try {
    const requestBody = await req.json();
    const { templateHtml, ...invoiceData } =
      requestBody as BulgarianInvoiceData & {
        templateHtml?: string;
      };

    const data: BulgarianInvoiceData = invoiceData;
    const providedTemplate =
      typeof templateHtml === "string" && templateHtml.trim().length > 0
        ? templateHtml
        : undefined;

    const accountSavedTemplate = providedTemplate
      ? undefined
      : await getAccountSavedTemplateForCurrentUser();

    const effectiveTemplate = providedTemplate ?? accountSavedTemplate;

    const resolvedTemplate = resolveInvoiceTemplateHtml(effectiveTemplate);
    const html = renderInvoiceTemplateHtml(resolvedTemplate, data);

    let browser;
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      const puppeteer = (await import("puppeteer-core")).default;
      const chromium = (await import("@sparticuz/chromium-min")).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar",
        ),
        headless: true,
      });
    } else {
      const puppeteer = (await import("puppeteer")).default;
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    await browser.close();

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="faktura-${v(data.invoiceNumber)}.pdf"; filename*=UTF-8''${encodeURIComponent("фактура-" + v(data.invoiceNumber) + ".pdf")}`,
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
