import os
import traceback
import uuid

import aiofiles
import chromadb
import fitz
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sentence_transformers import SentenceTransformer
from transformers import pipeline

load_dotenv()

HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
HF_SUMMARY_MODEL = os.getenv("HF_SUMMARY_MODEL", "google/flan-t5-small")
HF_CHAT_MODEL = os.getenv("HF_CHAT_MODEL", "google/flan-t5-small")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

UPLOAD_DIR = "./uploads"
CHROMA_DIR = "./chroma_db"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

EMBED_MODEL = "all-MiniLM-L6-v2"

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

SUMMARY_PIPELINE = None
TEXT_PIPELINE = None


def masked_key(value: str):
    if not value:
        return "missing"
    if len(value) <= 10:
        return f"set(len={len(value)})"
    return f"{value[:6]}...{value[-4:]} (len={len(value)})"


def log_llm_configuration():
    print("LLM provider selected: provider=huggingface-local-first")


def get_collection():
    try:
        return chroma_client.get_collection("pdf_collection")
    except Exception as exc:
        print(f"Chroma get_collection failed: {exc}")
        print(traceback.format_exc())
        try:
            return chroma_client.create_collection(name="pdf_collection")
        except Exception as create_exc:
            print(f"Chroma create_collection failed: {create_exc}")
            print(traceback.format_exc())
            raise RuntimeError(f"ChromaDB collection initialization failed: {create_exc}") from create_exc


def chunk_text_by_chars(text, chunk_size=1000, overlap=200):
    chunks = []
    text = text.strip()
    if not text:
        return chunks
    start = 0
    text_length = len(text)
    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk = text[start:end]
        chunks.append((start, end, chunk))
        start += chunk_size - overlap
    return chunks


async def save_upload(upload: UploadFile, dest_path: str):
    async with aiofiles.open(dest_path, "wb") as out_file:
        content = await upload.read()
        await out_file.write(content)


def extract_pages(file_path: str):
    try:
        doc = fitz.open(file_path)
    except Exception as exc:
        raise RuntimeError(f"PyMuPDF could not open PDF: {exc}") from exc

    pages = []
    try:
        for i in range(doc.page_count):
            page = doc.load_page(i)
            text = page.get_text("text")
            pages.append({"page": i, "text": text})
    except Exception as exc:
        raise RuntimeError(f"PyMuPDF text extraction failed on page {i + 1}: {exc}") from exc
    finally:
        doc.close()
    return pages


def parse_summary_points(summary_text: str):
    points = []
    for line in summary_text.splitlines():
        cleaned = line.strip().lstrip("-").lstrip("*").strip()
        if cleaned:
            points.append(cleaned)
    return points or [summary_text.strip()]


def get_summary_pipeline():
    global SUMMARY_PIPELINE
    if SUMMARY_PIPELINE is None:
        SUMMARY_PIPELINE = pipeline(
            "summarization",
            model=HF_SUMMARY_MODEL,
            token=HF_TOKEN or None,
        )
    return SUMMARY_PIPELINE


def get_text_pipeline():
    global TEXT_PIPELINE
    if TEXT_PIPELINE is None:
        TEXT_PIPELINE = pipeline(
            "text2text-generation",
            model=HF_CHAT_MODEL,
            token=HF_TOKEN or None,
        )
    return TEXT_PIPELINE


def ollama_available():
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        return response.ok
    except Exception:
        return False


def call_ollama(prompt: str):
    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return (data.get("response") or "").strip(), "ollama", OLLAMA_MODEL


def summarize_document(text: str, bullets: int = 5):
    clipped = text[:3500]
    prompt = f"Summarize the following PDF text in {bullets} short bullet points:\n\n{clipped}"
    try:
        summarizer = get_summary_pipeline()
        result = summarizer(
            prompt,
            max_length=128,
            min_length=32,
            do_sample=False,
        )
        return result[0]["summary_text"].strip(), "huggingface", HF_SUMMARY_MODEL
    except Exception as exc:
        print(f"Summarization failed: {exc}")
        print(traceback.format_exc())
        if ollama_available():
            return call_ollama(prompt)
        raise RuntimeError(
            "Summarization failed and Ollama is not available. "
            "Set HF_TOKEN for gated models or start Ollama locally."
        ) from exc


def answer_question(context: str, query: str):
    prompt = (
        "Answer using only the PDF context. "
        "If the answer is not supported, reply exactly with: Not present in the PDF.\n\n"
        f"Context:\n{context[:5000]}\n\nQuestion: {query}\n\nAnswer:"
    )
    try:
        generator = get_text_pipeline()
        result = generator(
            prompt,
            max_new_tokens=160,
            do_sample=False,
        )
        generated = result[0]["generated_text"].strip()
        return generated, "huggingface", HF_CHAT_MODEL
    except Exception as exc:
        print(f"text-generation failed: {exc}")
        print(traceback.format_exc())
        if ollama_available():
            return call_ollama(prompt)
        raise RuntimeError(
            "text-generation failed and Ollama is not available. "
            "Set HF_TOKEN for gated models or start Ollama locally."
        ) from exc


