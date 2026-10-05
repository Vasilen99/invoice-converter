import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "@/utility/get-user-server";
import { prisma } from "@/utility/prisma";
import { deductCredits } from "@/utility/credit-system";
import {
  getDefaultInvoiceTemplateHtml,
  normalizeTemplateHtml,
  sanitizeTemplateHtml,
} from "@/utility/invoice-template";
import { CREDIT_COSTS } from "@/utility/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

type ExtractedTemplateResponse = {
  templateHtml: string;
};

const ALLOWED_EXTENSIONS = ["pdf", "docx", "doc"];

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
            7) All the marketing or decorative elements (logos, watermarks, stamps) must not be included in the output. For example, if the source has a logo, dont include it in the output, but keep the space it occupies and the layout intact. If there is a QR code, that should be removed as well, and the space it occupies shall not be reserved in the output.
            8) Ensure that the sizes are properly and consistently scaled to fit the A4 canvas without distortion or clipping.
            9) Field extraction and placeholder naming rules (CRITICAL - only these fields are allowed):
            The template MUST use ONLY the following placeholder names. Do NOT infer, add, or create any additional fields beyond this list.
            
            Allowed placeholders (organized by section):
            INVOICE METADATA:
            - {{invoiceNumber}} — numeric or alphanumeric invoice identifier
            - {{invoiceDate}} — invoice issuance date
            - {{taxEventDate}} — tax event date (when service/goods was delivered)
            - {{location}} — location/place of the transaction
            
            SELLER/SUPPLIER (Доставчик) — six fields, no exceptions:
            - {{sellerName}} — company/legal entity name
            - {{sellerEik}} — Bulgarian UIC (Единен идентификационен код)
            - {{sellerVatNumber}} — VAT registration number
            - {{sellerCity}} — city/municipality
            - {{sellerAddress}} — street address and number
            - {{sellerMol}} — responsible person (МОЛ)
            
            BUYER/RECIPIENT (Получател) — six fields, no exceptions:
            - {{buyerName}} — company/legal entity name
            - {{buyerEik}} — Bulgarian UIC
            - {{buyerVatNumber}} — VAT registration number
            - {{buyerCity}} — city/municipality
            - {{buyerAddress}} — street address and number
            - {{buyerMol}} — responsible person (МОЛ)
            
            LINE ITEMS (each item must have exactly these six fields):
            - {{lineItem.description}} — product/service name/description
            - {{lineItem.unit}} — unit of measure (e.g., buc, m, kg, h)
            - {{lineItem.quantity}} — numeric quantity
            - {{lineItem.unitPrice}} — price per unit
            - {{lineItem.vatPercent}} — VAT percentage (e.g., 20%)
            - {{lineItem.value}} — total value (quantity × unitPrice + VAT or as applicable)
            
            TOTALS AND AMOUNTS (five fields, no exceptions):
            - {{subtotal}} — total before VAT
            - {{vatAmount}} — VAT amount
            - {{total}} — total amount due (subtotal + vatAmount)
            - {{totalInWords}} — total in words/text representation
            - {{currency}} — currency code (e.g., BGN, EUR, USD)
            
            OPTIONAL FIELDS (only include if visible in source):
            - {{composer_name}} — name of person who created/composed the invoice (optional)
            - {{bank}} — bank name (optional, for bank transfer payment info)
            - {{iban}} — IBAN account number (optional)
            - {{bic}} — BIC code (optional)
            
            STRICT RULES:
            1) Do NOT add any fields not listed above. Examples of forbidden additions: dueDate, paymentTerms, discountAmount, discount, notes, reference, project, department, email, phone, etc.
            2) Do NOT rename placeholders. Use exact names as specified.
            3) For line items, always iterate over a container. Use naming like {{lineItem.field}} or similar array-aware syntax.
            4) If a field from the source cannot be mapped to this list, IGNORE it completely. Do not create a new placeholder for it.
            5) Empty/missing fields in the source are acceptable—they result in blank placeholders that will be filled at runtime.
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
            3) CRITICAL CSS REQUIREMENTS FOR A4 LAYOUT:
               - Set body width: 794px; max-width: none !important; min-width: 794px;
               - Set box-sizing: border-box on all elements
               - Use overflow-x: hidden; on body to prevent horizontal scrolling
               - Do NOT use max-width: 100vw or width: 100% on body or root elements
               - All tables must have width: 100%; table-layout: fixed; to prevent overflow
               - All text elements (td, th, div, span, p) must have: max-width: 100%; overflow-wrap: anywhere; word-break: break-word;
               - Do NOT use position: absolute or position: fixed at body level—this can break the A4 constraint
               - Ensure no child elements have width > 794px or overflow their containers
               - Test for horizontal scroll: if any element extends beyond 794px width, adjust its width or use table-layout: fixed
            4) Include all required CSS inside <style> in the HTML.
            5) Do not include JavaScript, external CSS links, or remote assets.

            Quality checklist before returning:
            - Template visually matches source geometry.
            - All placeholders are anonymized and wrapped in .tpl-var.
            - No overlaps in dense areas (header, tables, totals, signatures).
            - NO HORIZONTAL SCROLL: Body is exactly 794px wide with no element overflowing.
            - All tables use table-layout: fixed and width: 100% to prevent overflow.
            - Text elements have max-width: 100% and word-break properties set.
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
      CREDIT_COSTS.TEMPLATE_EXTRACTION,
      userData.id,
    );
    console.log(finalTemplate, "FINAL TEMPLATE");

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
