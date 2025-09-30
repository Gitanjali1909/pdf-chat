// utils/api.ts
export async function uploadPDF(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("http://127.0.0.1:8000/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");
  return await res.json(); // { file_id, summary, chunks_indexed }
}

export async function chatPDF(file_id: string, query: string) {
  const formData = new FormData();
  formData.append("file_id", file_id);
  formData.append("query", query);

  const res = await fetch("http://127.0.0.1:8000/chat", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Chat failed");
  return await res.json(); 
}

export async function highlightPDF(file_id: string, page: number, snippet: string) {
  const formData = new FormData();
  formData.append("file_id", file_id);
  formData.append("page", page.toString());
  formData.append("snippet", snippet);

  const res = await fetch("http://127.0.0.1:8000/highlight", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Highlight failed");
  return await res.blob(); 
}
