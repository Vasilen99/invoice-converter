"use client";

import React from "react";
import BulgarianInvoice from "./BulgarianInvoice";
import { BulgarianInvoiceData } from "../types";
import { X } from "lucide-react";

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceData: BulgarianInvoiceData | null;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  invoiceData,
}) => {
  if (!isOpen || !invoiceData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
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
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <BulgarianInvoice data={invoiceData} />
          </div>
        </div>
      </div>
    </div>
  );
};
