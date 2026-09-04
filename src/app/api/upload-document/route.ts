import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../utility/supabase/server";
import { getUserServer } from "../../../../utility/get-user-server";

/**
 * POST /api/upload-document
 *
 * Generic document upload endpoint for saving files to Supabase storage.
 * Supports both source and generated documents using admin/service role client to bypass RLS.
 *
 * Required query params:
 * - accountId: The account ID
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
    // Verify user is authenticated
    const user = await getUserServer();
    if (!user?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get("accountId");
    const bulstat = searchParams.get("bulstat");
    const documentType = searchParams.get("documentType") || "source";

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing accountId parameter" },
        { status: 400 },
      );
    }

    // Get form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
    const storagePath = `${folderPrefix}/${accountId}/${bulstatFolder}/${fileName}`;

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file to Supabase storage using admin client (bypasses RLS)
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false, // Don't overwrite if file exists
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(storagePath);

    return NextResponse.json({
      success: true,
      publicUrl: urlData.publicUrl,
      path: storagePath,
    });
  } catch (err: unknown) {
    console.error("Error uploading document:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to upload document: ${message}` },
      { status: 500 },
    );
  }
}
