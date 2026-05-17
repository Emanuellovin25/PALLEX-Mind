import React, { useEffect, useRef, useState } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Props {
  messages: Message[];
  loading: boolean;
  disabled: boolean;
  disabledReason?: string;
  chatName: string;
  onSend: (text: string) => void;
  onMenuOpen: () => void;
  onOpenSettings: () => void;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm shrink-0 mt-1">
          🤖
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? "bg-indigo-600 text-white rounded-tr-sm"
            : "bg-slate-800 text-slate-100 rounded-tl-sm"
          }`}
      >
        <div
          className="chat-content whitespace-pre-wrap"
          dangerouslySetInnerHTML={{
            __html: msg.content
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/`([^`]+)`/g, "<code>$1</code>")
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
              .replace(/\n/g, "<br/>"),
          }}
        />
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm shrink-0 mt-1">
          👤
        </div>
      )}
    </div>
  );
}

export default function Chat({
  messages, loading, disabled, disabledReason,
  chatName, onSend, onMenuOpen, onOpenSettings,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading || disabled) return;
    setInput("");
    onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-[#0f172a]">
        <button onClick={onMenuOpen} className="md:hidden text-slate-400 hover:text-white">☰</button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-sm truncate">{chatName}</h1>
          <p className="text-xs text-slate-500">Pall-Ex Mind · offline · privat</p>
        </div>
        <button
          onClick={onOpenSettings}
          className="text-slate-400 hover:text-white transition-colors"
          title="Instrucțiuni AI"
        >
          ⚙️
        </button>
        <div className={`w-2 h-2 rounded-full ${disabled ? "bg-yellow-500 animate-pulse" : "bg-green-500"}`} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
            <div className="text-5xl">💬</div>
            <p className="text-base font-medium text-slate-400">Bun venit în Pall-Ex Mind</p>
            <p className="text-sm text-center max-w-xs">
              Adaugă PDFs din sidebar și pune orice întrebare despre ele.
              Totul rulează în browserul tău.
            </p>
          </div>
        )}
        {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm shrink-0">🤖</div>
            <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-slate-700 bg-[#0f172a]">
        {disabled && disabledReason && (
          <p className="text-xs text-yellow-500 mb-2 text-center">{disabledReason}</p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            placeholder={disabled ? "Se încarcă modelul…" : "Pune o întrebare despre documentele tale…"}
            className="flex-1 resize-none bg-slate-800 border border-slate-700
              rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500
              focus:outline-none focus:border-indigo-500 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={disabled || loading || !input.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl
              bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700
              text-white transition-colors shrink-0"
          >
            ↑
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 text-center">
          Enter trimite · Shift+Enter linie nouă
        </p>
      </div>
    </div>
  );
}
