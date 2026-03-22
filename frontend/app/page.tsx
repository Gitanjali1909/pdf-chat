'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileSearch, Loader2, Sparkles } from 'lucide-react';
import { ChatPanel, type ChatMessage, type Match } from '../components/ChatPanel';
import { PdfWorkspace } from '../components/PdfWorkspace';
import { UploadPanel } from '../components/UploadPanel';
import { chatPDF, highlightPDF, uploadPDF, type UploadResponse } from '../utils/api';

type AppState = 'INITIAL' | 'UPLOADING' | 'READY' | 'CHATTING';

let messageIdCounter = 0;

export default function PDFQASummaryApp() {
  const [isClient, setIsClient] = useState(false);
  const [appState, setAppState] = useState<AppState>('INITIAL');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [summary, setSummary] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const isUploading = appState === 'UPLOADING';
  const isChatting = appState === 'CHATTING';

  const workspaceTitle = useMemo(() => {
    if (!pdfFile) {
      return 'Upload a PDF to start';
    }
    return pdfFile.name;
  }, [pdfFile]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      return;
    }

    setPdfFile(file);
    setAppState('UPLOADING');
    setUploadError('');
    setSummary([]);
    setChatMessages([]);
    setFileId(null);
    setFileUrl(null);
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const data: UploadResponse = await uploadPDF(file);
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://pdf-chat-1.onrender.com';
      setFileId(data.file_id);
      setFileUrl(data.file_url ? `${baseUrl}${data.file_url}` : `${baseUrl}/files/${data.file_id}`);
      setSummary(data.summary ?? []);
      setChatMessages([
        {
          id: messageIdCounter++,
          text: `Indexed ${data.chunks_indexed} chunks from this PDF. Ask a question when you are ready.`,
          fromUser: false,
          isGrounded: true,
          found: true,
        },
      ]);
      setAppState('READY');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUploadError(message);
      setPdfFile(null);
      setAppState('INITIAL');
    }
  };

  const handleChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userQuery = chatInput.trim();
    if (!userQuery || appState !== 'READY' || !fileId) {
      return;
    }

    setChatMessages((messages) => [
      ...messages,
      { id: messageIdCounter++, text: userQuery, fromUser: true, found: true },
    ]);
    setChatInput('');
    setAppState('CHATTING');

    try {
      const data = await chatPDF(fileId, userQuery);
      const botResponse: ChatMessage = {
        id: messageIdCounter++,
        text: data.answer || 'I could not find an answer in the document.',
        fromUser: false,
        isGrounded: Boolean(data.found && data.grounding_text),
        groundingText: data.grounding_text ?? undefined,
        matches: data.matches,
        found: data.found,
      };

      setChatMessages((messages) => [...messages, botResponse]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChatMessages((messages) => [
        ...messages,
        {
          id: messageIdCounter++,
          text: message,
          fromUser: false,
          isGrounded: false,
          found: false,
        },
      ]);
    } finally {
      setAppState('READY');
    }
  };

  const handleHighlight = async (match: Match) => {
    if (!fileId) {
      return;
    }

    try {
      const pdfBlob = await highlightPDF(fileId, match.page, match.text);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pdfFile?.name?.replace(/\.pdf$/i, '') ?? 'document'}-highlighted.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setUploadError(message);
    }
  };

  if (!isClient) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-4 lg:px-6">
        <header className="mb-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-cyan-300">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs uppercase tracking-[0.3em]">PDF Intelligence Workspace</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Summarize, inspect, and chat with your PDF</h1>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="flex min-h-[540px] flex-col gap-4">
            <UploadPanel
              appState={appState}
              pdfFile={pdfFile}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
              isUploading={isUploading}
            />
            <ChatPanel
              appState={appState}
              chatInput={chatInput}
              chatMessages={chatMessages}
              chatEndRef={chatEndRef}
              onChatInputChange={setChatInput}
              onSubmit={handleChatSubmit}
              onHighlight={handleHighlight}
              isChatting={isChatting}
            />
          </aside>

          <section className="flex min-h-[540px] flex-col gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-slate-400">
                    <FileSearch className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-[0.25em]">Workspace</span>
                  </div>
                  <h2 className="text-xl font-medium">{workspaceTitle}</h2>
                </div>
                {uploadError ? (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {uploadError}
                  </div>
                ) : null}
              </div>
            </div>

            <PdfWorkspace
              fileUrl={fileUrl ?? previewUrl}
              summary={summary}
              isUploading={isUploading}
              isChatting={isChatting}
              title={workspaceTitle}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
