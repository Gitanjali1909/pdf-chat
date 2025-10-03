export async function uploadPDF(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("http://127.0.0.1:8000/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Upload failed: " + err);
  }
  return await res.json(); 
}

export async function chatPDF(file_id: string, query: string) {
  const res = await fetch("http://127.0.0.1:8000/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, query }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Chat failed: " + err);
  }
  return await res.json(); 
}

export async function highlightPDF(file_id: string, page: number, snippet: string) {
  const res = await fetch("http://127.0.0.1:8000/highlight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id, page, snippet }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Highlight failed: " + err);
  }
  return await res.blob(); 
}
