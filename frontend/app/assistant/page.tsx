"use client";

import { FormEvent, useState } from "react";
import { Bot, Send, UserRound } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useLiveStream } from "@/hooks/use-live-stream";

type Message = { role: "user" | "assistant"; content: string };

export default function AssistantPage() {
  const stream = useLiveStream();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Ask me why an API failed, which endpoint is unstable, or what to debug next. I use Groq only." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    const question = input;
    setInput("");
    setMessages((current) => [...current, { role: "user", content: question }]);
    setLoading(true);
    const response = await api.chat(question);
    setMessages((current) => [...current, { role: "assistant", content: response.answer }]);
    setLoading(false);
  };

  return (
    <AppShell connected={stream.connected}>
      <div className="mb-5">
        <p className="text-sm text-cyan-200">Groq-powered incident copilot</p>
        <h1 className="mt-1 text-3xl font-semibold text-white">AI Incident Chat Assistant</h1>
      </div>
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-cyan-200" />
            PulseRoot AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 h-[58vh] space-y-3 overflow-auto rounded-md border border-white/10 bg-black/25 p-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-lg border p-3 text-sm leading-6 ${message.role === "user" ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-white/[0.06]"}`}>
                  <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                    {message.role === "user" ? <UserRound className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {message.role}
                  </div>
                  {message.content}
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-zinc-500">Groq is analyzing the latest incidents...</div>}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Why did Payment API fail?" />
            <Button type="submit" disabled={loading}>
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  );
}
