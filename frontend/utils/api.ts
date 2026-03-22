const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://pdf-chat-1.onrender.com';

export type UploadResponse = {
  file_id: string;
  summary: string[];
  summary_text?: string;
  chunks_indexed: number;
  error?: string;
  provider?: string;
  model?: string;
  file_url?: string;
};

export type ChatMatch = {
  text: string;
  page: number;
  start?: number;
  end?: number;
};

export type ChatResponse = {
  answer: string;
  matches: ChatMatch[];
  grounding_text?: string | null;
  found?: boolean;
  provider?: string;
  model?: string;
};

export async function uploadPDF(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    let detail = err;
    try {
      const parsed = JSON.parse(err);
      detail = parsed.detail ?? err;
    } catch {}
    throw new Error('Upload failed: ' + detail);
  }
  return res.json();
}

export async function chatPDF(file_id: string, query: string): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append('file_id', file_id);
  formData.append('query', query);

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    let detail = err;
    try {
      const parsed = JSON.parse(err);
      detail = parsed.detail ?? err;
    } catch {}
    throw new Error('Chat failed: ' + detail);
  }
  return res.json();
}

export async function highlightPDF(file_id: string, page: number, snippet: string) {
  const formData = new FormData();
  formData.append('file_id', file_id);
  formData.append('page', String(page));
  formData.append('snippet', snippet);

  const res = await fetch(`${API_BASE_URL}/highlight`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    let detail = err;
    try {
      const parsed = JSON.parse(err);
      detail = parsed.detail ?? err;
    } catch {}
    throw new Error('Highlight failed: ' + detail);
  }
  return res.blob();
}
