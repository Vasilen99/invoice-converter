'use client';

import React, { useRef, useState } from 'react';
import { Upload, X, Loader2, AlertCircle, Download, FileOutput, CheckCircle2, Sparkles, FileText, Wand2 } from 'lucide-react';
import PdfViewer from './PdfViewer';
import BulgarianInvoice, { SELLER_DEFAULTS } from './BulgarianInvoice';
import { BulgarianInvoiceData } from '../types';

type Status = 'idle' | 'extracting' | 'extracted' | 'generated' | 'error';

/* ── Animated AI extraction steps shown while waiting ── */
const AI_STEPS = [
  'Четене на структурата на фактурата…',
  'Идентифициране на купувач и продавач…',
  'Извличане на редовете от фактурата…',
  'Изчисляване на сумите…',
  'Преобразуване в български формат…',
];

/* ── Small reusable helpers ── */
const EditField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}> = ({ label, value, onChange, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</label>
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="text-sm text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
    />
  </div>
);

const EditSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{title}</span>
      <div className="flex-1 h-px bg-indigo-100" />
    </div>
    {children}
  </div>
);

const InvoiceUploader: React.FC = () => {
  const inputRef   = useRef<HTMLInputElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [file, setFile]             = useState<File | null>(null);
  const [invoiceData, setInvoiceData] = useState<BulgarianInvoiceData | null>(null);
  const [status, setStatus]         = useState<Status>('idle');
  const [errorMsg, setErrorMsg]     = useState('');
  const [downloading, setDownloading] = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [aiStep, setAiStep]         = useState(0);

  const cycleAiStep = () => {
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % AI_STEPS.length;
      setAiStep(i);
    }, 1800);
    return id;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== 'application/pdf') {
      setErrorMsg('Моля, качете валиден PDF файл.');
      setFile(null);
      setInvoiceData(null);
      return;
    }

    setErrorMsg('');
    setFile(selected);
    setInvoiceData(null);
    setAiStep(0);
    setStatus('extracting');
    const stepTimer = cycleAiStep();

    try {
      const formData = new FormData();
      formData.append('file', selected);
      const res  = await fetch('/api/extract-invoice', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Неуспешно извличане на данни');
      setInvoiceData({
          ...json.data,
          sellerName: SELLER_DEFAULTS.name,
          sellerEik: SELLER_DEFAULTS.eik,
          sellerVatNumber: SELLER_DEFAULTS.vatNumber,
          sellerCity: SELLER_DEFAULTS.city,
          sellerAddress: SELLER_DEFAULTS.address,
          sellerMol: SELLER_DEFAULTS.mol,
        });
      setStatus('extracted');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Неуспешно извличане на данните от фактурата.');
      setStatus('error');
    } finally {
      clearInterval(stepTimer);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      const fake = { target: { files: [dropped] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fake);
    }
  };

  const reset = () => {
    setFile(null); setInvoiceData(null);
    setStatus('idle'); setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async () => {
    if (!invoiceData) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `фактура-${invoiceData.invoiceNumber ?? 'generated'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="w-full">

      {/* ── UPLOAD ZONE ── */}
      {!file && (
        <div
          className={`relative group rounded-2xl p-12 flex flex-col items-center justify-center gap-5 cursor-pointer transition-all duration-300 overflow-hidden
            border-2 ${dragOver ? 'border-indigo-400 bg-indigo-500/5 animate-border-dance' : 'border-dashed border-indigo-300/40 hover:border-indigo-400/60'}
          `}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Subtle background glow on hover */}
          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />

          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300
            bg-gradient-to-br from-indigo-500/20 to-purple-500/20
            ${dragOver ? 'animate-pulse-glow scale-110' : 'group-hover:scale-105'}
          `}>
            <Upload className={`w-9 h-9 text-indigo-400 transition-transform duration-300 ${dragOver ? 'scale-110' : 'group-hover:-translate-y-1'}`} />
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">
              {dragOver ? 'Пуснете тук!' : 'Кликнете за качване или плъзнете и пуснете'}
            </p>
            <p className="text-sm text-gray-400 mt-1">Само PDF файлове · Поддържат се Stripe фактури</p>
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="btn-glow px-8 py-2.5 rounded-xl text-sm font-bold text-white
              bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400"
          >
            Изберете PDF
          </button>

          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
        </div>
      )}

      {/* ── ERROR ── */}
      {errorMsg && (
        <div className="mt-4 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 animate-fade-up">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">Нещо се обърка</p>
            <p className="text-xs text-red-500 mt-0.5">{errorMsg}</p>
          </div>
          <button onClick={reset} className="text-xs text-red-400 hover:text-red-600 underline">Затвори</button>
        </div>
      )}

      {/* ── FILE LOADED ── */}
      {file && (
        <div className="flex flex-col gap-6 animate-fade-up">

          {/* Top bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                <FileText className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="text-sm font-medium text-gray-700 truncate max-w-xs">{file.name}</span>
              <span className="text-xs text-gray-400">— {(file.size / 1024).toFixed(1)} KB</span>
            </div>
            <div className="flex items-center gap-3">
              {status === 'generated' && invoiceData && (
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="btn-green-glow flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white
                    bg-gradient-to-r from-emerald-500 to-teal-500 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {downloading ? 'Генериране…' : 'Изтегли PDF'}
                </button>
              )}
              <button onClick={reset} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100">
                <X className="w-3.5 h-3.5" /> Премахни
              </button>
            </div>
          </div>

          {/* Two-column area */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* LEFT — Stripe PDF */}
            <div className="w-full lg:w-1/2 shrink-0 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Stripe Фактура</span>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-xl shadow-indigo-100 border border-gray-100">
                <PdfViewer file={file} />
              </div>
            </div>

            {/* RIGHT — Bulgarian invoice */}
            <div className="w-full lg:w-1/2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Българска Фактура</span>
              </div>

              {/* Extracting */}
              {status === 'extracting' && (
                <div className="animate-scale-in rounded-2xl overflow-hidden border border-indigo-100 shadow-lg shadow-indigo-50">
                  {/* Shimmer header */}
                  <div className="animate-shimmer bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500 p-4 text-white text-center">
                    <div className="flex items-center justify-center gap-2 font-bold text-sm tracking-wide">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                      AI чете вашата фактура
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                  </div>
                  <div className="bg-white p-8 flex flex-col items-center gap-6">
                    {/* Spinning ring */}
                    <div className="relative w-20 h-20">
                      <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
                      <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-purple-400 animate-spin-slow" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Wand2 className="w-6 h-6 text-indigo-400 animate-pulse" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 mb-1 animate-fade-in" key={aiStep}>
                        {AI_STEPS[aiStep]}
                      </p>
                      <div className="flex gap-1 justify-center mt-3">
                        {AI_STEPS.map((_, i) => (
                          <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === aiStep ? 'w-6 bg-indigo-500' : 'w-2 bg-indigo-200'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Extracted — editable form before generate */}
              {status === 'extracted' && invoiceData && (
                <div className="animate-scale-in rounded-2xl overflow-hidden border border-emerald-100 shadow-lg shadow-emerald-50">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      Данните са извлечени — прегледайте и редактирайте при нужда
                    </div>
                  </div>

                  <div className="bg-white p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">

                    {/* Section: Фактура */}
                    <EditSection title="Фактура">
                      <div className="grid grid-cols-2 gap-3">
                        <EditField label="Номер" value={invoiceData.invoiceNumber} onChange={v => setInvoiceData(d => d && ({ ...d, invoiceNumber: v }))} />
                        <EditField label="Дата" value={invoiceData.invoiceDate} onChange={v => setInvoiceData(d => d && ({ ...d, invoiceDate: v }))} />
                        <EditField label="Дата на данъчно събитие" value={invoiceData.taxEventDate} onChange={v => setInvoiceData(d => d && ({ ...d, taxEventDate: v }))} />
                        <EditField label="Място на съставяне" value={invoiceData.location} onChange={v => setInvoiceData(d => d && ({ ...d, location: v }))} />
                        <EditField label="Валута" value={invoiceData.currency} onChange={v => setInvoiceData(d => d && ({ ...d, currency: v }))} />
                      </div>
                    </EditSection>

                    {/* Section: Доставчик */}
                    <EditSection title="Доставчик (Продавач)">
                      <div className="grid grid-cols-2 gap-3">
                        <EditField label="Наименование" value={invoiceData.sellerName} onChange={v => setInvoiceData(d => d && ({ ...d, sellerName: v }))} className="col-span-2" />
                        <EditField label="ЕИК" value={invoiceData.sellerEik} onChange={v => setInvoiceData(d => d && ({ ...d, sellerEik: v }))} />
                        <EditField label="ДДС номер" value={invoiceData.sellerVatNumber} onChange={v => setInvoiceData(d => d && ({ ...d, sellerVatNumber: v }))} />
                        <EditField label="Град" value={invoiceData.sellerCity} onChange={v => setInvoiceData(d => d && ({ ...d, sellerCity: v }))} />
                        <EditField label="Адрес" value={invoiceData.sellerAddress} onChange={v => setInvoiceData(d => d && ({ ...d, sellerAddress: v }))} />
                        <EditField label="МОЛ" value={invoiceData.sellerMol} onChange={v => setInvoiceData(d => d && ({ ...d, sellerMol: v }))} className="col-span-2" />
                      </div>
                    </EditSection>

                    {/* Section: Получател */}
                    <EditSection title="Получател (Купувач)">
                      <div className="grid grid-cols-2 gap-3">
                        <EditField label="Наименование" value={invoiceData.buyerName} onChange={v => setInvoiceData(d => d && ({ ...d, buyerName: v }))} className="col-span-2" />
                        <EditField label="ЕИК" value={invoiceData.buyerEik} onChange={v => setInvoiceData(d => d && ({ ...d, buyerEik: v }))} />
                        <EditField label="ДДС номер" value={invoiceData.buyerVatNumber} onChange={v => setInvoiceData(d => d && ({ ...d, buyerVatNumber: v }))} />
                        <EditField label="Град" value={invoiceData.buyerCity} onChange={v => setInvoiceData(d => d && ({ ...d, buyerCity: v }))} />
                        <EditField label="Адрес" value={invoiceData.buyerAddress} onChange={v => setInvoiceData(d => d && ({ ...d, buyerAddress: v }))} />
                        <EditField label="МОЛ" value={invoiceData.buyerMol} onChange={v => setInvoiceData(d => d && ({ ...d, buyerMol: v }))} className="col-span-2" />
                      </div>
                    </EditSection>

                    {/* Section: Артикули */}
                    <EditSection title="Артикули">
                      <div className="flex flex-col gap-3">
                        {invoiceData.lineItems.map((item, idx) => (
                          <div key={idx} className="border border-gray-100 rounded-xl p-3 bg-gray-50 flex flex-col gap-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ред {idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => setInvoiceData(d => d && ({ ...d, lineItems: d.lineItems.filter((_, i) => i !== idx) }))}
                                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Премахни
                              </button>
                            </div>
                            <EditField label="Описание" value={item.description} onChange={v => setInvoiceData(d => d && ({ ...d, lineItems: d.lineItems.map((li, i) => i === idx ? { ...li, description: v } : li) }))} />
                            <div className="grid grid-cols-2 gap-2">
                              <EditField label="Мярка" value={item.unit} onChange={v => setInvoiceData(d => d && ({ ...d, lineItems: d.lineItems.map((li, i) => i === idx ? { ...li, unit: v } : li) }))} />
                              <EditField label="Количество" value={item.quantity} onChange={v => setInvoiceData(d => d && ({ ...d, lineItems: d.lineItems.map((li, i) => i === idx ? { ...li, quantity: v } : li) }))} />
                              <EditField label="Ед. цена" value={item.unitPrice} onChange={v => setInvoiceData(d => d && ({ ...d, lineItems: d.lineItems.map((li, i) => i === idx ? { ...li, unitPrice: v } : li) }))} />
                              <EditField label="ДДС %" value={item.vatPercent} onChange={v => setInvoiceData(d => d && ({ ...d, lineItems: d.lineItems.map((li, i) => i === idx ? { ...li, vatPercent: v } : li) }))} />
                              <EditField label="Стойност" value={item.value} onChange={v => setInvoiceData(d => d && ({ ...d, lineItems: d.lineItems.map((li, i) => i === idx ? { ...li, value: v } : li) }))} className="col-span-2" />
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setInvoiceData(d => d && ({ ...d, lineItems: [...d.lineItems, { description: '', unit: 'бр.', quantity: '1', unitPrice: '0.00', vatPercent: '20', value: '0.00' }] }))}
                          className="text-xs text-indigo-500 hover:text-indigo-700 border border-dashed border-indigo-300 rounded-xl py-2 px-4 hover:bg-indigo-50 transition-colors"
                        >
                          + Добави ред
                        </button>
                      </div>
                    </EditSection>

                    {/* Section: Суми */}
                    <EditSection title="Суми">
                      <div className="grid grid-cols-2 gap-3">
                        <EditField label="Данъчна основа" value={invoiceData.subtotal} onChange={v => setInvoiceData(d => d && ({ ...d, subtotal: v }))} />
                        <EditField label="ДДС сума" value={invoiceData.vatAmount} onChange={v => setInvoiceData(d => d && ({ ...d, vatAmount: v }))} />
                        <EditField label="Общо за плащане" value={invoiceData.total} onChange={v => setInvoiceData(d => d && ({ ...d, total: v }))} className="col-span-2" />
                        <EditField label="Сума с думи" value={invoiceData.totalInWords} onChange={v => setInvoiceData(d => d && ({ ...d, totalInWords: v }))} className="col-span-2" />
                      </div>
                    </EditSection>

                    <button
                      onClick={() => setStatus('generated')}
                      className="btn-glow w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white
                        bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400"
                    >
                      <FileOutput className="w-5 h-5" />
                      Генерирай Българска Фактура
                    </button>
                  </div>
                </div>
              )}

              {/* Generated invoice */}
              {status === 'generated' && invoiceData && (
                <div className="animate-scale-in flex flex-col gap-4">
                  <div className="rounded-2xl overflow-x-auto shadow-xl shadow-indigo-100/50 border border-gray-100">
                    <div style={{ minWidth: 794 }}>
                      <BulgarianInvoice ref={invoiceRef} data={invoiceData} />
                    </div>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="btn-green-glow w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white
                      bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
                  >
                    {downloading
                      ? <><Loader2 className="w-5 h-5 animate-spin" /> Генериране на PDF…</>
                      : <><Download className="w-5 h-5" /> Изтегли Българска Фактура (PDF)</>
                    }
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceUploader;
