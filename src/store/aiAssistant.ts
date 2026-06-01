import { create } from 'zustand';
import { callClaude, executeTool, getApiKey, type ClaudeMessage } from '@/services/aiAssistant';

// Displayed in the UI — separate from the raw API messages.
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text?: string;              // for user/assistant text bubbles
  toolName?: string;          // for 'tool' rows
  toolInput?: any;
  toolResult?: any;
  toolStatus?: 'ok' | 'error';
  ts: number;
}

interface AIAssistantState {
  panelOpen: boolean;
  apiKeyConfigured: boolean;
  messages: ChatMessage[];      // user-facing
  rawMessages: ClaudeMessage[]; // sent to API (includes tool_use/tool_result blocks)
  isLoading: boolean;
  error: string | null;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  refreshKeyState: () => void;
  clearChat: () => void;
  sendMessage: (text: string) => Promise<void>;
}

function uid() { return Math.random().toString(36).slice(2, 11); }

export const useAIAssistant = create<AIAssistantState>((set, get) => ({
  panelOpen: false,
  apiKeyConfigured: !!getApiKey(),
  messages: [],
  rawMessages: [],
  isLoading: false,
  error: null,

  openPanel: () => set({ panelOpen: true, apiKeyConfigured: !!getApiKey() }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen, apiKeyConfigured: !!getApiKey() })),
  refreshKeyState: () => set({ apiKeyConfigured: !!getApiKey() }),
  clearChat: () => set({ messages: [], rawMessages: [], error: null }),

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      set({ error: 'Configure sua Anthropic API key em Configurações → 🤖 AI Assistant.' });
      return;
    }

    const userMsg: ChatMessage = { id: uid(), role: 'user', text: trimmed, ts: Date.now() };
    const userApi: ClaudeMessage = { role: 'user', content: trimmed };
    set((s) => ({
      messages: [...s.messages, userMsg],
      rawMessages: [...s.rawMessages, userApi],
      isLoading: true,
      error: null
    }));

    try {
      // Conversation loop — keep going as long as Claude requests tools (max 8 cycles)
      let cycle = 0;
      while (cycle < 8) {
        cycle++;
        const result = await callClaude(apiKey, get().rawMessages);

        // Append assistant's response (raw) to history
        set((s) => ({ rawMessages: [...s.rawMessages, result.assistantMessage] }));

        // Extract text + tool uses
        const content = Array.isArray(result.assistantMessage.content) ? result.assistantMessage.content : [];
        const texts: string[] = [];
        for (const block of content) {
          if (block.type === 'text' && block.text) texts.push(block.text);
        }
        if (texts.length) {
          const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', text: texts.join('\n'), ts: Date.now() };
          set((s) => ({ messages: [...s.messages, assistantMsg] }));
        }

        if (result.toolUses.length === 0 || result.stopReason !== 'tool_use') {
          break;
        }

        // Execute each tool and collect results
        const toolResults: any[] = [];
        for (const tu of result.toolUses) {
          let res: any;
          let status: 'ok' | 'error' = 'ok';
          try {
            res = await executeTool(tu.name, tu.input || {});
            if (res && typeof res === 'object' && res.error) status = 'error';
          } catch (e: any) {
            res = { error: e?.message || 'erro' };
            status = 'error';
          }
          // Add to user-facing chat
          const toolMsg: ChatMessage = {
            id: uid(), role: 'tool', toolName: tu.name, toolInput: tu.input,
            toolResult: res, toolStatus: status, ts: Date.now()
          };
          set((s) => ({ messages: [...s.messages, toolMsg] }));
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(res)
          });
        }

        // Send results back to Claude in a user message
        const followUp: ClaudeMessage = { role: 'user', content: toolResults };
        set((s) => ({ rawMessages: [...s.rawMessages, followUp] }));
      }
    } catch (e: any) {
      set({ error: e?.message || 'Erro desconhecido' });
      const errMsg: ChatMessage = {
        id: uid(), role: 'assistant',
        text: `❌ Erro: ${e?.message || 'falha ao chamar Claude'}`,
        ts: Date.now()
      };
      set((s) => ({ messages: [...s.messages, errMsg] }));
    } finally {
      set({ isLoading: false });
    }
  }
}));
