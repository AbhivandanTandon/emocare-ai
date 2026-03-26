import { create } from 'zustand';

export const useChatStore = create((set) => ({
  // Current session
  messages: [],
  sessionId: null,
  currentRisk: 'Low',
  isAnalyzing: false,

  // All sessions (history)
  sessions: [],
  sessionsLoading: false,
  activeSessionId: null,

  // Current session actions
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
  setSessionId: (id) => set({ sessionId: id, activeSessionId: id }),
  setRisk: (level) => set({ currentRisk: level }),

  // Start a brand new chat
  newChat: () => set({
    messages: [],
    sessionId: null,
    activeSessionId: null,
    currentRisk: 'Low',
    isAnalyzing: false,
  }),

  // Load a session's messages into the current view
  loadSession: (sessionId, messages, riskLabel) => set({
    sessionId,
    activeSessionId: sessionId,
    currentRisk: riskLabel || 'Low',
    isAnalyzing: false,
    messages: messages.map((m, i) => ({
      id: m.id || `loaded-${i}`,
      role: m.role,
      content: m.content,
      fusion: m.prediction,
      escalation: m.prediction?.clinical?.escalation_level,
      loaded: true,
    })),
  }),

  // Sessions list
  setSessions: (sessions) => set({ sessions }),
  setSessionsLoading: (v) => set({ sessionsLoading: v }),

  deleteSessionFromList: (sessionId) => set((s) => ({
    sessions: s.sessions.filter((sess) => sess.id !== sessionId),
  })),
}));