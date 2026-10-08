import { NextRequest } from "next/server";
import { createAdminClient } from "@/utility/supabase/server";
import {
  apiResponse,
  resolveAuthenticatedAccountContext,
} from "@/utility/helpers/server-api";

/**
 * POST /api/upload-document
 *
 * Generic document upload endpoint for saving files to Supabase storage.
 * Supports both source and generated documents using admin/service role client to bypass RLS.
 *
 * Query params:
 * - accountId: Optional, validated against authenticated user's account
 * - bulstat: The seller's BULSTAT/EIK
 * - documentType: "source" or "generated" (defaults to "source")
 *
 * Request body must be FormData with:
 * - file: The PDF file to upload
 *
 * Returns:
 * - success: boolean
 * - publicUrl: The public URL of the uploaded document
 * - path: The storage path of the document
 * - error: Error message (if failed)
 */
export async function POST(request: NextRequest) {
  try {
    const accountContext = await resolveAuthenticatedAccountContext();
    if (!accountContext) {
      return apiResponse(null, 401, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const accountIdParam = searchParams.get("accountId");
    const bulstat = searchParams.get("bulstat");
    const documentType = searchParams.get("documentType") || "source";

    const parsedAccountId =
      accountIdParam !== null
        ? Number(accountIdParam)
        : accountContext.accountId;

    if (!Number.isFinite(parsedAccountId)) {
      return apiResponse(null, 400, {
        status: "error",
        header: "errorMessagesCommon.serverErrorHeader",
        message: "errorMessagesCommon.serverErrorMessage",
      });
    }

    if (parsedAccountId !== accountContext.accountId) {
      return apiResponse(null, 403, {
        status: "error",
        header: "errorMessagesCommon.unauthorizedErrorHeader",
        message: "errorMessagesCommon.unauthorizedErrorMessage",
      });
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return apiResponse(null, 400, {
        status: "error",
        header: "errorMessagesCommon.serverErrorHeader",
        message: "errorMessagesCommon.serverErrorMessage",
      });
    }

    // Create admin Supabase client (uses service role key to bypass RLS)
    const supabase = createAdminClient();

    // Determine folder based on document type
    const folderPrefix =
      documentType === "generated" ? "generated-documents" : "source-documents";

    // Sanitize filename - remove non-ASCII characters and replace spaces
    const sanitizedFileName = file.name
      .replace(/[^\w.-]/g, "_") // Replace non-word characters (except dots and hyphens) with underscores
      .replace(/\s+/g, "_"); // Replace spaces with underscores

    // Prepare storage path
    const bulstatFolder = bulstat || "unknown";
    const fileName = `${Date.now()}-${sanitizedFileName}`;
    const storagePath = `${folderPrefix}/${parsedAccountId}/${bulstatFolder}/${fileName}`;

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file to Supabase storage using admin client (bypasses RLS)
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false, // Don't overwrite if file exists
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return apiResponse(null, 500, {
        status: "error",
        header: "errorMessagesCommon.serverErrorHeader",
        message: "errorMessagesCommon.serverErrorMessage",
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    return apiResponse(
      {
        success: true,
        publicUrl: urlData.publicUrl,
        path: storagePath,
      },
      200,
    );
  } catch (err: unknown) {
    console.error("Error uploading document:", err);
    return apiResponse(null, 500, {
      status: "error",
      header: "errorMessagesCommon.serverErrorHeader",
      message: "errorMessagesCommon.serverErrorMessage",
    });
  }
}
