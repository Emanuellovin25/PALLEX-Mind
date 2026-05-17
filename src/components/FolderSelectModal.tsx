import React, { useState } from "react";
import type { Folder } from "../lib/ragEngine";

interface Props {
  folders: Folder[];
  fileCount: number;
  onConfirm: (folderId: string) => void;
  onCreateFolder: (name: string) => Promise<Folder>;
  onClose: () => void;
}

export default function FolderSelectModal({
  folders,
  fileCount,
  onConfirm,
  onCreateFolder,
  onClose,
}: Props) {
  const [selectedId, setSelectedId] = useState("default");
  const [newFolderName, setNewFolderName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    const folder = await onCreateFolder(newFolderName.trim());
    setSelectedId(folder.id);
    setNewFolderName("");
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-semibold">Unde pui documentele?</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {fileCount} fișier{fileCount !== 1 ? "e" : ""} selectat{fileCount !== 1 ? "e" : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-5 space-y-2">
          {/* Default folder */}
          <button
            onClick={() => setSelectedId("default")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors
              ${selectedId === "default"
                ? "bg-indigo-600 text-white"
                : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
              }`}
          >
            <span>📁</span>
            <span className="font-medium">General</span>
            <span className="ml-auto text-xs opacity-60">implicit</span>
          </button>

          {/* User folders */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setSelectedId(folder.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors
                ${selectedId === folder.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                }`}
            >
              <span>📁</span>
              <span className="font-medium">{folder.name}</span>
            </button>
          ))}

          {/* Create new folder */}
          {creating ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
                placeholder="Nume folder..."
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2
                  text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleCreate}
                disabled={!newFolderName.trim()}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700
                  text-white rounded-lg text-sm transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-2 text-slate-400 hover:text-white rounded-lg text-sm"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm
                text-slate-400 hover:text-white border border-dashed border-slate-700
                hover:border-slate-500 transition-colors"
            >
              <span>＋</span>
              <span>Folder nou</span>
            </button>
          )}

          <div className="pt-2">
            <button
              onClick={() => onConfirm(selectedId)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white
                font-medium rounded-xl text-sm transition-colors"
            >
              Adaugă în folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
