import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json({ data: extracted });
  } catch (error) {
    console.error("Error extracting invoice data:", error);
    return NextResponse.json(
      { error: "Failed to extract invoice data" },
      { status: 500 },
    );
  }
}
