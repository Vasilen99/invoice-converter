"use client";

import React, { useMemo } from "react";
import { BulgarianInvoiceData } from "../types";
import { X } from "lucide-react";
import {
  renderInvoiceTemplateHtml,
  resolveInvoiceTemplateHtml,
} from "@/utility/invoice-template-renderer";

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: BulgarianInvoiceData | null;
  templateHtml?: string | null;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  invoiceData,
  templateHtml,
}) => {
  if (!isOpen || !invoiceData) return null;

  const renderedTemplate = useMemo(() => {
    const resolvedTemplate = resolveInvoiceTemplateHtml(templateHtml);
    return renderInvoiceTemplateHtml(resolvedTemplate, invoiceData);
  }, [invoiceData, templateHtml]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-primary">
            Преглед: Фактура {invoiceData.invoiceNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-1 transition hover:cursor-pointer"
            aria-label="Close preview"
          >
            <X size={24} />
          </button>
        </div>

        {/* Invoice Preview */}
        <div className="flex-1 bg-gray-50 p-3 sm:p-6 min-h-0">
          <div className="bg-white rounded-lg shadow-sm p-2 sm:p-4 h-full min-h-0">
            <div className="rounded-md border border-border bg-white h-full overflow-auto overscroll-contain touch-pan-x touch-pan-y">
              <iframe
                sandbox="allow-same-origin"
                className="block border-0 max-w-none"
                style={{ width: "794px", height: "1123px" }}
                srcDoc={renderedTemplate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
