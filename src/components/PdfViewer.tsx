'use client';

import React, { useState } from 'react';
import { FileText } from 'lucide-react';

interface PdfViewerProps {
  file: File;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [url] = useState(() => URL.createObjectURL(file));

  return (
    <div className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-md bg-white">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
        <FileText className="w-5 h-5 text-red-500" />
        <span className="text-sm font-medium text-gray-700 truncate">{file.name}</span>
      </div>
      <iframe
        src={url}
        className="w-full"
        style={{ height: '600px' }}
        title="Invoice PDF"
      />
    </div>
  );
};

export default PdfViewer;