log_llm_configuration()


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    try:
        print(
            f"/upload started: filename={file.filename}, content_type={file.content_type}, hf_token={masked_key(HF_TOKEN)}"
        )
        if file.content_type != "application/pdf":
            raise HTTPException(400, "Only PDF files allowed.")

        file_id = str(uuid.uuid4())
        save_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
        await save_upload(file, save_path)
        if not os.path.exists(save_path):
            raise RuntimeError(f"Uploaded PDF was not saved: {save_path}")

        collection_ref = get_collection()
        pages = extract_pages(save_path)
        if not any(page["text"].strip() for page in pages):
            return {"file_id": file_id, "error": "No text found (scanned PDF?)"}

        chunks = []
        for page in pages:
            for start, end, text in chunk_text_by_chars(page["text"]):
                if text.strip():
                    chunks.append({"page": page["page"], "start": start, "end": end, "text": text})

        texts = [chunk["text"] for chunk in chunks]
        embeddings = embed_model.encode(texts, convert_to_numpy=True)
        ids = [f"{file_id}_{index}" for index in range(len(texts))]
        metadatas = [
            {
                "page": chunk["page"],
                "start": chunk["start"],
                "end": chunk["end"],
                "file": file.filename,
                "file_id": file_id,
            }
            for chunk in chunks
        ]
        collection_ref.add(
            documents=texts,
            embeddings=embeddings.tolist(),
            metadatas=metadatas,
            ids=ids,
        )

        summary_text, provider, model = summarize_document("\n\n".join(texts[:3]), bullets=5)
        return {
            "file_id": file_id,
            "summary": parse_summary_points(summary_text),
            "summary_text": summary_text,
            "chunks_indexed": len(texts),
            "provider": provider,
            "model": model,
            "file_url": f"/files/{file_id}",
        }
    except Exception as exc:
        print("ERROR in /upload:", exc)
        print(traceback.format_exc())
        raise HTTPException(500, f"Upload failed: {type(exc).__name__}: {exc}")


@app.post("/chat")
async def chat(file_id: str = Form(...), query: str = Form(...), top_k: int = Form(3)):
    local_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    if not os.path.exists(local_path):
        raise HTTPException(404, "file_id not found")

    q_emb = embed_model.encode([query], convert_to_numpy=True).tolist()[0]
    results = collection.query(
        query_embeddings=[q_emb],
        n_results=top_k,
        include=["documents", "metadatas"],
        where={"file_id": file_id},
    )
    docs = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    if not docs:
        return {
            "answer": "I couldn't find a relevant passage in this PDF for that question.",
            "matches": [],
            "grounding_text": None,
            "found": False,
        }

    context = "\n\n".join([f"[Page {meta['page']}] {doc}" for doc, meta in zip(docs, metadatas)])
    answer_text, provider, model = answer_question(context, query)
    matches = [
        {
            "text": doc,
            "page": meta["page"],
            "start": meta.get("start"),
            "end": meta.get("end"),
        }
        for doc, meta in zip(docs, metadatas)
    ]
    grounding_text = matches[0]["text"] if matches else None
    found = answer_text.strip() != "Not present in the PDF."
    return {
        "answer": answer_text if found else "I found nearby text, but none of it clearly answers that question.",
        "matches": matches,
        "grounding_text": grounding_text,
        "found": found,
        "provider": provider,
        "model": model,
    }


@app.post("/highlight")
async def highlight(file_id: str = Form(...), page: int = Form(...), snippet: str = Form(...)):
    path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(404, "file_id not found")

    doc = fitz.open(path)
    page_ref = doc.load_page(page)
    rects = page_ref.search_for(snippet)
    if not rects:
        rects = page_ref.search_for(snippet[:160].strip())
    if not rects:
        doc.close()
        raise HTTPException(404, "Snippet not found on page")

    for rect in rects:
        page_ref.add_highlight_annot(rect)

    out_path = os.path.join(UPLOAD_DIR, f"{file_id}_highlighted.pdf")
    doc.save(out_path)
    doc.close()
    return FileResponse(out_path, media_type="application/pdf", filename=os.path.basename(out_path))


@app.get("/files/{file_id}")
async def get_pdf(file_id: str):
    path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    if not os.path.exists(path):
        raise HTTPException(404, "file_id not found")
    return FileResponse(path, media_type="application/pdf", filename=os.path.basename(path))
