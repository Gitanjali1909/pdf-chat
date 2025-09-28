'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Send, FileText, Bot, Loader2 } from 'lucide-react';

// --- Types ---
type ChatMessage = {
  id: number;
  text: string;
  fromUser: boolean;
  isGrounded?: boolean;
  groundingText?: string;
};

type AppState = 'INITIAL' | 'PROCESSING' | 'READY';

// --- Simulated Data ---
const simulatedSummary = [
  'The Q4 report highlights a 15% growth in cloud computing division.',
  'Key finding: Remote work policies boosted employee productivity by 7% in Q1.',
  'The primary risk factor identified is increased energy costs affecting supply chain.',
  'Recommendation: Prioritize investment in Asian markets for the next fiscal year.',
  'Summary conclusion: Overall positive outlook, contingent on market stability and labor costs.',
  'Customer satisfaction scores increased by 12% across enterprise clients.',
  'The marketing division reduced ad spend while improving ROI by 9%.',
  'Supply chain delays are expected due to geopolitical tensions.',
  'Employee retention rate improved by 5% after new training initiatives.',
  'Strong pipeline of partnerships projected for the next 2 quarters.'
];

const simulatedQnAMap: { [key: string]: ChatMessage } = {
  growth: {
    id: 100,
    text: 'The cloud computing division showed a substantial 15% growth, driven by key enterprise contracts signed in the last quarter.',
    fromUser: false,
    isGrounded: true,
    groundingText: 'The Q4 report highlights a 15% growth in cloud computing division.'
  },
  risk: {
    id: 101,
    text: 'The report identifies that increased energy costs pose a risk to the global supply chain, which could impact production margins next quarter.',
    fromUser: false,
    isGrounded: true,
    groundingText: 'The primary risk factor identified is increased energy costs.'
  },
  unrelated: {
    id: 102,
    text: 'That specific detail is not found within the context of the uploaded financial report.',
    fromUser: false,
    isGrounded: false
  }
};

let messageIdCounter = 0;

// --- Main Component ---
export default function PDFQASummaryApp() {
  const [isClient, setIsClient] = useState(false);
  const [appState, setAppState] = useState<AppState>('INITIAL');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      return console.error('Please upload a valid PDF file.');
    }

    setPdfFile(file);
    setAppState('PROCESSING');
    setSummary([]);
    setChatMessages([]);

    setTimeout(() => {
      setSummary(simulatedSummary);
      setChatMessages([
        {
          id: messageIdCounter++,
          text: `PDF "${file.name}" uploaded. Summary and QA engine is now ready!`,
          fromUser: false
        }
      ]);
      setAppState('READY');
    }, 2000);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const userQuery = chatInput.trim();
    if (!userQuery || appState !== 'READY') return;

    setChatMessages((msgs) => [
      ...msgs,
      { id: messageIdCounter++, text: userQuery, fromUser: true }
    ]);
    setChatInput('');

    setTimeout(() => {
      const queryLower = userQuery.toLowerCase();
      let botResponseData: ChatMessage;

      if (queryLower.includes('growth') || queryLower.includes('percent')) {
        botResponseData = simulatedQnAMap['growth'];
      } else if (queryLower.includes('risk') || queryLower.includes('cost')) {
        botResponseData = simulatedQnAMap['risk'];
      } else {
        botResponseData = simulatedQnAMap['unrelated'];
      }

      botResponseData.id = messageIdCounter++;
      setChatMessages((msgs) => [...msgs, botResponseData]);
    }, 1200);
  };

  // --- UI Helpers ---
  const Card = ({
    title,
    icon,
    children,
    className = ''
  }: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg transition-all duration-300 ${className}`}
    >
      <div className="flex items-center space-x-2 p-4 border-b border-gray-200 dark:border-gray-700">
        {icon}
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50">
          {title}
        </h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  const Button = ({
    children,
    onClick,
    disabled = false,
    className = ''
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent | React.FormEvent) => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-medium transition-all duration-300
        bg-indigo-600 text-white shadow hover:bg-indigo-700 
        disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );

  const InputField = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className={`flex-grow rounded-lg border border-gray-300 dark:border-gray-700 
        bg-white dark:bg-gray-800 px-3 py-2 text-sm 
        focus:outline-none focus:ring-2 focus:ring-indigo-500 
        focus:border-indigo-500 transition-colors`}
    />
  );

  if (!isClient) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </main>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-950">
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Heading */}
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-5xl font-bold text-indigo-700 dark:text-indigo-300">
            PDF Quick Reader
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Upload your PDF, get instant insights, and chat with it.
          </p>
        </header>

        {/* Upload Section */}
        <Card
          title="Upload Document"
          icon={
            <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          }
        >
          <section
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
              appState === 'PROCESSING'
                ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
                : 'border-indigo-300 hover:border-indigo-500 dark:border-gray-600 dark:hover:border-indigo-400'
            }`}
            onClick={() => {
  if (appState === 'INITIAL' || appState === 'READY') {
    fileInputRef.current?.click();
  }
}}
          >
            {appState === 'PROCESSING' ? (
              <div className="flex flex-col items-center">
                <Loader2 className="mx-auto mb-2 w-8 h-8 text-yellow-600 animate-spin" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Processing PDF...
                </p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-3 w-8 h-8 text-indigo-500" />
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={appState === 'PROCESSING'}
                />
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  {pdfFile ? pdfFile.name : 'Click or Drag PDF Here'}
                </p>
              </>
            )}
          </section>
        </Card>

        {/* Summary + Chat */}
        {pdfFile && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
            {/* Summary */}
            <div className="lg:col-span-1 flex flex-col">
              <Card
                title="Main Insights"
                icon={
                  <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                }
                className="flex-grow"
              >
                <div className="max-h-[500px] overflow-y-auto pr-2 space-y-2">
                  <ul className="list-disc pl-4 space-y-2">
                    {summary.length === 0 ? (
                      <li className="italic text-gray-500">
                        Extracting insights from your PDF...
                      </li>
                    ) : (
                      summary.map((point, idx) => (
                        <li
                          key={idx}
                          className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed"
                        >
                          {point}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </Card>
            </div>

            {/* Chat */}
            <div className="lg:col-span-2 flex flex-col">
              <Card
                title="Chat with Document"
                icon={
                  <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                }
                className="flex flex-col flex-grow"
              >
                <div className="flex flex-col flex-grow">
                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${
                          msg.fromUser ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] p-3 rounded-xl text-sm shadow 
                            ${
                              msg.fromUser
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                            }`}
                        >
                          <p>{msg.text}</p>
                          {msg.isGrounded && msg.groundingText && (
                            <div className="mt-2 text-xs bg-yellow-100 dark:bg-yellow-900/40 border-l-4 border-yellow-500 px-2 py-1 rounded">
                              <p className="italic">"{msg.groundingText}"</p>
                            </div>
                          )}
                          {!msg.isGrounded && !msg.fromUser && (
                            <p className="mt-1 text-xs text-red-500">
                              Not found in document.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <form
                    onSubmit={handleChatSubmit}
                    className="flex gap-2 mt-3 border-t border-gray-200 dark:border-gray-700 pt-3"
                  >
                    <InputField
                      placeholder={
                        appState === 'READY'
                          ? 'Ask something about the PDF...'
                          : 'Processing...'
                      }
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={appState !== 'READY'}
                    />
                    <Button
                      disabled={!chatInput.trim() || appState !== 'READY'}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
