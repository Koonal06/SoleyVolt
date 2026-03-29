import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_LANGUAGE_EVENT, getStoredLanguage, type AppLanguage } from "../lib/language";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

const STORAGE_KEY = "soleyvolt-assistant-chat";
const API_URL = (import.meta.env.VITE_ASSISTANT_API_URL ?? "").trim();
const MODEL = "llama3.2:1b";
const MAX_CONTEXT_MESSAGES = 6;

const KNOWLEDGE = `
You are the SoleyVolt Assistant inside the SoleyVolt web app.

Project context:
SoleyVolt is a digital energy platform for tracking imported energy, exported energy, energy-linked credits, wallets, and bill offset activity.
SoleyVolt uses energy readings, wallet balances, transfer history, and account roles inside a web portal.
Do not describe the product as a cryptocurrency exchange.

Coin logic:
- Red Coins = bill obligation from electricity consumption
- Yellow Coins = earned credits from surplus production
- Green Coins = purchased premium credits used to reduce bills

Portal rules:
- role = portal access level
- user_type = energy behavior type

Roles:
- user -> normal user portal
- staff accounts use protected internal portals that are not described on public pages

User types:
- consumer = mostly consumes electricity, usually gets Red Coins, can buy Green Coins, should not normally earn Yellow Coins
- producer = mainly produces electricity, earns Yellow Coins, should not normally receive Red Coins
- prosumer = both consumes and produces, can receive Red or Yellow Coins, can also buy Green Coins

Login redirect rules:
- if role = user -> /app/dashboard

User portal routes:
- /app/dashboard
- /app/wallet
- /app/bill
- /app/history
- /app/settings

Dashboard behavior:
- consumer dashboard focuses on consumption, Red Coins, bill estimate, Green Coin purchase, bill reduction summary
- producer dashboard focuses on exported energy, Yellow Coin earnings, production history, stored credits, future bill-offset projection
- prosumer dashboard shows imported energy, exported energy, net energy, Red Coins, Yellow Coins, Green Coin purchase, wallet summary, bill estimate

Design rules:
- user portal must feel simple, friendly, and personal
- user portal = simple, friendly, personal

Access control:
- users must only access the routes allowed for their account
- use protected routes and redirects

Language support:
- English
- French
- Mauritian Creole
- visible language switcher on login and inside portal
- selected language should persist in settings or local storage

Answer as a helpful in-product assistant.
Be practical, accurate, concise, and natural.
Do not invent features outside this specification.
`;

const RESPONSE_RULES = `
Response rules:
- Think through the answer carefully, but do not show chain-of-thought.
- Give the final answer directly and clearly.
- Keep answers short by default unless the user asks for detail.
- When relevant, use bullets or short steps.
- If the question is outside the SoleyVolt specification, say that clearly instead of inventing details.
- If the user asks about routes, roles, or coins, answer with exact platform rules.
- Match the user's language and tone.
- Sound like a helpful product assistant, not documentation.
- Prefer guidance tied to the current page when useful.
- Avoid dumping long rules unless the user asks for them.
`;

const languageNames: Record<AppLanguage, string> = {
  en: "English",
  fr: "French",
  cr: "Mauritian Creole",
};

