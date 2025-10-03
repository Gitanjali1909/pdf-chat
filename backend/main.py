import os
import uuid
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import aiofiles
import fitz
from sentence_transformers import SentenceTransformer
import chromadb
from dotenv import load_dotenv
import numpy as np

load_dotenv()

OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
REFERER = "http://localhost:3000"
X_TITLE = "pdf-chat-app"

UPLOAD_DIR = "./uploads"
CHROMA_DIR = "./chroma_db"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

EMBED_MODEL = "all-MiniLM-L6-v2"
LLM_MODEL = "openrouter/auto"

app = FastAPI(title="pdf-chat-backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

embed_model = SentenceTransformer(EMBED_MODEL)

chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
try:
    collection = chroma_client.get_collection("pdf_collection")
except Exception:
    collection = chroma_client.create_collection(name="pdf_collection")

def chunk_text_by_chars(text, chunk_size=1000, overlap=200):
    chunks = []
    text = text.strip()
    if not text:
        return chunks
    start = 0
    L = len(text)
    while start < L:
        end = min(start + chunk_size, L)
        chunk = text[start:end]
        chunks.append((start, end, chunk))
        start += chunk_size - overlap
    return chunks

async def save_upload(upload: UploadFile, dest_path: str):
    async with aiofiles.open(dest_path, "wb") as out_file:
        content = await upload.read()
        await out_file.write(content)

def extract_pages(file_path: str):
    doc = fitz.open(file_path)
    pages = []
    for i in range(doc.page_count):
        page = doc.load_page(i)
        txt = page.get_text("text")
        pages.append({"page": i, "text": txt})
    return pages

def summarize_with_openrouter(text: str, bullets: int = 5):
    if not OPENAI_KEY:
        return "⚠️ OPENAI_API_KEY missing."
    prompt = f"Summarize the following text into {bullets} concise bullet points:\n\n{text}"
    headers = {
        "Authorization": f"Bearer {OPENAI_KEY}",
        "HTTP-Referer": REFERER,
        "X-Title": X_TITLE,
        "Content-Type": "application/json"
    }
    data = {
        "model": LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 300,
        "temperature": 0.2,
    }
    try:
        resp = requests.post(f"{OPENROUTER_BASE_URL}/chat/completions", json=data, headers=headers, timeout=60)
        print("DEBUG: OpenRouter response:", resp.text)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print("ERROR calling OpenRouter:", e)
        return f"❌ OpenRouter error: {e}"

def chat_with_openrouter(context: str, query: str):
    if not OPENAI_KEY:
        return "⚠️ OPENAI_API_KEY missing."
    prompt = f"Answer the question based only on the context below. If not found, reply: 'Not present in the PDF.'\n\nContext:\n{context}\n\nQuestion: {query}"
    headers = {
        "Authorization": f"Bearer {OPENAI_KEY}",
        "HTTP-Referer": REFERER,
        "X-Title": X_TITLE,
        "Content-Type": "application/json"
    }
    data = {
        "model": LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 400,
        "temperature": 0,
    }
    try:
        resp = requests.post(f"{OPENROUTER_BASE_URL}/chat/completions", json=data, headers=headers, timeout=60)
        print("DEBUG: OpenRouter response:", resp.text)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print("ERROR calling OpenRouter (chat):", e)
        return f"❌ OpenRouter error: {e}"

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        if file.content_type != "application/pdf":
            raise HTTPException(400, "Only PDF files allowed.")
        file_id = str(uuid.uuid4())
        save_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
        await save_upload(file, save_path)
        pages = extract_pages(save_path)
        if not any(p["text"].strip() for p in pages):
            return {"file_id": file_id, "error": "No text found (scanned PDF?)"}
        chunks = []
        for p in pages:
            for start, end, txt in chunk_text_by_chars(p["text"]):
                if txt.strip():
                    chunks.append({"page": p["page"], "start": start, "end": end, "text": txt})
        texts = [c["text"] for c in chunks]
        embeddings = embed_model.encode(texts, convert_to_numpy=True)
        ids = [f"{file_id}_{i}" for i in range(len(texts))]
        metadatas = [{"page": c["page"], "start": c["start"], "end": c["end"], "file": file.filename} for c in chunks]
        collection.add(documents=texts, embeddings=embeddings.tolist(), metadatas=metadatas, ids=ids)
        sample_text = "\n\n".join(texts[:3])
        summary = summarize_with_openrouter(sample_text, bullets=5)
        return {"file_id": file_id, "summary": summary, "chunks_indexed": len(texts)}
    except Exception as e:
        print("ERROR in /upload:", e)
        raise HTTPException(500, f"Upload failed: {e}")

@app.post("/chat")
async def chat(file_id: str = Form(...), query: str = Form(...), top_k: int = Form(3)):
    local_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    if not os.path.exists(local_path):
        raise HTTPException(404, "file_id not found")
    q_emb = embed_model.encode([query], convert_to_numpy=True).tolist()[0]
    results = collection.query(query_embeddings=[q_emb], n_results=top_k, include=["documents", "metadatas"])
    docs = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    context = "\n\n".join([f"[Page {m['page']}] {d}" for d, m in zip(docs, metadatas)])
    llm_answer = chat_with_openrouter(context, query)
    matches = [{"text": d, "page": m["page"]} for d, m in zip(docs, metadatas)]
    return {"answer": llm_answer, "matches": matches}

@app.post("/highlight")
async def highlight(file_id: str = Form(...), page: int = Form(...), snippet: str = Form(...)):
    path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(404, "file_id not found")
    doc = fitz.open(path)
    pg = doc.load_page(page)
    rects = pg.search_for(snippet)
    for r in rects:
        pg.add_highlight_annot(r)
    out_path = os.path.join(UPLOAD_DIR, f"{file_id}_highlighted.pdf")
    doc.save(out_path)
    return FileResponse(out_path, media_type="application/pdf", filename=os.path.basename(out_path))
