import os
import traceback
import uuid

import aiofiles
import chromadb
import fitz
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from openai import OpenAI

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_SUMMARY_MODEL = os.getenv("GROQ_SUMMARY_MODEL", "llama-3.1-8b-instant")
GROQ_CHAT_MODEL = os.getenv("GROQ_CHAT_MODEL", "llama-3.1-8b-instant")

UPLOAD_DIR = "./uploads"
CHROMA_DIR = "./chroma_db"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(CHROMA_DIR, exist_ok=True)

EMBED_MODEL_NAME = "all-MiniLM-L6-v2"

app = FastAPI(title="pdf-chat-backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

embed_model = None
chroma_client = None
collection = None
groq_client = None


print("Backend started successfully")


def get_groq_client():
    global groq_client
    if groq_client is None:
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is missing")
        groq_client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)
    return groq_client


def get_embed_model():
    global embed_model
    if embed_model is None:
        from sentence_transformers import SentenceTransformer

        embed_model = SentenceTransformer(EMBED_MODEL_NAME)
    return embed_model


def get_collection():
    global chroma_client, collection
    if collection is not None:
        return collection

    try:
        if chroma_client is None:
            chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)
        try:
            collection = chroma_client.get_collection("pdf_collection")
        except Exception:
            collection = chroma_client.create_collection(name="pdf_collection")
        return collection
    except Exception as exc:
        print(f"Chroma collection init failed: {exc}")
        print(traceback.format_exc())
        raise RuntimeError(f"ChromaDB collection initialization failed: {exc}") from exc


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


def groq_chat_completion(model: str, system_prompt: str, user_prompt: str):
    try:
        response = get_groq_client().chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0,
        )
        content = response.choices[0].message.content or ""
        return content.strip(), "groq", model
    except Exception as exc:
        print(f"Groq completion failed: {exc}")
        print(traceback.format_exc())
        raise RuntimeError(f"Groq API error: {exc}") from exc


def summarize_document(text: str, bullets: int = 5):
    clipped = text[:5000]
    return groq_chat_completion(
        model=GROQ_SUMMARY_MODEL,
        system_prompt="You summarize PDFs into concise bullet points.",
        user_prompt=f"Summarize the following PDF text into exactly {bullets} concise bullet points.\n\n{clipped}",
    )


def answer_question(context: str, query: str):
    clipped_context = context[:7000]
    return groq_chat_completion(
        model=GROQ_CHAT_MODEL,
        system_prompt="Answer strictly from the provided PDF context. Be concise and grounded.",
        user_prompt=(
            "Answer the question using only the context below. "
            "If the answer is not supported by the context, reply with exactly: Not present in the PDF.\n\n"
            f"Context:\n{clipped_context}\n\nQuestion: {query}"
        ),
    )


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    try:
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
        embeddings = get_embed_model().encode(texts, convert_to_numpy=True)
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

    q_emb = get_embed_model().encode([query], convert_to_numpy=True).tolist()[0]
    results = get_collection().query(
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
