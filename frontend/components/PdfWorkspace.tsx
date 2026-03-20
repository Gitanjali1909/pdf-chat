'use client';

import { FileDown, FileText, Loader2, PanelRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function PdfWorkspace({
  fileUrl,
  summary,
  isUploading,
  isChatting,
  title,
}: {
  fileUrl: string | null;
  summary: string[];
  isUploading: boolean;
  isChatting: boolean;
  title: string;
}) {
  return (
    <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_380px]">
      <Card className="min-h-[520px] overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.92))]">
        <CardHeader className="border-b border-white/10 bg-black/10">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-slate-100">
              <PanelRight className="h-4 w-4 text-cyan-300" />
              PDF Preview
            </CardTitle>
            {fileUrl ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/20"
              >
                <FileDown className="h-3.5 w-3.5" />
                Open / Download PDF
              </a>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="h-[calc(100%-73px)] p-0">
          {fileUrl ? (
            <div className="relative h-[70vh] min-h-[460px] overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.08),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.7),rgba(2,6,23,0.95))] p-5">
              <div className="pointer-events-none absolute inset-x-10 top-0 h-20 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-x-16 bottom-6 h-16 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative mx-auto flex h-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/75 shadow-[0_40px_120px_rgba(0,0,0,0.45)] ring-1 ring-white/5 backdrop-blur">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  </div>
                  <div className="max-w-[60%] truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                    {title}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-3">
                  <div className="h-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-900">
                    <iframe
                      src={fileUrl}
                      title={title}
                      className="pdf-preview-frame h-full w-full bg-slate-950"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[70vh] min-h-[460px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.8),rgba(2,6,23,0.95))] text-slate-400">
              {isUploading ? (
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 shadow-lg backdrop-blur">
                  <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
                  Preparing preview...
                </div>
              ) : (
                'No PDF loaded yet.'
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.92))]">
        <CardHeader className="border-b border-white/10 bg-black/10">
          <CardTitle className="flex items-center gap-2 text-slate-100">
            <FileText className="h-4 w-4 text-emerald-300" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary.length === 0 ? (
            <p className="text-sm text-slate-400">
              {isUploading || isChatting ? 'Preparing summary...' : 'Summary will appear here after upload.'}
            </p>
          ) : (
            summary.map((point, index) => (
              <div
                key={`${index}-${point.slice(0, 16)}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm leading-6 text-slate-200"
              >
                <span className="mr-2 font-semibold text-cyan-300">{String(index + 1).padStart(2, '0')}</span>
                {point}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
