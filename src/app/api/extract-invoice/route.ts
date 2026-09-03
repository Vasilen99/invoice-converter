import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../utility/prisma";
import { getUserServer } from "../../../../utility/get-user-server";
const PROMPT = `You are an invoice data extraction specialist. Extract all available data from this Stripe invoice PDF and return it as a valid JSON object with the following structure (use empty string "" for missing fields):
{
  "invoiceNumber": string,
  "invoiceDate": string,
  "taxEventDate": string,
  "location": string,
  "sellerName": string,
  "sellerEik": string,
  "sellerVatNumber": string,
  "sellerCity": string,
  "sellerAddress": string,
  "sellerMol": string,
  "buyerName": string,
  "buyerEik": string,
  "buyerVatNumber": string,
  "buyerCity": string,
  "buyerAddress": string,
  "buyerMol": string,
  "lineItems": [{ "description": string, "unit": string, "quantity": string, "unitPrice": string, "vatPercent": string, "value": string }],
  "subtotal": string,
  "vatAmount": string,
  "total": string,
  "totalInWords": string,
  "currency": string
}

Notes:
- invoiceDate and taxEventDate should be in DD.MM.YYYY format
- for taxEventDate, look for "Дата на данъчно събитие" / "Tax Event Date" / "Падеж" / "Due Date" / "Дата на падеж"
- SELLER (sellerName, sellerEik, etc.) is the company/entity that ISSUED the invoice (the "From" or "Billed by" section)
- BUYER (buyerName, buyerEik, etc.) is the company/entity that RECEIVES the invoice (the "Bill to" or "Customer" section)
- For sellerEik and buyerEik try to find company registration numbers / EIK / tax IDs
- For sellerVatNumber and buyerVatNumber look for VAT / ДДС numbers (prefix with BG if Bulgarian)
- For sellerMol and buyerMol look for the person responsible / МОЛ / contact person
- For lineItems.unit use "бр." if not specified
- For lineItems.vatPercent use "20.00" if not specified
- For totalInWords write the total amount in Bulgarian words (e.g. "Деветстотин и шестдесет евро")
- Return ONLY the JSON object, no extra text.`;

const DEFAULT_INVOICE_NUMBER = "0000000000";

function normalizeBulstat(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function formatInvoiceNumber(value: unknown): string {
  if (value === null || value === undefined) {
    return DEFAULT_INVOICE_NUMBER;
  }

  const digitsOnly = String(value).replace(/\D/g, "");
  if (!digitsOnly) {
    return DEFAULT_INVOICE_NUMBER;
  }

  return digitsOnly.padStart(10, "0");
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserServer();
    if (!user?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();

    // Upload the PDF as a file so the Responses API can read it
    const uploadedFile = await openai.files.create({
      file: new File([bytes], file.name, { type: "application/pdf" }),
      purpose: "user_data",
    });

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
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
              text: PROMPT,
            },
          ],
        },
      ],
    });

    // Clean up the uploaded file
    await openai.files.delete(uploadedFile.id).catch(() => {});

    const content = response.output_text ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse invoice data" },
        { status: 500 },
      );
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // The invoiceNumber default always comes from DB state, not the scanned PDF.
    // If organization is missing or has no current_inv_number, fallback to 0000000000.
    let invoiceNumberFromDb = DEFAULT_INVOICE_NUMBER;
    const sellerEik = normalizeBulstat(extracted?.sellerEik);

    if (sellerEik) {
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

      if (accountMember?.accountId) {
        const organization = await prisma.organization.findFirst({
          where: {
            accountId: accountMember.accountId,
            bulstat: sellerEik,
          },
          select: {
            current_inv_number: true,
          },
        });

        invoiceNumberFromDb = formatInvoiceNumber(
          organization?.current_inv_number,
        );
      }
    }

    extracted.invoiceNumber = invoiceNumberFromDb;

    return NextResponse.json({ data: extracted });
  } catch (error) {
    console.error("Error extracting invoice data:", error);
    return NextResponse.json(
      { error: "Failed to extract invoice data" },
      { status: 500 },
    );
  }
}
