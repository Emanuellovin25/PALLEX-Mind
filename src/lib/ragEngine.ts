/**
 * RAG Engine – rulează complet în browser
 * PDF parsing: pdfjs-dist
 * Embeddings: @huggingface/transformers (all-MiniLM-L6-v2)
 * Vector store: IndexedDB (via idb)
 * LLM backend 1: @mlc-ai/web-llm (Qwen2.5-3B, WebGPU) – desktop Chrome/Edge
 * LLM backend 2: Groq API – fallback pentru iOS Safari / browsere fără WebGPU
 */

import * as pdfjs from "pdfjs-dist";
import { openDB, IDBPDatabase } from "idb";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();

// ─── Config ──────────────────────────────────────────────────────────────────
export const LLM_MODEL = "Qwen2.5-3B-Instruct-q4f16_1-MLC";
export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B – calitate maximă" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B – cel mai rapid" },
  { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B – echilibrat" },
  { id: "gemma2-9b-it",            label: "Gemma 2 9B – Google" },
] as const;
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

// ─── WebGPU detection ─────────────────────────────────────────────────────────
export function isWebGPUAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  // iOS Safari (inclusiv versiunile cu WebGPU parțial) → folosim Groq, nu WebLLM
  const isIOS =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return false;
  return "gpu" in navigator;
}
const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 60;
const TOP_K = 4;
const DB_NAME = "rag-chat-db";
const DB_VERSION = 2;

export const DEFAULT_SYSTEM_PROMPT =
  "Ești un asistent util și precis. Răspunde la întrebările utilizatorului " +
  "bazându-te EXCLUSIV pe contextul furnizat din documente. " +
  "Dacă informația nu există în context, spune clar că nu o găsești în documente. " +
  "Răspunde în aceeași limbă în care ți se pune întrebarea.";

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

export interface DocMeta {
  id: string;
  name: string;
  pages: number;
  chunks: number;
  addedAt: number;
  folderId: string; // "default" dacă nu e specificat
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: StoredMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface DocChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  embedding: number[];
  page: number;
}

export type ProgressCallback = (msg: string, pct?: number) => void;

// ─── Singleton state ──────────────────────────────────────────────────────────
let db: IDBPDatabase | null = null;
let embedPipeline: any = null;
let llmEngine: any = null;

// ─── DB ──────────────────────────────────────────────────────────────────────
async function getDB(): Promise<IDBPDatabase> {
  if (db) return db;
  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const cs = database.createObjectStore("chunks", { keyPath: "id" });
        cs.createIndex("docId", "docId");
        database.createObjectStore("docs", { keyPath: "id" });
      }
      if (oldVersion < 2) {
        database.createObjectStore("folders", { keyPath: "id" });
        database.createObjectStore("chats", { keyPath: "id" });
      }
    },
  });
  return db;
}

// ─── Folder CRUD ─────────────────────────────────────────────────────────────
export async function listFolders(): Promise<Folder[]> {
  const database = await getDB();
  return database.getAll("folders");
}

export async function createFolder(name: string): Promise<Folder> {
  const folder: Folder = {
    id: `folder-${Date.now()}`,
    name,
    createdAt: Date.now(),
  };
  const database = await getDB();
  await database.put("folders", folder);
  return folder;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const database = await getDB();
  const folder = await database.get("folders", id);
  if (folder) await database.put("folders", { ...folder, name });
}

export async function deleteFolder(folderId: string): Promise<void> {
  const database = await getDB();
  // Mută documentele din folder în "default"
  const docs: DocMeta[] = await database.getAll("docs");
  const tx = database.transaction(["docs", "folders"], "readwrite");
  for (const doc of docs) {
    if (doc.folderId === folderId) {
      await tx.objectStore("docs").put({ ...doc, folderId: "default" });
    }
  }
  await tx.objectStore("folders").delete(folderId);
  await tx.done;
}

