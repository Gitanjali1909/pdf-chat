# PDF Intelligence Workspace 

AI-powered PDF analyzer: Upload → Summarize (10 bullets) → Chat Q&A → Highlight matches.

## Features
- Upload PDF
- Auto summary (LLM)
- Chat with PDF (semantic search)
- Highlight relevant text

## Tech Stack
**Backend:** FastAPI, SentenceTransformers, ChromaDB, GROQ
**Frontend:** Next.js 15, TypeScript, Tailwind CSS

## Architecture
Upload → Extract → Chunk → Embed → Store → Query → Retrieve → Generate

## How to Run
**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

**Frontend:**
bash
cd frontend
npm install
npm run dev