import React, { useState } from "react";
import { DEFAULT_SYSTEM_PROMPT, GROQ_MODELS, DEFAULT_GROQ_MODEL, isWebGPUAvailable } from "../lib/ragEngine";

interface Props {
  systemPrompt: string;
  groqApiKey: string; // păstrat pentru compatibilitate, nu mai e folosit
  groqModel: string;
  onSave: (systemPrompt: string, groqApiKey: string, groqModel: string) => void;
  onClose: () => void;
}

export default function SettingsModal({ systemPrompt, groqApiKey, groqModel, onSave, onClose }: Props) {
  const [tab, setTab] = useState<"prompt" | "groq">("prompt");
  const [prompt, setPrompt] = useState(systemPrompt);
  const [model, setModel] = useState(groqModel || DEFAULT_GROQ_MODEL);

  const webgpu = isWebGPUAvailable();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-700">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Setări</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setTab("prompt")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === "prompt" ? "text-white border-b-2 border-indigo-500" : "text-slate-400 hover:text-white"}`}
          >
            Instrucțiuni AI
          </button>
          <button
            onClick={() => setTab("groq")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${tab === "groq" ? "text-white border-b-2 border-indigo-500" : "text-slate-400 hover:text-white"}`}
          >
            Groq API
          </button>
        </div>

        <div className="p-5">
          {/* Tab: System Prompt */}
          {tab === "prompt" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Spune-i AI-ului cum să răspundă.</p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3
                  text-sm text-white placeholder-slate-500 resize-none
                  focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setPrompt(DEFAULT_SYSTEM_PROMPT)}
                  className="flex-1 px-4 py-2 text-sm text-slate-400 hover:text-white
                    border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
                >
                  Resetează
                </button>
                <button
                  onClick={() => { onSave(prompt, "", model); onClose(); }}
                  className="flex-1 px-4 py-2 text-sm text-white font-medium
                    bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
                >
                  Salvează
                </button>
              </div>
            </div>
          )}

          {/* Tab: Groq Model */}
          {tab === "groq" && (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                ${webgpu ? "bg-slate-700/50 text-slate-400" : "bg-green-900/30 text-green-400 border border-green-800"}`}>
                <span>{webgpu ? "ℹ️" : "✅"}</span>
                <span>
                  {webgpu
                    ? "Desktop cu WebGPU — AI rulează local. Groq e fallback pentru alte dispozitive."
                    : "iOS/Safari detectat — se folosește Groq API automat."}
                </span>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Model pentru iOS / fallback</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2
                    text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {GROQ_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-900 rounded-lg p-3 text-xs text-slate-500">
                Cheia Groq e configurată pe server — userii nu trebuie să facă nimic.
              </div>

              <button
                onClick={() => { onSave(prompt, "", model); onClose(); }}
                className="w-full px-4 py-2.5 text-sm text-white font-medium
                  bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
              >
                Salvează
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
