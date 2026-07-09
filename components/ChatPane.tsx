"use client";

import { FormEvent, KeyboardEvent, useState } from "react";
import type { ChatMessage } from "@/lib/shared/schemas";

type LocalMessage = Pick<ChatMessage, "id" | "role" | "content">;

export function ChatPane({ messages, onTurnComplete }: { messages: ChatMessage[]; onTurnComplete: () => Promise<void> }) {
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleMessages = [...messages, ...localMessages];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) return;

    setDraft("");
    setError(null);
    setIsSending(true);

    const userMessage: LocalMessage = { id: crypto.randomUUID(), role: "user", content: message };
    const assistantMessage: LocalMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setLocalMessages((current) => [...current, userMessage, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: "Chat request failed" }));
        throw new Error(payload.error ?? "Chat request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setLocalMessages((current) => current.map((item) => item.id === assistantMessage.id ? { ...item, content: item.content + chunk } : item));
      }

      await onTurnComplete();
      setLocalMessages([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chat failed");
      setLocalMessages([]);
      setDraft(message);
    } finally {
      setIsSending(false);
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section className="chat-pane">
      <div className="chat-header">
        <p className="eyebrow">Profile Builder</p>
        <h1>Tell Atlas how you like to travel</h1>
        <p>Chat naturally. The profile panel updates with durable preferences and flags contradictions.</p>
      </div>

      <div className="messages">
        {visibleMessages.length === 0 && (
          <div className="empty-state">Try: &quot;I live in Denver, like food trips, and I am considering Tokyo in the fall.&quot;</div>
        )}
        {visibleMessages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <strong>{message.role === "user" ? "You" : "Atlas"}</strong>
            <p>{message.content || "..."}</p>
          </article>
        ))}
      </div>

      {error && <p className="error-banner">{error}</p>}

      <form className="composer" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={submitOnEnter}
          placeholder="Share a travel preference or ask about a destination..."
        />
        <button disabled={isSending}>{isSending ? "Sending" : "Send"}</button>
      </form>
    </section>
  );
}
