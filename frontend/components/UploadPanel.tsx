'use client';

import React from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

type AppState = 'INITIAL' | 'UPLOADING' | 'READY' | 'CHATTING';

export function UploadPanel({
  appState,
  pdfFile,
  fileInputRef,
  onFileUpload,
  isUploading,
}: {
  appState: AppState;
  pdfFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isUploading: boolean;
}) {
  return (
    <Card className="border-white/10 bg-slate-900/70">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <Upload className="h-4 w-4 text-cyan-300" />
          Upload PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <section
          className={`cursor-pointer rounded-3xl border border-dashed p-8 text-center transition ${
            isUploading
              ? 'border-cyan-400/40 bg-cyan-400/10'
              : 'border-white/15 bg-white/5 hover:border-cyan-400/40 hover:bg-cyan-400/5'
          }`}
          onClick={() => {
            if (!isUploading) {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={onFileUpload}
            disabled={isUploading}
          />
          {isUploading ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-300" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-200">Uploading, parsing, embedding, and summarizing...</p>
                <Progress value={72} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="mx-auto h-8 w-8 text-cyan-300" />
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {pdfFile ? pdfFile.name : 'Choose a PDF'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Upload a text-based PDF to generate a summary and grounded answers.
                </p>
              </div>
            </div>
          )}
        </section>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
          State: {appState}
        </div>
      </CardContent>
    </Card>
  );
}
