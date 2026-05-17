import React, { useEffect, useState, useCallback, useRef } from "react";
import Sidebar from "./components/Sidebar";
import Chat, { Message } from "./components/Chat";
import SettingsModal from "./components/SettingsModal";
import FolderSelectModal from "./components/FolderSelectModal";
import {
  initLLM, indexPDF, deleteDoc, listDocs, queryRAG, isLLMReady,
  LLM_MODEL, DEFAULT_SYSTEM_PROMPT, DEFAULT_GROQ_MODEL, isWebGPUAvailable,
  listFolders, createFolder, deleteFolder, renameFolder,
  listChats, createChat, renameChat, deleteChat, updateChatMessages,
  type DocMeta, type Folder, type ChatSession, type StoredMessage,
} from "./lib/ragEngine";

const SYSTEM_PROMPT_KEY = "rag-system-prompt";
const GROQ_API_KEY_KEY  = "rag-groq-api-key";
const GROQ_MODEL_KEY    = "rag-groq-model";

export default function App() {
  // ── Docs & Folders ──────────────────────────────────────────────────────────
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [indexing, setIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [showFolderSelect, setShowFolderSelect] = useState(false);

  // ── Chats ───────────────────────────────────────────────────────────────────
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  // ── LLM ─────────────────────────────────────────────────────────────────────
  const [llmStatus, setLLMStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [llmProgress, setLLMProgress] = useState("");

  // ── System Prompt + Groq model ───────────────────────────────────────────────
  const [systemPrompt, setSystemPrompt] = useState<string>(
    () => localStorage.getItem(SYSTEM_PROMPT_KEY) ?? DEFAULT_SYSTEM_PROMPT
  );
  const [groqModel, setGroqModel] = useState<string>(
    () => localStorage.getItem(GROQ_MODEL_KEY) ?? DEFAULT_GROQ_MODEL
  );
  const [showSettings, setShowSettings] = useState(false);

  // ── Layout ──────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keep ref to current messages for async updates
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([listDocs(), listFolders(), listChats()]).then(
      ([d, f, c]) => { setDocs(d); setFolders(f); setChats(c); }
    );
  }, []);

  useEffect(() => {
    if (!isWebGPUAvailable()) {
      // iOS / browsere fără WebGPU — folosim /api/chat, mereu ready
      setLLMStatus("ready");
      return;
    }
    if (llmStatus !== "idle") return;
    setLLMStatus("loading");
    initLLM((msg, pct) => setLLMProgress(`${msg}${pct !== undefined ? ` (${pct}%)` : ""}`))
      .then(() => setLLMStatus("ready"))
      .catch((err) => {
        console.error(err);
        setLLMStatus("idle");
      });
  }, []);

  // ── Active chat helpers ──────────────────────────────────────────────────────
  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  const syncMessages = useCallback((chatId: string, msgs: Message[]) => {
    const stored: StoredMessage[] = msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
    }));
    updateChatMessages(chatId, stored).then(() => {
      listChats().then(setChats);
    });
  }, []);

  // ── Chat operations ──────────────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    const chat = await createChat("Chat nou");
    setChats(await listChats());
    setActiveChatId(chat.id);
    setMessages([]);
  }, []);

  const handleSelectChat = useCallback((id: string) => {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    setActiveChatId(id);
    setMessages(
      chat.messages.map((m) => ({ id: m.id, role: m.role, content: m.content }))
    );
  }, [chats]);

  const handleRenameChat = useCallback(async (id: string, name: string) => {
    await renameChat(id, name);
    setChats(await listChats());
  }, []);

  const handleDeleteChat = useCallback(async (id: string) => {
    await deleteChat(id);
    const updated = await listChats();
    setChats(updated);
    if (activeChatId === id) {
      setActiveChatId(null);
      setMessages([]);
    }
  }, [activeChatId]);

  // ── PDF upload flow ──────────────────────────────────────────────────────────
  const handleAddPDFs = useCallback((files: FileList) => {
    setPendingFiles(files);
    setShowFolderSelect(true);
  }, []);

  const handleFolderConfirm = useCallback(async (folderId: string) => {
    if (!pendingFiles) return;
    setShowFolderSelect(false);
    setIndexing(true);
    const files = pendingFiles;
    setPendingFiles(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setIndexingProgress({ msg: `[${i + 1}/${files.length}] ${file.name}`, pct: 0 });
      try {
        await indexPDF(file, folderId, (msg, pct) => {
          setIndexingProgress({ msg: `[${i + 1}/${files.length}] ${msg}`, pct: pct ?? 0 });
        });
      } catch (err: any) {
        alert(`Eroare la indexarea "${file.name}": ${err.message}`);
      }
    }
    setDocs(await listDocs());
    setIndexing(false);
    setIndexingProgress(null);
  }, [pendingFiles]);

  const handleCreateFolder = useCallback(async (name: string) => {
    await createFolder(name);
    setFolders(await listFolders());
  }, []);

  const handleDeleteFolder = useCallback(async (id: string) => {
    if (!confirm("Ștergi folderul? Documentele vor fi mutate în General.")) return;
    await deleteFolder(id);
    setFolders(await listFolders());
    setDocs(await listDocs());
  }, []);

  const handleDeleteDoc = useCallback(async (docId: string) => {
    await deleteDoc(docId);
    setDocs(await listDocs());
  }, []);

  const handleCreateFolderInModal = useCallback(async (name: string): Promise<Folder> => {
    const folder = await createFolder(name);
    setFolders(await listFolders());
    return folder;
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    if (!isLLMReady()) return;

    // Asigură că avem un chat activ
    let chatId = activeChatId;
    if (!chatId) {
      const chat = await createChat(text.slice(0, 40) + (text.length > 40 ? "…" : ""));
      setChats(await listChats());
      setActiveChatId(chat.id);
      chatId = chat.id;
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true };

    const newMessages = [...messagesRef.current, userMsg, assistantMsg];
    setMessages(newMessages);
    setLoading(true);

    // Auto-rename dacă e "Chat nou"
    const currentChat = chats.find((c) => c.id === chatId);
    if (currentChat?.name === "Chat nou") {
      await renameChat(chatId, text.slice(0, 40) + (text.length > 40 ? "…" : ""));
      setChats(await listChats());
    }

    try {
      let fullContent = "";
      for await (const token of queryRAG(text, systemPrompt, groqModel)) {
        fullContent += token;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: fullContent, streaming: true } : m)
        );
      }
      const finalMessages = messagesRef.current.map((m) =>
        m.id === assistantId ? { ...m, content: fullContent, streaming: false } : m
      );
      setMessages(finalMessages);
      syncMessages(chatId, finalMessages);
    } catch (err: any) {
      const errorMessages = messagesRef.current.map((m) =>
        m.id === assistantId ? { ...m, content: `Eroare: ${err.message}`, streaming: false } : m
      );
      setMessages(errorMessages);
    } finally {
      setLoading(false);
    }
  }, [activeChatId, chats, systemPrompt, syncMessages]);

  // ── Settings save ─────────────────────────────────────────────────────────────
  const handleSaveSettings = useCallback((prompt: string, _apiKey: string, model: string) => {
    setSystemPrompt(prompt);
    setGroqModel(model);
    localStorage.setItem(SYSTEM_PROMPT_KEY, prompt);
    localStorage.setItem(GROQ_MODEL_KEY, model);
  }, []);

  const chatDisabled = llmStatus !== "ready";
  const disabledReason = llmStatus === "loading"
    ? llmProgress || `Se încarcă ${LLM_MODEL}…`
    : undefined;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f172a]">
      {/* LLM Loading Overlay */}
      {llmStatus === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/90 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center border border-slate-700">
            <div className="text-4xl mb-4">🧠</div>
            <h2 className="text-white font-semibold text-lg mb-2">Pall-Ex Mind pornește…</h2>
            <p className="text-slate-400 text-sm mb-1">{LLM_MODEL}</p>
            <p className="text-slate-500 text-xs mb-6">
              Prima dată poate dura 2–5 min (~2GB descărcare). Ulterior din cache.
            </p>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse w-full" />
            </div>
            <p className="text-xs text-slate-500 truncate">{llmProgress}</p>
          </div>
        </div>
      )}

      {/* Folder Select Modal */}
      {showFolderSelect && pendingFiles && (
        <FolderSelectModal
          folders={folders}
          fileCount={pendingFiles.length}
          onConfirm={handleFolderConfirm}
          onCreateFolder={handleCreateFolderInModal}
          onClose={() => { setShowFolderSelect(false); setPendingFiles(null); }}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          systemPrompt={systemPrompt}
          groqApiKey=""
          groqModel={groqModel}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        docs={docs}
        folders={folders}
        indexing={indexing}
        indexingProgress={indexingProgress}
        onAddPDFs={handleAddPDFs}
        onDeleteDoc={handleDeleteDoc}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Chat
          messages={messages}
          loading={loading}
          disabled={chatDisabled}
          disabledReason={disabledReason}
          chatName={activeChat?.name ?? "Pall-Ex Mind"}
          onSend={handleSend}
          onMenuOpen={() => setSidebarOpen(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      </main>
    </div>
  );
}
