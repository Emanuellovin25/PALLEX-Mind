import React, { useRef, useState } from "react";
import type { ChatSession, DocMeta, Folder } from "../lib/ragEngine";

interface Props {
  // Chats
  chats: ChatSession[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onRenameChat: (id: string, name: string) => void;
  onDeleteChat: (id: string) => void;
  // Docs
  docs: DocMeta[];
  folders: Folder[];
  indexing: boolean;
  indexingProgress: { msg: string; pct: number } | null;
  onAddPDFs: (files: FileList) => void;
  onDeleteDoc: (docId: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  // Layout
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  chats, activeChatId, onNewChat, onSelectChat, onRenameChat, onDeleteChat,
  docs, folders, indexing, indexingProgress, onAddPDFs, onDeleteDoc,
  onCreateFolder, onDeleteFolder,
  isOpen, onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["default"]));

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startRename = (chat: ChatSession) => {
    setRenamingChatId(chat.id);
    setRenameValue(chat.name);
  };

  const confirmRename = () => {
    if (renamingChatId && renameValue.trim()) {
      onRenameChat(renamingChatId, renameValue.trim());
    }
    setRenamingChatId(null);
  };

  const docsInFolder = (folderId: string) =>
    docs.filter((d) => (d.folderId ?? "default") === folderId);

  const allFolders = [
    { id: "default", name: "General", createdAt: 0 } as Folder,
    ...folders,
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-10 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`
          fixed top-0 left-0 h-full z-20 w-72 flex flex-col
          bg-[#1e293b] border-r border-slate-700
          transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:translate-x-0 md:flex
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Pall-Ex Mind"
              onError={(e) => { (e.target as HTMLImageElement).src = "/icon.svg"; }}
              className="h-7 w-auto object-contain"
            />
            <span className="font-semibold text-white text-sm tracking-wide">Mind</span>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ── CHAT SECTION ── */}
          <div className="px-3 pt-3">
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-2 px-3 py-2.5
                bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg
                text-sm font-medium transition-colors"
            >
              <span>＋</span> Chat nou
            </button>
          </div>

          {chats.length > 0 && (
            <div className="px-3 mt-3">
              <p className="text-xs text-slate-500 font-medium px-1 mb-1">CONVERSAȚII</p>
              <ul className="space-y-0.5">
                {chats.map((chat) => (
                  <li key={chat.id}>
                    {renamingChatId === chat.id ? (
                      <div className="flex gap-1 px-1">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenamingChatId(null); }}
                          className="flex-1 bg-slate-900 border border-indigo-500 rounded px-2 py-1
                            text-xs text-white focus:outline-none"
                        />
                        <button onClick={confirmRename} className="text-indigo-400 hover:text-white text-xs px-1">✓</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { onSelectChat(chat.id); onClose(); }}
                        className={`group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors
                          ${activeChatId === chat.id
                            ? "bg-slate-700 text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`}
                      >
                        <span className="flex-1 truncate">{chat.name}</span>
                        <span
                          onClick={(e) => { e.stopPropagation(); startRename(chat); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white text-xs"
                          title="Redenumește"
                        >✏️</span>
                        <span
                          onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 text-xs"
                          title="Șterge"
                        >✕</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Divider */}
          <div className="mx-4 my-3 border-t border-slate-700" />

          {/* ── DOCUMENTS SECTION ── */}
          <div className="px-3">
            <div className="flex items-center justify-between mb-1 px-1">
              <p className="text-xs text-slate-500 font-medium">DOCUMENTE</p>
            </div>

            {/* Upload button */}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && onAddPDFs(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={indexing}
              className="w-full flex items-center gap-2 px-3 py-2 mb-2
                bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800
                text-slate-200 rounded-lg text-sm transition-colors"
            >
              {indexing ? <span className="animate-spin text-xs">⟳</span> : <span>＋</span>}
              {indexing ? "Indexez…" : "Adaugă PDFs"}
            </button>

            {/* Progress */}
            {indexing && indexingProgress && (
              <div className="mb-2 px-1">
                <p className="text-xs text-slate-400 truncate mb-1">{indexingProgress.msg}</p>
                <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${indexingProgress.pct}%` }} />
                </div>
              </div>
            )}

            {/* Folder tree */}
            {allFolders.map((folder) => {
              const folderDocs = docsInFolder(folder.id);
              const isExpanded = expandedFolders.has(folder.id);
              return (
                <div key={folder.id} className="mb-1">
                  <div className="flex items-center gap-1 group">
                    <button
                      onClick={() => toggleFolder(folder.id)}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg
                        text-slate-300 hover:text-white hover:bg-slate-800 text-sm transition-colors"
                    >
                      <span className="text-xs">{isExpanded ? "▾" : "▸"}</span>
                      <span>📁</span>
                      <span className="truncate">{folder.name}</span>
                      <span className="ml-auto text-xs text-slate-500">{folderDocs.length}</span>
                    </button>
                    {folder.id !== "default" && (
                      <button
                        onClick={() => onDeleteFolder(folder.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-600
                          hover:text-red-400 text-xs px-1 transition-all"
                        title="Șterge folder"
                      >✕</button>
                    )}
                  </div>

                  {isExpanded && (
                    <ul className="ml-4 mt-0.5 space-y-0.5">
                      {folderDocs.length === 0 ? (
                        <li className="text-xs text-slate-600 px-2 py-1">gol</li>
                      ) : (
                        folderDocs.map((doc) => (
                          <li key={doc.id} className="group flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-800">
                            <span className="text-xs">📄</span>
                            <span className="flex-1 text-xs text-slate-400 truncate">{doc.name}</span>
                            <button
                              onClick={() => onDeleteDoc(doc.id)}
                              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 text-xs"
                            >✕</button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              );
            })}

            {/* New folder */}
            {newFolderMode ? (
              <div className="flex gap-1 mt-1">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName.trim()) {
                      onCreateFolder(newFolderName.trim());
                      setNewFolderName("");
                      setNewFolderMode(false);
                    }
                    if (e.key === "Escape") setNewFolderMode(false);
                  }}
                  placeholder="Nume folder..."
                  className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1
                    text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => {
                    if (newFolderName.trim()) {
                      onCreateFolder(newFolderName.trim());
                      setNewFolderName("");
                    }
                    setNewFolderMode(false);
                  }}
                  className="text-indigo-400 hover:text-white text-xs px-1"
                >✓</button>
              </div>
            ) : (
              <button
                onClick={() => setNewFolderMode(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 mt-1 rounded-lg
                  text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                <span>＋</span> Folder nou
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-600 text-center">
          100% local · fără cloud · offline
        </div>
      </aside>
    </>
  );
}
