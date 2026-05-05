'use client';

import React from 'react';
import { ExtractedInvoiceData, InvoiceLineItem } from '../types';
import { FileText } from 'lucide-react';

interface InvoiceDataProps {
  data: ExtractedInvoiceData;
}

const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-1 mb-3">{title}</h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
  </div>
);

const InvoiceDataDisplay: React.FC<InvoiceDataProps> = ({ data }) => {
  return (
    <div className="w-full rounded-xl border border-gray-200 shadow-md bg-white p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
          <FileText className="w-4 h-4 text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-800">Extracted Invoice Data</h2>
      </div>

      <Section title="Invoice Details">
        <Field label="Invoice Number" value={data.invoiceNumber} />
        <Field label="Invoice Date" value={data.invoiceDate} />
        <Field label="Due Date" value={data.dueDate} />
        <Field label="Currency" value={data.currency} />
      </Section>

      {(data.sellerName || data.sellerAddress || data.sellerEmail) && (
        <Section title="Seller">
          <Field label="Name" value={data.sellerName} />
          <Field label="Email" value={data.sellerEmail} />
          <div className="sm:col-span-2">
            <Field label="Address" value={data.sellerAddress} />
          </div>
        </Section>
      )}

      {(data.buyerName || data.buyerAddress || data.buyerEmail) && (
        <Section title="Buyer">
          <Field label="Name" value={data.buyerName} />
          <Field label="Email" value={data.buyerEmail} />
          <div className="sm:col-span-2">
            <Field label="Address" value={data.buyerAddress} />
          </div>
        </Section>
      )}

      {data.lineItems && data.lineItems.length > 0 && (
        <div className="mb-6">
          <h3 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-1 mb-3">Line Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.lineItems.map((item: InvoiceLineItem, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{item.description}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{item.unitPrice}</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-1 mb-3">Totals</h3>
        <div className="flex flex-col items-end gap-1">
          {data.subtotal && (
            <div className="flex gap-8 text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-medium w-24 text-right">{data.subtotal}</span>
            </div>
          )}
          {data.tax && (
            <div className="flex gap-8 text-sm text-gray-600">
              <span>Tax</span>
              <span className="font-medium w-24 text-right">{data.tax}</span>
            </div>
          )}
          {data.total && (
            <div className="flex gap-8 text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-1">
              <span>Total</span>
              <span className="w-24 text-right">{data.total}</span>
            </div>
          )}
        </div>
      </div>

      {data.notes && (
        <div>
          <h3 className="text-base font-semibold text-gray-700 border-b border-gray-100 pb-1 mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{data.notes}</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceDataDisplay;
