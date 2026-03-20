'use client';

import React from 'react';
import { Bot, Highlighter, Loader2, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export type Match = {
  text: string;
  page: number;
  start?: number;
  end?: number;
};

export type ChatMessage = {
  id: number;
  text: string;
  fromUser: boolean;
  isGrounded?: boolean;
  groundingText?: string;
  matches?: Match[];
  found?: boolean;
};

export function ChatPanel({
  appState,
  chatInput,
  chatMessages,
  chatEndRef,
  onChatInputChange,
  onSubmit,
  onHighlight,
  isChatting,
}: {
  appState: 'INITIAL' | 'UPLOADING' | 'READY' | 'CHATTING';
  chatInput: string;
  chatMessages: ChatMessage[];
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  onChatInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onHighlight: (match: Match) => Promise<void>;
  isChatting: boolean;
}) {
  return (
    <Card className="flex min-h-[420px] flex-col border-white/10 bg-slate-900/70">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="flex items-center gap-2 text-slate-100">
          <Bot className="h-4 w-4 text-cyan-300" />
          Document Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {chatMessages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              Upload a PDF to start asking grounded questions.
            </div>
          ) : null}

          {chatMessages.map((message) => {
            const bestMatch = message.matches?.[0];
            return (
              <div
                key={message.id}
                className={`flex ${message.fromUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm shadow-lg ${
                    message.fromUser
                      ? 'bg-cyan-500 text-slate-950'
                      : 'border border-white/10 bg-white/5 text-slate-100'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                  {message.isGrounded && message.groundingText ? (
                    <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">
                      &quot;{message.groundingText}&quot;
                    </div>
                  ) : null}
                  {message.found === false && !message.fromUser ? (
                    <p className="mt-2 text-xs text-amber-200">
                      Retrieval did not find a direct answer in the indexed text.
                    </p>
                  ) : null}
                  {bestMatch && !message.fromUser ? (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                      <span>Best match: page {bestMatch.page + 1}</span>
                      <Button className="h-8 px-3 py-0 text-xs" onClick={() => void onHighlight(bestMatch)}>
                        <Highlighter className="mr-1 h-3.5 w-3.5" />
                        Highlight
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {isChatting ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
                  Searching chunks and generating an answer...
                </div>
              </div>
            </div>
          ) : null}

          <div ref={chatEndRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-white/10 pt-4">
          <input
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/50"
            placeholder={appState === 'READY' ? 'Ask a precise question about the PDF...' : 'Waiting for indexing...'}
            value={chatInput}
            onChange={(event) => onChatInputChange(event.target.value)}
            disabled={appState !== 'READY'}
          />
          <Button type="submit" disabled={!chatInput.trim() || appState !== 'READY'} className="px-4">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