const uiCopy = {
  en: {
    welcome:
      "Hi, I'm the SoleyVolt Assistant. I can help with wallets, coins, dashboards, routes, and how the platform works.",
    title: "SoleyVolt Support Chat",
    subtitle: "AI Assistant",
    newChat: "New chat",
    liveOn: "Live on",
    replyLanguage: "Reply language",
    thinking: "Thinking...",
    placeholder: "Ask about routes, roles, coins, dashboards, or this page...",
    send: "Send message",
    serverError: "Unable to reach the SoleyVolt assistant right now.",
  },
  fr: {
    welcome:
      "Bonjour, je suis l'assistant SoleyVolt. Je peux vous aider avec les portefeuilles, les coins, les tableaux de bord, les routes et le fonctionnement de la plateforme.",
    title: "Chat d'assistance SoleyVolt",
    subtitle: "Assistant IA",
    newChat: "Nouveau chat",
    liveOn: "Actif sur",
    replyLanguage: "Langue de reponse",
    thinking: "Je reflechis...",
    placeholder: "Posez une question sur les routes, les roles, les coins, les tableaux de bord ou cette page...",
    send: "Envoyer le message",
    serverError: "Impossible de joindre l'assistant SoleyVolt pour le moment.",
  },
  cr: {
    welcome:
      "Bonzur, mwa asistan SoleyVolt. Mo kapav ed twa lor wallet, coins, dashboard, routes ek fason platform-la marse.",
    title: "Chat sipor SoleyVolt",
    subtitle: "Asistan IA",
    newChat: "Nouvo chat",
    liveOn: "Aktif lor",
    replyLanguage: "Lang repons",
    thinking: "Pe reflesi...",
    placeholder: "Demann lor routes, roles, coins, dashboard ouswa sa page-la...",
    send: "Avoy mesaz",
    serverError: "Pa pe kapav zwenn asistan SoleyVolt pou le moman.",
  },
} satisfies Record<
  AppLanguage,
  {
    welcome: string;
    title: string;
    subtitle: string;
    newChat: string;
    liveOn: string;
    replyLanguage: string;
    thinking: string;
    placeholder: string;
    send: string;
    serverError: string;
  }
>;

function getRouteLabel(pathname: string) {
  if (pathname === "/") {
    return "landing page";
  }
  if (pathname === "/login" || pathname === "/auth") {
    return "user authentication page";
  }
  if (pathname.startsWith("/app/dashboard") || pathname === "/app") {
    return "user dashboard";
  }
  if (pathname.startsWith("/app/wallet")) {
    return "user wallet page";
  }
  if (pathname.startsWith("/app/bill")) {
    return "user bill page";
  }
  if (pathname.startsWith("/app/history")) {
    return "user history page";
  }
  if (pathname.startsWith("/app/settings")) {
    return "user settings page";
  }
  if (pathname.startsWith("/admin") || pathname.startsWith("/super-admin")) {
    return "restricted staff page";
  }
  return `page ${pathname}`;
}

function buildContextBlock(language: AppLanguage, pathname: string) {
  return `
Current app context:
- Current language preference: ${languageNames[language]}
- Reply in ${languageNames[language]} unless the user explicitly asks for another language
- Current route: ${pathname}
- Current page meaning: ${getRouteLabel(pathname)}
`;
}

function getStarterMessages(language: AppLanguage): ChatMessage[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      content: uiCopy[language].welcome,
    },
  ];
}

function buildPrompt(messages: ChatMessage[], language: AppLanguage, pathname: string) {
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const transcript = recentMessages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n\n");

  return `${KNOWLEDGE.trim()}\n\n${RESPONSE_RULES.trim()}\n\n${buildContextBlock(language, pathname).trim()}\n\nConversation:\n${transcript}\n\nAssistant:`;
}

