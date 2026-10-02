import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "@/utility/get-user-server";
import { prisma } from "@/utility/prisma";
import { deductCredits } from "@/utility/credit-system";
import {
  getDefaultInvoiceTemplateHtml,
  normalizeTemplateHtml,
  sanitizeTemplateHtml,
} from "@/utility/invoice-template";

export const runtime = "nodejs";
export const maxDuration = 60;

type ExtractedTemplateResponse = {
  templateHtml: string;
};

const ALLOWED_EXTENSIONS = ["pdf", "docx", "doc"];
const TEMPLATE_ANALYZE_CREDIT_COST = 3;

function hasAllowedExtension(fileName: string): boolean {
  const parts = fileName.toLowerCase().split(".");
  const extension = parts.length > 1 ? parts[parts.length - 1] : "";
  return ALLOWED_EXTENSIONS.includes(extension);
}

function safeJsonParse<T>(input: string): T | null {
  try {
    const jsonMatch = input.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserServer();
    if (!user?.sub) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "errorMessagesCommon.unauthorizedErrorHeader",
            message: "errorMessagesCommon.unauthorizedErrorMessage",
          },
        },
        { status: 401 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.invalidFileHeader",
            message: "invoiceTemplate.alerts.invalidFileMessage",
          },
        },
        { status: 400 },
      );
    }

    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.unsupportedFileHeader",
            message: "invoiceTemplate.alerts.unsupportedFileMessage",
          },
        },
        { status: 400 },
      );
    }

    const userData = await prisma.user.findUnique({
      where: {
        auth_uid: user.sub,
      },
      select: {
        id: true,
        accountMembers: {
          select: {
            accountId: true,
          },
          take: 1,
        },
      },
    });

    if (!userData?.id || !userData.accountMembers[0]?.accountId) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.accountMissingHeader",
            message: "invoiceTemplate.alerts.accountMissingMessage",
          },
        },
        { status: 400 },
      );
    }

    const accountId = userData.accountMembers[0].accountId;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.analysisFailedHeader",
            message: "invoiceTemplate.alerts.analysisFailedMessage",
          },
        },
        { status: 500 },
      );
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });
    const bytes = await file.arrayBuffer();

    const uploadedFile = await openai.files.create({
      file: new File([bytes], file.name, {
        type: file.type || "application/octet-stream",
      }),
      purpose: "user_data",
    });

    const response = await openai.responses.create({
      model: "gpt-6-astra",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              file_id: uploadedFile.id,
            },
            {
              type: "input_text",
              text: `You are an invoice template reverse-engineering engine.

            Task:
            Extract an HTML+CSS template that reproduces this invoice layout as close as possible to the source, including every line, border, box, divider, header block, spacing rhythm, and typography hierarchy.

            Non-negotiable output contract:
            1) Return ONLY strict JSON in this exact shape:
            {
              "templateHtml": "<html>...</html>"
            }
            2) No markdown, no explanations, no extra keys.
            3) HTML must be complete and iframe-renderable without JavaScript.

            Data/privacy rules:
            1) Remove or anonymize all real values (names, VAT IDs, EIK, addresses, bank details, totals, dates, invoice numbers, signatures).
            2) Replace dynamic values with placeholders using double curly braces (e.g. {{sellerName}}, {{invoiceNumber}}, {{invoiceDate}}).
            3) Keep static legal text only if it is generic regulatory wording.

            Layout fidelity rules (highest priority):
            1) Reproduce the visual geometry of the source invoice as faithfully as possible.
            2) Keep all visible lines/boxes with matching stroke thickness and color.
            3) Keep table column boundaries, header rows, and cell paddings aligned to the original.
            4) Preserve original visual order and relative placement of all major regions (header, seller/buyer, metadata, items table, totals, footer/signatures).
            5) Use A4 portrait canvas with exact render target: width 794px and height 1123px.
            6) If the original requires precise coordinates, positioned layout is allowed. Do not arbitrarily reflow the structure.

            Text safety / overlap rules (must satisfy all):
            1) No text may overlap other text, borders, or neighboring blocks.
            2) Every dynamic placeholder must be wrapped in a dedicated container element with class "tpl-var".
            3) Dynamic text containers must support safe wrapping:
              - display: block or inline-block as appropriate
              - min-width: 0
              - max-width: 100%
              - white-space: normal
              - overflow-wrap: anywhere
              - word-break: break-word
              - line-height: inherit
            4) For grid/table cells that can receive long values, keep sufficient padding and vertical growth so borders remain intact.
            5) Never clip dynamic text unless the source visually enforces clipping; prefer wrapping.

            Styling rules:
            1) Keep colors, font sizes, line heights, and emphasis close to source.
            2) Use print-safe CSS and deterministic sizing.
            3) Include all required CSS inside <style> in the HTML.
            4) Do not include JavaScript, external CSS links, or remote assets.

            Quality checklist before returning:
            - Template visually matches source geometry.
            - All placeholders are anonymized and wrapped in .tpl-var.
            - No overlaps in dense areas (header, tables, totals, signatures).
            - Valid HTML document returned in templateHtml.`,
            },
          ],
        },
      ],
    });

    await openai.files.delete(uploadedFile.id).catch(() => {});

    const parsed = safeJsonParse<ExtractedTemplateResponse>(
      response.output_text || "",
    );

    if (!parsed?.templateHtml) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.analysisFailedHeader",
            message: "invoiceTemplate.alerts.analysisFailedMessage",
          },
        },
        { status: 500 },
      );
    }

    const cleanedTemplate = sanitizeTemplateHtml(parsed.templateHtml);
    const normalizedTemplate = normalizeTemplateHtml(cleanedTemplate);
    const finalTemplate = normalizedTemplate || getDefaultInvoiceTemplateHtml();

    const creditResult = await deductCredits(
      accountId,
      TEMPLATE_ANALYZE_CREDIT_COST,
      userData.id,
    );

    if (!creditResult.success) {
      return NextResponse.json(
        {
          data: null,
          alert: {
            status: "error",
            header: "invoiceTemplate.alerts.insufficientCreditsHeader",
            message: "invoiceTemplate.alerts.insufficientCreditsMessage",
          },
        },
        { status: 402 },
      );
    }

    return NextResponse.json(
      {
        data: {
          templateHtml: finalTemplate,
          creditsRemaining: creditResult.remainingBalance,
        },
        alert: {
          status: "success",
          header: "invoiceTemplate.alerts.analysisSuccessHeader",
          message: "invoiceTemplate.alerts.analysisSuccessMessage",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Invoice template analysis error:", error);
    return NextResponse.json(
      {
        data: null,
        alert: {
          status: "error",
          header: "invoiceTemplate.alerts.analysisFailedHeader",
          message: "invoiceTemplate.alerts.analysisFailedMessage",
        },
      },
      { status: 500 },
    );
  }
}
