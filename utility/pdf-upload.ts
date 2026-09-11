/**
 * Upload a PDF blob to Supabase storage and return the public URL
 * This is called from the client side during invoice generation
 */
export async function uploadPdfToSupabase(
  pdfBlob: Blob,
  invoiceNumber: string,
  accountId?: number,
  organizationBulstat?: string,
): Promise<string | null> {
  try {
    // Create FormData for the upload
    const formData = new FormData();
    formData.append("file", pdfBlob, `invoice-${invoiceNumber}.pdf`);

    // Build query parameters
    const queryParams = new URLSearchParams();
    queryParams.append("documentType", "generated");
    if (accountId) queryParams.append("accountId", String(accountId));
    if (organizationBulstat) queryParams.append("bulstat", organizationBulstat);

    // Upload via the API endpoint
    const response = await fetch(
      `/api/upload-document?${queryParams.toString()}`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("PDF upload failed:", error);
      return null;
    }

    const data = await response.json();
    return data.publicUrl || null;
  } catch (error) {
    console.error("Error uploading PDF to Supabase:", error);
    return null;
  }
}
