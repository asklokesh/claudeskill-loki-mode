# PRD: AI Chatbot with RAG

## Overview
An AI-powered chatbot application called "AskBase" that lets users upload documents, then ask questions answered using retrieval-augmented generation (RAG). Combines document chunking, vector search, and LLM completion to provide accurate, source-cited answers from uploaded content.

## Target Users
- Knowledge workers who need to query large document collections
- Students researching across multiple papers or textbooks
- Teams building internal knowledge bases from existing documentation
- Developers learning RAG architecture patterns

## Features

### MVP Features
1. **Document Upload** - Upload PDF, TXT, and Markdown files for indexing
2. **Document Processing** - Automatic chunking, embedding generation, and vector storage
3. **Chat Interface** - Conversational UI with streaming responses
4. **RAG Retrieval** - Find relevant document chunks for each question
5. **Source Citations** - Every answer includes references to source documents and page/section
6. **Conversation History** - Persistent chat threads with rename and delete
7. **Document Management** - View uploaded documents, check indexing status, delete documents
8. **Settings** - Configure model, temperature, chunk size, and retrieval count

### How RAG Works (Architecture)
```
User Question
    |
    v
[1. Embed Question] --> vector embedding of the query
    |
    v
[2. Vector Search]  --> find top-K most similar document chunks
    |
    v
[3. Build Prompt]   --> system prompt + retrieved chunks + user question
    |
    v
[4. LLM Completion] --> generate answer with citations
    |
    v
[5. Stream Response] --> display to user with source references
```

### User Flow
1. User opens app -> sees empty chat with "Upload documents to get started"
2. Clicks upload -> selects PDF files -> documents begin processing
3. Progress bar shows: uploading -> chunking -> embedding -> indexed
4. User types question -> relevant chunks retrieved -> answer streamed
5. Answer includes "[Source: document.pdf, page 12]" citations
6. User can click citation to see the original chunk
7. Conversation saved to history -> user can return to it later

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui
- Vercel AI SDK (useChat hook for streaming)
- react-pdf for document preview
- react-dropzone for file upload

### Backend
- Next.js API Routes (Route Handlers)
- OpenAI API (gpt-4o for completion, text-embedding-3-small for embeddings)
- Vector store: ChromaDB (local, via chromadb npm package) or Pinecone
- Document parsing: pdf-parse for PDFs, plain text for TXT/MD
- Text splitting: LangChain text splitter (RecursiveCharacterTextSplitter)

### Infrastructure
- Database: SQLite via better-sqlite3 (conversations, documents metadata)
- Vector store: ChromaDB running locally (Docker or embedded)
- File storage: Local filesystem (/uploads directory)

### Structure
```
/
├── src/
│   ├── app/
│   │   ├── page.tsx                     # Chat interface (main page)
│   │   ├── documents/
│   │   │   └── page.tsx                 # Document management
│   │   ├── history/
│   │   │   └── page.tsx                 # Conversation history
│   │   ├── settings/
│   │   │   └── page.tsx                 # Configuration
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   └── route.ts             # Chat completion (streaming)
│   │   │   ├── documents/
│   │   │   │   ├── route.ts             # Upload and list documents
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts         # Get/delete document
│   │   │   │   └── [id]/
│   │   │   │       └── status/
│   │   │   │           └── route.ts     # Processing status
│   │   │   ├── conversations/
│   │   │   │   ├── route.ts             # List/create conversations
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts         # Get/update/delete conversation
│   │   │   │       └── messages/
│   │   │   │           └── route.ts     # Get messages for conversation
│   │   │   └── search/
│   │   │       └── route.ts             # Vector similarity search (debug)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ChatInterface.tsx            # Main chat component
│   │   ├── MessageBubble.tsx            # Chat message with markdown
│   │   ├── SourceCitation.tsx           # Clickable source reference
│   │   ├── SourcePreview.tsx            # Document chunk preview modal
│   │   ├── DocumentUploader.tsx         # Drag-and-drop upload
│   │   ├── DocumentList.tsx             # Uploaded documents list
│   │   ├── ProcessingStatus.tsx         # Upload progress indicator
│   │   ├── ConversationList.tsx         # Chat history sidebar
│   │   ├── StreamingText.tsx            # Animated streaming response
│   │   └── SettingsForm.tsx             # Configuration form
│   ├── lib/
│   │   ├── openai.ts                    # OpenAI client setup
│   │   ├── vectorstore.ts              # ChromaDB client and operations
│   │   ├── embeddings.ts               # Embedding generation
│   │   ├── chunker.ts                  # Document text splitting
│   │   ├── parser.ts                   # PDF/TXT/MD parsing
│   │   ├── rag.ts                      # RAG pipeline (retrieve + prompt)
│   │   ├── db.ts                       # SQLite connection
│   │   └── prompts.ts                  # System prompts and templates
│   └── types/
│       └── index.ts
├── uploads/                             # Uploaded document files
├── tests/
│   ├── chunker.test.ts
│   ├── parser.test.ts
│   ├── rag.test.ts
│   ├── embeddings.test.ts
│   └── api/
│       ├── chat.test.ts
│       └── documents.test.ts
├── package.json
├── tsconfig.json
├── docker-compose.yml                   # ChromaDB service
└── README.md
```

## Database Schema