// ─── Chat Session CRUD ────────────────────────────────────────────────────────
export async function listChats(): Promise<ChatSession[]> {
  const database = await getDB();
  const chats: ChatSession[] = await database.getAll("chats");
  return chats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createChat(name = "Chat nou"): Promise<ChatSession> {
  const chat: ChatSession = {
    id: `chat-${Date.now()}`,
    name,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const database = await getDB();
  await database.put("chats", chat);
  return chat;
}

export async function renameChat(id: string, name: string): Promise<void> {
  const database = await getDB();
  const chat = await database.get("chats", id);
  if (chat) await database.put("chats", { ...chat, name });
}

export async function updateChatMessages(
  id: string,
  messages: StoredMessage[]
): Promise<void> {
  const database = await getDB();
  const chat = await database.get("chats", id);
  if (chat) {
    await database.put("chats", { ...chat, messages, updatedAt: Date.now() });
  }
}

export async function deleteChat(id: string): Promise<void> {
  const database = await getDB();
  await database.delete("chats", id);
}

// ─── PDF Parsing ──────────────────────────────────────────────────────────────
export async function extractTextFromPDF(
  file: File,
  onProgress?: ProgressCallback
): Promise<{ pages: string[] }> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Pagina ${i}/${pdf.numPages}`, (i / pdf.numPages) * 100);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(text);
  }
  return { pages };
}

// ─── Chunking ─────────────────────────────────────────────────────────────────
function chunkText(text: string, pageIndex: number): { text: string; page: number }[] {
  const chunks: { text: string; page: number }[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 30) chunks.push({ text: chunk, page: pageIndex + 1 });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ─── Embeddings ───────────────────────────────────────────────────────────────
async function getEmbedPipeline() {
  if (embedPipeline) return embedPipeline;
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  embedPipeline = await pipeline("feature-extraction", EMBED_MODEL);
  return embedPipeline;
}

async function embed(texts: string[]): Promise<number[][]> {
  const pipe = await getEmbedPipeline();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await pipe(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data as Float32Array));
  }
  return results;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

// ─── Index PDF ────────────────────────────────────────────────────────────────
export async function indexPDF(
  file: File,
  folderId: string,
  onProgress: ProgressCallback
): Promise<DocMeta> {
  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  onProgress("Extrag text…", 5);
  const { pages } = await extractTextFromPDF(file, (msg, pct) =>
    onProgress(msg, 5 + (pct ?? 0) * 0.3)
  );

  onProgress("Împart în bucăți…", 35);
  const allChunks: { text: string; page: number }[] = [];
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].length > 20) allChunks.push(...chunkText(pages[i], i));
  }

  onProgress(`Calculez embeddings…`, 40);
  const chunkDocs: DocChunk[] = [];
  const batchSize = 8;
  for (let i = 0; i < allChunks.length; i += batchSize) {
    const batch = allChunks.slice(i, i + batchSize);
    const embeddings = await embed(batch.map((c) => c.text));
    batch.forEach((c, j) => {
      chunkDocs.push({
        id: `${docId}-chunk-${i + j}`,
        docId,
        docName: file.name,
        text: c.text,
        embedding: embeddings[j],
        page: c.page,
      });
    });
    onProgress(
      `Embeddings: ${Math.min(i + batchSize, allChunks.length)}/${allChunks.length}`,
      40 + ((i + batchSize) / allChunks.length) * 50
    );
  }

  onProgress("Salvez…", 93);
  const database = await getDB();
  const tx = database.transaction(["chunks", "docs"], "readwrite");
  for (const chunk of chunkDocs) await tx.objectStore("chunks").put(chunk);
  const meta: DocMeta = {
    id: docId,
    name: file.name,
    pages: pages.length,
    chunks: chunkDocs.length,
    addedAt: Date.now(),
    folderId,
  };
  await tx.objectStore("docs").put(meta);
  await tx.done;

  onProgress("Gata!", 100);
  return meta;
}

// ─── Delete doc ───────────────────────────────────────────────────────────────
export async function deleteDoc(docId: string): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(["chunks", "docs"], "readwrite");
  const index = tx.objectStore("chunks").index("docId");
  let cursor = await index.openCursor(IDBKeyRange.only(docId));
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.objectStore("docs").delete(docId);
  await tx.done;
}

export async function listDocs(): Promise<DocMeta[]> {
  const database = await getDB();
  return database.getAll("docs");
}

// ─── RAG Query ────────────────────────────────────────────────────────────────
async function retrieveContext(query: string): Promise<DocChunk[]> {
  const [queryEmbedding] = await embed([query]);
  const database = await getDB();
  const allChunks: DocChunk[] = await database.getAll("chunks");
  const scored = allChunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, TOP_K).map((s) => s.chunk);
}

function buildPrompt(
  context: DocChunk[],
  question: string,
  systemPrompt: string
): string {
  const ctxText = context
    .map((c, i) => `[${i + 1}] (din "${c.docName}", pagina ${c.page}):\n${c.text}`)
    .join("\n\n");

  return `${systemPrompt}\n\nCONTEXT DIN DOCUMENTE:\n${ctxText}\n\nÎNTREBARE: ${question}\n\nRĂSPUNS:`;
}

// ─── LLM ─────────────────────────────────────────────────────────────────────
export async function initLLM(onProgress: ProgressCallback): Promise<void> {
  if (llmEngine) return;
  const webllm = await import("@mlc-ai/web-llm");
  llmEngine = await webllm.CreateMLCEngine(LLM_MODEL, {
    initProgressCallback: (progress: any) => {
      const pct = Math.round((progress.progress ?? 0) * 100);
      onProgress(progress.text ?? "Se încarcă modelul…", pct);
    },
  });
}

// ─── WebLLM query ─────────────────────────────────────────────────────────────
async function* queryWebLLM(
  prompt: string
): AsyncGenerator<string, void, unknown> {
  if (!llmEngine) throw new Error("WebLLM neîncărcat");
  const stream = await llmEngine.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    stream: true,
    temperature: 0.3,
    max_tokens: 1024,
  });
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) yield delta;
  }
}

// ─── Groq API query (prin /api/chat – cheia e pe server) ─────────────────────
async function* queryGroqAPI(
  prompt: string,
  model: string
): AsyncGenerator<string, void, unknown> {
  // În producție (Vercel) → /api/chat
  // În dev local → fallback direct cu cheie din env (opțional)
  const endpoint = "/api/chat";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Eroare server chat (${response.status}): ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value).split("\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content ?? "";
        if (token) yield token;
      } catch {}
    }
  }
}

// ─── Unified RAG query ────────────────────────────────────────────────────────
export async function* queryRAG(
  question: string,
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  groqModel: string = DEFAULT_GROQ_MODEL
): AsyncGenerator<string, void, unknown> {
  const context = await retrieveContext(question);
  if (context.length === 0) {
    yield "Nu am găsit informații relevante în documentele tale. Încearcă să încarci mai multe PDFs sau reformulează întrebarea.";
    return;
  }

  const prompt = buildPrompt(context, question, systemPrompt);

  if (isWebGPUAvailable() && llmEngine) {
    yield* queryWebLLM(prompt);
  } else {
    yield* queryGroqAPI(prompt, groqModel);
  }
}

export function isLLMReady(): boolean {
  // Pe desktop cu WebGPU → gata când WebLLM e încărcat
  // Pe iOS/fără WebGPU → mereu "gata" (folosește /api/chat)
  if (!isWebGPUAvailable()) return true;
  return llmEngine !== null;
}
