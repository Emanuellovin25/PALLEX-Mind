import React, { useState } from "react";
import { DEFAULT_SYSTEM_PROMPT } from "../lib/ragEngine";

interface Props {
  value: string;
  onSave: (prompt: string) => void;
  onClose: () => void;
}

export default function SystemPromptModal({ value, onSave, onClose }: Props) {
  const [text, setText] = useState(value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-slate-700">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-semibold">Instrucțiuni AI</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Spune-i robotului cum să răspundă
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3
              text-sm text-white placeholder-slate-500 resize-none
              focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="Scrie instrucțiunile pentru AI..."
          />

          <div className="flex gap-2">
            <button
              onClick={() => setText(DEFAULT_SYSTEM_PROMPT)}
              className="flex-1 px-4 py-2 text-sm text-slate-400 hover:text-white
                border border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
            >
              Resetează la default
            </button>
            <button
              onClick={() => { onSave(text); onClose(); }}
              className="flex-1 px-4 py-2 text-sm text-white font-medium
                bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Salvează
            </button>
          </div>

          <div className="bg-slate-900 rounded-lg p-3">
            <p className="text-xs text-slate-500 font-medium mb-1">Exemple de instrucțiuni:</p>
            <ul className="text-xs text-slate-500 space-y-1">
              <li>• "Răspunde DOAR în română, formal și concis"</li>
              <li>• "Ești un expert juridic. Citează articolele relevante."</li>
              <li>• "Răspunde ca un profesor, cu explicații simple"</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