async function askAI(
  message: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(API_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: message,
      stream: true,
      options: {
        temperature: 0.2,
        top_p: 0.85,
        num_predict: 180,
        num_ctx: 2048,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Server error: " + response.status);
  }

  if (!response.body) {
    throw new Error("Streaming response not available.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullResponse = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const data = JSON.parse(trimmed) as { response?: string; done?: boolean };
      if (data.response) {
        fullResponse += data.response;
        onChunk(fullResponse);
      }
    }
  }

  if (buffer.trim()) {
    const data = JSON.parse(buffer.trim()) as { response?: string };
    if (data.response) {
      fullResponse += data.response;
      onChunk(fullResponse);
    }
  }

  return fullResponse;
}

export function SoleyVoltAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<AppLanguage>(() => getStoredLanguage());
  const localizedUi = uiCopy[language];
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const currentLanguage = getStoredLanguage();
    if (typeof window === "undefined") {
      return getStarterMessages(currentLanguage);
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return getStarterMessages(currentLanguage);
    }

    try {
      const parsed = JSON.parse(saved) as ChatMessage[];
      return parsed.length > 0 ? parsed : getStarterMessages(currentLanguage);
    } catch {
      return getStarterMessages(currentLanguage);
    }
  });
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const shouldRenderAssistant = Boolean(API_URL) && pathname.startsWith("/app");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncLanguage = () => setLanguage(getStoredLanguage());
    const syncLocation = () => setPathname(window.location.pathname);

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args) {
      originalPushState(...args);
      window.dispatchEvent(new Event("locationchange"));
    };

    window.history.replaceState = function (...args) {
      originalReplaceState(...args);
      window.dispatchEvent(new Event("locationchange"));
    };

    window.addEventListener("storage", syncLanguage);
    window.addEventListener(APP_LANGUAGE_EVENT, syncLanguage);
    window.addEventListener("popstate", syncLocation);
    window.addEventListener("locationchange", syncLocation);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener(APP_LANGUAGE_EVENT, syncLanguage);
      window.removeEventListener("popstate", syncLocation);
      window.removeEventListener("locationchange", syncLocation);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncLanguage = () => setLanguage(getStoredLanguage());
    window.addEventListener("focus", syncLanguage);
    return () => window.removeEventListener("focus", syncLanguage);
  }, []);

  useEffect(() => {
    if (!bodyRef.current) {
      return;
    }

    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, isOpen]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const sendMessage = async () => {
    const nextMessage = input.trim();
    if (!nextMessage || isSending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: nextMessage,
    };

    const updatedMessages = [...messages, userMessage];
    const assistantMessageId = `${Date.now()}-assistant`;
    setMessages(updatedMessages);
    setInput("");
    setIsSending(true);
    setError("");
    setMessages([
      ...updatedMessages,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
      },
    ]);

    try {
      const controller = new AbortController();
      requestAbortRef.current = controller;

      const answer = (
        await askAI(
          buildPrompt(updatedMessages, language, pathname),
          (partial) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId ? { ...message, content: partial } : message,
              ),
            );
          },
          controller.signal,
        )
      ).trim();

      if (!answer) {
        throw new Error("The assistant did not return a reply.");
      }
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== assistantMessageId));
      setError(err instanceof Error ? err.message : localizedUi.serverError);
    } finally {
      requestAbortRef.current = null;
      setIsSending(false);
    }
  };

  const clearChat = () => {
    requestAbortRef.current?.abort();
    setMessages(getStarterMessages(language));
    setError("");
    setIsSending(false);
  };

  if (!shouldRenderAssistant) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-5 right-5 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f2b61f,#f59e0b,#1f8f74)] text-slate-950 shadow-[0_22px_50px_rgba(15,23,42,0.34)] transition hover:scale-[1.03] hover:brightness-105"
        aria-label="Open SoleyVolt Assistant"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {isOpen ? (
        <section className="fixed bottom-24 right-5 z-[70] flex h-[min(42rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.8rem] border border-white/12 bg-[linear-gradient(180deg,rgba(7,20,43,0.97),rgba(9,37,75,0.96),rgba(7,58,53,0.95))] text-white shadow-[0_32px_120px_rgba(2,6,23,0.45)] backdrop-blur-xl">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-amber-200/85">{localizedUi.subtitle}</p>
                  <h2 className="text-lg font-semibold">{localizedUi.title}</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={clearChat}
                className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                {localizedUi.newChat}
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/68">
              {localizedUi.liveOn} {getRouteLabel(pathname)}. {localizedUi.replyLanguage}: {languageNames[language]}.
            </p>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-[1.4rem] px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "bg-amber-300 text-slate-950"
                      : "border border-white/10 bg-white/10 text-white/88"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {isSending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/75">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {localizedUi.thinking}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 p-4">
            {error ? (
              <div className="mb-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="rounded-[1.5rem] border border-white/10 bg-white/8 p-2">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={2}
                  placeholder={localizedUi.placeholder}
                  className="min-h-16 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-white/40"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!canSend}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={localizedUi.send}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
