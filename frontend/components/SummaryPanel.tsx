'use client';

import React from 'react';
import { FileText } from 'lucide-react';
import { Card } from './ui';

export function SummaryPanel({
  summary,
  isProcessing,
}: {
  summary: string[];
  isProcessing: boolean;
}) {
  return (
    <Card
      title="Main Insights"
      icon={<FileText className="h-5 w-5 text-emerald-700" />}
      className="flex-grow"
    >
      <div className="max-h-[500px] overflow-y-auto pr-2">
        <ul className="list-disc space-y-2 pl-4">
          {summary.length === 0 && isProcessing ? (
            <li className="italic text-stone-500">Extracting insights from your PDF...</li>
          ) : (
            summary.map((point, index) => (
              <li key={`${index}-${point.slice(0, 20)}`} className="text-sm leading-relaxed text-stone-700">
                {point}
              </li>
            ))
          )}
        </ul>
      </div>
    </Card>
  );
}