### SQLite (Metadata)
```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,             -- pdf, txt, md
  file_size INTEGER NOT NULL,          -- bytes
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'uploading',     -- uploading, processing, indexed, error
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                  -- user, assistant
  content TEXT NOT NULL,
  sources TEXT,                        -- JSON array of source citations
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_documents_status ON documents(status);
```

### Vector Store (ChromaDB)
```
Collection: "documents"
  - id: chunk UUID
  - document: chunk text content
  - metadata: {
      document_id: string,
      filename: string,
      chunk_index: number,
      page_number: number | null,
      total_chunks: number
    }
  - embedding: float[] (1536 dimensions for text-embedding-3-small)
```

## API Endpoints

### Chat
- `POST /api/chat` - Send message and get streaming response
  - Body: `{ conversationId, message }`
  - Response: Server-Sent Events stream (Vercel AI SDK format)
  - Internally: embeds question -> vector search -> builds prompt -> streams completion

### Documents
- `POST /api/documents` - Upload document (multipart/form-data)
- `GET /api/documents` - List all documents with status
- `GET /api/documents/:id` - Get document details
- `GET /api/documents/:id/status` - Get processing status
- `DELETE /api/documents/:id` - Delete document and its chunks from vector store

### Conversations
- `GET /api/conversations` - List all conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get conversation with messages
- `PATCH /api/conversations/:id` - Rename conversation
- `DELETE /api/conversations/:id` - Delete conversation and messages
- `GET /api/conversations/:id/messages` - Get messages (paginated)

### Debug
- `POST /api/search` - Direct vector similarity search (for testing retrieval)
  - Body: `{ query, topK }`
  - Response: `{ results: [{ text, score, metadata }] }`

## RAG Pipeline Details

### Document Processing
1. **Parse**: Extract text from PDF (pdf-parse) or read TXT/MD directly
2. **Chunk**: Split into ~500 token chunks with 50 token overlap (RecursiveCharacterTextSplitter)
3. **Embed**: Generate embeddings via OpenAI text-embedding-3-small (batch of 100)
4. **Store**: Insert chunks + embeddings into ChromaDB with metadata

### Query Pipeline
1. **Embed query**: Generate embedding for user's question
2. **Retrieve**: Find top 5 most similar chunks from ChromaDB
3. **Rerank** (optional): Score relevance of each chunk to the question
4. **Build prompt**: Construct system prompt with retrieved context
5. **Complete**: Stream response from GPT-4o with citation instructions
6. **Parse citations**: Extract [Source: ...] references from response

### System Prompt Template
```
You are a helpful assistant that answers questions based on the provided context.
Always cite your sources using [Source: filename, chunk N] format.
If the context doesn't contain enough information to answer, say so clearly.
Do not make up information that isn't in the provided context.

Context:
---
{retrieved_chunks_with_metadata}
---

Answer the user's question based on the above context.
```

## Configuration Options

```typescript
interface RAGSettings {
  model: "gpt-4o" | "gpt-4o-mini" | "gpt-3.5-turbo";
  temperature: number;             // 0.0 - 1.0, default 0.3
  maxTokens: number;               // default 2048
  embeddingModel: "text-embedding-3-small" | "text-embedding-3-large";
  chunkSize: number;               // tokens, default 500
  chunkOverlap: number;            // tokens, default 50
  topK: number;                    // retrieval count, default 5
  similarityThreshold: number;     // minimum score, default 0.7
}
```

## Requirements
- TypeScript throughout
- Streaming responses (SSE via Vercel AI SDK)
- Document processing runs asynchronously (user sees progress)
- Vector search returns results in under 500ms for collections under 10K chunks
- Chat supports markdown rendering (code blocks, lists, bold, links)
- Source citations are clickable and show the original chunk text
- Conversation auto-titled based on first message (via LLM)
- File size limit: 20MB per document
- Supported formats: PDF, TXT, MD
- OpenAI API key configured via environment variable
- ChromaDB runs via Docker Compose for local development
- Graceful handling of API errors (rate limits, token limits, network)

## Testing
- Unit tests: Chunker (splits correctly, respects overlap), parser (extracts text), prompt builder (Vitest)
- Integration tests: Document upload -> processing -> vector store insertion
- API tests: Chat endpoint with mocked OpenAI responses, document CRUD
- RAG quality tests: Predefined questions with expected source chunks, verify retrieval accuracy
- Manual testing: Upload a real PDF, ask questions, verify answer quality and citations

## Out of Scope
- User authentication (single-user app for MVP)
- Multi-user document permissions
- Web scraping / URL ingestion
- Image or table extraction from PDFs
- Fine-tuning or custom models
- Reranking model (Cohere, cross-encoder)
- Production vector database (Pinecone, Weaviate, Qdrant)
- Deployment
- Cost tracking / usage limits

## Success Criteria
- Document upload and processing completes without errors
- Chunks are correctly stored in vector store with metadata
- Questions return relevant answers based on uploaded content
- Source citations point to correct document and chunk
- Streaming responses display progressively in the UI
- Conversation history persists and loads correctly
- Settings changes affect RAG behavior (temperature, topK, etc.)
- All tests pass
- Response latency under 3 seconds for first token

---

**Purpose:** Tests Loki Mode's ability to build an AI application with document processing, vector embeddings, RAG retrieval, and streaming LLM responses. Expect ~60-90 minutes for full execution.
