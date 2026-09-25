import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/utility/prisma";
import { getUserServer } from "@/utility/get-user-server";
import { EXTRACT_PROMPT, DEFAULT_INVOICE_NUMBER } from "@/utility/constants";

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
              text: EXTRACT_PROMPT,
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
