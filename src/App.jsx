import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

// Dynamic API endpoint: support Vercel environment variables (VITE_API_BASE_URL / VITE_API_KEY) with local fallback
const HOSTNAME = window.location.hostname || 'localhost';
const DEFAULT_BASE_URL = `http://${HOSTNAME}:3001`;
const BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;

const API_URL = `${BASE_URL}/v1/chat/completions`;
const STATS_URL = `${BASE_URL}/v1/token-stats`;
const API_KEY = import.meta.env.VITE_API_KEY || "freellmapi-de8a023fe9fa683dea39442bfc2ee422fabef2acecbc4d57";
const MODEL_NAME = import.meta.env.VITE_MODEL_NAME || "auto:default";

// Vercel Serverless / Backend DB API endpoints (Neon)
const DB_AUTH_URL = '/api/auth';
const DB_CHATS_URL = '/api/chats';

const PLATFORM_COLORS = {
  google: "#4285F4",
  groq: "#F55036",
  mistral: "#FA5252",
  openrouter: "#10a37f",
  cloudflare: "#F38020",
  huggingface: "#FFD21E",
  cerebras: "#A855F7"
};

function formatTokenNum(num) {
  if (!num) return "0";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("wavy_react_history") || "[]");
    } catch {
      return [];
    }
  });
  const [currentChatId, setCurrentChatId] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }

  // Auth / Login state
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("wavy_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Token stats modal
  const [tokenStats, setTokenStats] = useState({
    remainingTokens: 1136000000,
    totalBudget: 1136000000,
    totalUsed: 0,
    percentRemaining: "99.99",
    models: []
  });
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  // Streaming / typewriter state for last assistant message
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [displayedStreamingText, setDisplayedStreamingText] = useState("");

  // Scroll tracking & scroll to bottom button
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Track scroll position in chat messages container
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceToBottom < 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(distanceToBottom > 160);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Sync with Neon DB on user login / change
  useEffect(() => {
    if (!user || !user.id) return;
    const loadUserChatsFromNeon = async () => {
      try {
        const res = await fetch(`${DB_CHATS_URL}?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.chats) && data.chats.length > 0) {
            setChatHistory(data.chats);
          }
        }
      } catch (err) {
        console.warn("Neon DB sync (offline or local fallback):", err);
      }
    };
    loadUserChatsFromNeon();
  }, [user?.id]);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("wavy_react_history", JSON.stringify(chatHistory.slice(0, 30)));
  }, [chatHistory]);

  // Save user session
  useEffect(() => {
    if (user) {
      localStorage.setItem("wavy_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("wavy_user");
    }
  }, [user]);

  // Sync a chat to Neon DB
  const syncChatToNeon = async (chat) => {
    if (!user || !user.id || !chat) return;
    try {
      await fetch(DB_CHATS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        },
        body: JSON.stringify({ chat })
      });
    } catch (err) {
      console.warn("Could not sync chat to Neon DB:", err);
    }
  };

  // Delete a chat from Neon DB
  const deleteChatFromNeon = async (chatId) => {
    if (!user || !user.id || !chatId) return;
    try {
      await fetch(`${DB_CHATS_URL}?chatId=${chatId}&userId=${user.id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Could not delete chat from Neon DB:", err);
    }
  };

  // Fetch token stats
  const fetchTokenStats = async () => {
    try {
      const res = await fetch(STATS_URL, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTokenStats(data);
      }
    } catch (err) {
      console.warn("Could not fetch token stats", err);
    }
  };

  useEffect(() => {
    fetchTokenStats();
    const interval = setInterval(fetchTokenStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Textarea height auto-adjust
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setInput("");
    setAttachedFiles([]);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const requestDeleteChat = (e, chat) => {
    e.stopPropagation();
    setDeleteTarget(chat);
  };

  const confirmDeleteChat = () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setChatHistory(prev => prev.filter(c => c.id !== targetId));
    deleteChatFromNeon(targetId);
    if (currentChatId === targetId) {
      startNewChat();
    }
    setDeleteTarget(null);
  };

  const cancelDeleteChat = () => {
    setDeleteTarget(null);
  };

  const loadChat = (chat) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages || []);
    setAttachedFiles([]);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
    setTimeout(() => scrollToBottom('auto'), 50);
  };

  // Handle file attachment
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      // Basic size check (15MB)
      if (file.size > 15 * 1024 * 1024) {
        alert(`File "${file.name}" is larger than 15MB`);
        return;
      }

      const reader = new FileReader();
      const isImg = file.type.startsWith("image/");
      const isTxt = file.type.startsWith("text/") || 
                    file.name.match(/\.(txt|md|js|jsx|ts|tsx|json|html|css|py|java|c|cpp|rs|go|sh|csv|yaml|yml)$/i);

      if (isImg) {
        reader.onload = (event) => {
          setAttachedFiles(prev => [...prev, {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: file.type,
            isImage: true,
            dataUrl: event.target.result
          }]);
        };
        reader.readAsDataURL(file);
      } else if (isTxt) {
        reader.onload = (event) => {
          setAttachedFiles(prev => [...prev, {
            id: Date.now() + Math.random(),
            name: file.name,
            size: file.size,
            type: file.type,
            isText: true,
            content: event.target.result
          }]);
        };
        reader.readAsText(file);
      } else {
        // Generic binary/doc
        setAttachedFiles(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          isGeneric: true
        }]);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachedFile = (fileId) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Stream simulation (typewriter effect) for smooth readable generation
  const streamText = (fullText, msgId, updatedMessages, chatId, chatTitle) => {
    setStreamingMessageId(msgId);
    setDisplayedStreamingText("");

    let currentIdx = 0;
    const totalLen = fullText.length;
    // Faster dynamic chunking: completes in ~0.5 - 1.2s max with snappy 8ms tick
    const step = Math.max(3, Math.ceil(totalLen / 35));

    const interval = setInterval(() => {
      currentIdx += step;
      if (currentIdx >= totalLen) {
        currentIdx = totalLen;
        clearInterval(interval);
        setDisplayedStreamingText(fullText);
        setStreamingMessageId(null);
        // Persist final message to history & Neon DB
        setChatHistory(prev => {
          const updated = prev.map(c => c.id === chatId ? { ...c, messages: updatedMessages } : c);
          const currentChatObj = updated.find(c => c.id === chatId) || { id: chatId, title: chatTitle, messages: updatedMessages };
          syncChatToNeon(currentChatObj);
          return updated;
        });
        fetchTokenStats();
      } else {
        setDisplayedStreamingText(fullText.slice(0, currentIdx));
      }

      // Only scroll down during generation if user was already at bottom!
      if (isNearBottomRef.current) {
        scrollToBottom('smooth');
      }
    }, 8);
  };

  const handleSend = async (textToSend) => {
    const rawText = (textToSend !== undefined ? textToSend : input).trim();
    if ((!rawText && attachedFiles.length === 0) || loading) return;

    // Build user content with attachments if present
    let promptPayload = rawText;
    const currentFiles = [...attachedFiles];
    if (currentFiles.length > 0) {
      const fileSummaries = currentFiles.map(f => {
        if (f.isText && f.content) {
          return `\n--- File: ${f.name} ---\n${f.content.slice(0, 15000)}\n--- End of ${f.name} ---`;
        }
        return `\n[Attached File: ${f.name} (${(f.size / 1024).toFixed(1)} KB)]`;
      }).join("\n");
      promptPayload = rawText ? `${rawText}\n\n${fileSummaries}` : `Here are the attached files:\n${fileSummaries}`;
    }

    // Always immediately scroll to bottom on user send!
    isNearBottomRef.current = true;
    setShowScrollBottom(false);

    // Create session if not active
    let chatId = currentChatId;
    let chatTitle = "New Chat";
    const titleText = rawText || currentFiles[0]?.name || "New Chat";
    if (!chatId) {
      chatId = Date.now().toString();
      setCurrentChatId(chatId);
      chatTitle = titleText.length > 28 ? titleText.slice(0, 28) + "..." : titleText;
      setChatHistory(prev => [{ id: chatId, title: chatTitle, messages: [] }, ...prev]);
    } else {
      const existing = chatHistory.find(c => c.id === chatId);
      if (existing) chatTitle = existing.title;
    }

    const userMessageObj = {
      id: "u_" + Date.now(),
      role: "user",
      content: rawText,
      files: currentFiles.length > 0 ? currentFiles : undefined
    };

    const newMessages = [...messages, userMessageObj];
    setMessages(newMessages);
    setInput("");
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setLoading(true);

    // Sync user message to Neon
    syncChatToNeon({ id: chatId, title: chatTitle, messages: newMessages });

    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: [{ role: "user", content: promptPayload }]
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "(ไม่มีคำตอบ)";
      const assistantMsgId = "a_" + Date.now();

      const finalAssistantMsg = { id: assistantMsgId, role: "assistant", content: reply };
      const updated = [...newMessages, finalAssistantMsg];
      setMessages(updated);

      // Start typewriter effect
      streamText(reply, assistantMsgId, updated, chatId, chatTitle);

    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: "err_" + Date.now(), role: "assistant", content: `**ข้อผิดพลาด:** ${err.message}` }
      ]);
      if (isNearBottomRef.current) scrollToBottom('smooth');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auth submission: Neon PostgreSQL connected!
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    if (!authEmail || !authPassword) {
      setAuthError("Please fill in email and password");
      setAuthLoading(false);
      return;
    }

    try {
      const res = await fetch(DB_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          email: authEmail,
          password: authPassword,
          name: authName
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setUser(data.user);
      setAuthModalOpen(false);
      resetAuthFields();
    } catch (err) {
      // If local dev or offline, fallback gracefully with alert indicator
      console.warn("Neon auth error, using fallback session:", err.message);
      setAuthError(err.message || "Failed to connect to Neon database");
    } finally {
      setAuthLoading(false);
    }
  };

  const resetAuthFields = () => {
    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    setAuthError("");
  };

  const handleLogout = () => {
    setUser(null);
    setChatHistory([]);
    startNewChat();
  };

  return (
    <div className="app-layout">
      {/* Mobile Backdrop */}
      <div 
        className={`mobile-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="sidebar-top">
          <button className="new-chat-btn" onClick={startNewChat}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>New chat</span>
          </button>
        </div>

        <div className="history-list">
          <div className="history-label">Recent Chats</div>
          {chatHistory.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '0.8rem', color: '#666' }}>
              No chats yet
            </div>
          ) : (
            chatHistory.map(chat => (
              <div 
                key={chat.id}
                className={`history-item ${chat.id === currentChatId ? "active" : ""}`}
                onClick={() => loadChat(chat)}
              >
                <span className="history-item-title">{chat.title}</span>
                <button 
                  className="history-item-del"
                  onClick={(e) => requestDeleteChat(e, chat)}
                  title="Delete chat"
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          {user ? (
            <div className="user-profile-card">
              <div 
                className="user-pill clickable"
                onClick={() => setTokenModalOpen(true)}
                title="View token quota and statistics"
              >
                <div className="avatar-sm user-avatar-logged">{user.avatarInitial}</div>
                <div className="user-meta">
                  <span className="user-name">{user.name}</span>
                  <span className="plan-badge">Neon Cloud Sync</span>
                </div>
              </div>
              <button 
                className="logout-small-btn"
                onClick={handleLogout}
                title="Sign out"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className="auth-prompt-box">
              <div className="auth-prompt-text">
                <span className="auth-prompt-title">Neon Cloud Storage</span>
                <span className="auth-prompt-sub">Sign in to sync your chats</span>
              </div>
              <button 
                className="sidebar-login-btn"
                onClick={() => {
                  setAuthMode("login");
                  setAuthModalOpen(true);
                }}
              >
                Sign in / Register
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="token-modal-overlay" onClick={cancelDeleteChat}>
          <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 className="confirm-modal-title">Delete chat?</h3>
            <p className="confirm-modal-desc">
              This will permanently delete "<strong>{deleteTarget.title}</strong>". This action cannot be undone.
            </p>
            <div className="confirm-modal-actions">
              <button className="btn-secondary" onClick={cancelDeleteChat}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDeleteChat}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Login & Register Modal (Neon Database Connected) */}
      {authModalOpen && (
        <div className="token-modal-overlay" onClick={() => setAuthModalOpen(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="auth-modal-header">
              <div className="auth-modal-brand">
                <div className="brand-glow-circle">W</div>
                <div>
                  <h3>{authMode === "login" ? "Welcome back to WAVY" : "Create WAVY account"}</h3>
                  <p className="auth-sub">Neon Cloud Database Sync Enabled</p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setAuthModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authError && <div className="auth-error-banner">{authError}</div>}

              {authMode === "signup" && (
                <div className="auth-input-group">
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    placeholder="Wavy Explorer" 
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                  />
                </div>
              )}

              <div className="auth-input-group">
                <label>Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="name@company.com" 
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>

              <div className="auth-input-group">
                <label>Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                {authLoading ? "Connecting to Neon DB..." : (authMode === "login" ? "Sign In to WAVY" : "Create Account")}
              </button>
            </form>

            <div className="auth-footer-switch">
              {authMode === "login" ? (
                <p>
                  Don't have an account?{" "}
                  <button type="button" onClick={() => { setAuthMode("signup"); setAuthError(""); }}>
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }}>
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Token Details / Model Breakdown Modal */}
      {tokenModalOpen && (
        <div className="token-modal-overlay" onClick={() => setTokenModalOpen(false)}>
          <div className="token-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="token-modal-header">
              <div className="modal-title-wrap">
                <div className="modal-badge-dot"></div>
                <div>
                  <h3>AI Model Quota & Engine Pool</h3>
                  <span className="modal-sub">FreeLLMAPI Unified Gateway Pool</span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setTokenModalOpen(false)}>✕</button>
            </div>

            <div className="token-modal-stats">
              <div className="stat-box">
                <span className="stat-label">Available Tokens</span>
                <span className="stat-value green">{formatTokenNum(tokenStats.remainingTokens)}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Monthly Pool</span>
                <span className="stat-value">{formatTokenNum(tokenStats.totalBudget)}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Consumed</span>
                <span className="stat-value orange">{formatTokenNum(tokenStats.totalUsed)}</span>
              </div>
            </div>

            {/* Segmented color bar inside modal */}
            <div className="modal-bar-label">
              <span>Pool Distribution by Model ({tokenStats.percentRemaining}% available)</span>
            </div>
            <div className="token-progress-container modal-bar">
              <div className="token-progress-bar">
                {tokenStats.models && tokenStats.models.map((m, idx) => {
                  if (m.budget <= 0) return null;
                  const pct = (m.budget / tokenStats.totalBudget) * 100;
                  return (
                    <div 
                      key={idx}
                      className="token-segment"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: PLATFORM_COLORS[m.platform.toLowerCase()] || "#666"
                      }}
                      title={`${m.name} (${m.platform}): ${formatTokenNum(m.budget)}`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Model List Breakdown */}
            <div className="modal-model-list">
              {tokenStats.models && tokenStats.models.map((m, idx) => {
                if (m.budget <= 0) return null;
                const color = PLATFORM_COLORS[m.platform.toLowerCase()] || "#888";
                return (
                  <div key={idx} className="modal-model-row">
                    <span className="model-dot" style={{ backgroundColor: color }} />
                    <div className="model-info-block">
                      <span className="model-name">{m.name}</span>
                      <span className="model-provider-badge">{m.platform}</span>
                    </div>
                    <span className="model-budget">{formatTokenNum(m.budget)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Wrapper */}
      <div className="main-wrapper">
        <header className="top-nav">
          <div className="nav-left">
            <button 
              className="icon-btn" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Toggle Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>

            {/* Cleaned Top Header */}
            <div 
              className="model-picker-badge cursor-pointer"
              onClick={() => setTokenModalOpen(true)}
              title="View model engines & quota"
            >
              <span className="model-title">WAVY</span>
              <span className="top-models-indicator">
                <span className="dot-mini green"></span>
                Models
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </div>
          </div>

          <div className="nav-right">
            {!user ? (
              <button 
                className="top-signin-btn"
                onClick={() => { setAuthMode("login"); setAuthModalOpen(true); }}
              >
                Sign in
              </button>
            ) : (
              <div 
                className="top-user-avatar"
                onClick={() => setTokenModalOpen(true)}
                title={`${user.name} (${user.email})`}
              >
                {user.avatarInitial}
              </div>
            )}
            <div 
              className="status-badge-clean cursor-pointer"
              onClick={() => setTokenModalOpen(true)}
              title="Click to view all AI models"
            >
              <span className="pulse-dot"></span>
              <span style={{ fontSize: '0.78rem', color: '#888', fontFamily: 'Fira Code' }}>1.1B Pool</span>
            </div>
          </div>
        </header>

        {/* Chat Canvas */}
        <div className="chat-canvas">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                  <path d="M12 6a4 4 0 0 0-4 4 1 1 0 0 0 2 0 2 2 0 0 1 4 0c0 1-1 2-2 3a1 1 0 0 0-1 1v1h2v-.5c.8-.7 2-1.7 2-3.5a4 4 0 0 0-4-4z"/>
                  <circle cx="12" cy="18" r="1"/>
                </svg>
              </div>
              <h2>How can help you today?</h2>
            </div>
          ) : (
            <div 
              className="messages-container" 
              ref={messagesContainerRef}
              onScroll={handleScroll}
            >
              {messages.map((msg) => {
                const isAssistant = msg.role === "assistant";
                const isCurrentlyStreaming = streamingMessageId === msg.id;
                const textToRender = isCurrentlyStreaming ? displayedStreamingText : msg.content;

                return (
                  <div key={msg.id || msg.content} className={`msg-row ${msg.role}`}>
                    {isAssistant && (
                      <div className="msg-avatar">W</div>
                    )}
                    <div className="msg-body">
                      {/* Attached user files display */}
                      {msg.files && msg.files.length > 0 && (
                        <div className="msg-attached-previews">
                          {msg.files.map(file => (
                            <div key={file.id} className="msg-file-pill">
                              {file.isImage ? (
                                <img src={file.dataUrl} alt={file.name} className="pill-img-thumb" />
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                              )}
                              <span className="pill-filename">{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isAssistant ? (
                        <MarkdownMessage content={textToRender} />
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && !streamingMessageId && (
                <div className="msg-row assistant">
                  <div className="msg-avatar">W</div>
                  <div className="msg-body">
                    <div className="typing-dots">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} style={{ height: '1px' }} />
            </div>
          )}

          {/* Jump to bottom button */}
          {showScrollBottom && (
            <button 
              className="scroll-to-bottom-btn"
              onClick={() => {
                scrollToBottom('smooth');
                setShowScrollBottom(false);
              }}
              title="Scroll to latest message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
          )}

          {/* Composer */}
          <div className="composer-container">
            {/* Attached file tags above input */}
            {attachedFiles.length > 0 && (
              <div className="attached-files-bar">
                {attachedFiles.map(file => (
                  <div key={file.id} className="attachment-chip">
                    {file.isImage ? (
                      <img src={file.dataUrl} alt={file.name} className="chip-img-preview" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                    )}
                    <span className="chip-name">{file.name}</span>
                    <button 
                      type="button" 
                      className="chip-remove-btn" 
                      onClick={() => removeAttachedFile(file.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="composer-box">
              {/* File Attachment Button */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                style={{ display: 'none' }} 
                multiple
              />
              <button 
                type="button" 
                className="attach-btn" 
                title="Attach file or image"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>

              <textarea
                ref={textareaRef}
                id="userInput"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message WAVY..."
                rows={1}
              />
              <button 
                type="button" 
                className={`send-action-btn ${(input.trim() || attachedFiles.length > 0) ? "active" : ""}`}
                disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                onClick={() => handleSend()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
            <div className="composer-disclaimer">
              WAVY Web App · Powered by FreeLLMAPI Gateway & Neon Database
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Custom Markdown Component with Copy Code Button
function MarkdownMessage({ content }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Parse markdown
    const html = marked.parse(content || "", { breaks: true });
    containerRef.current.innerHTML = html;

    // Enhance code blocks
    containerRef.current.querySelectorAll("pre").forEach(pre => {
      if (pre.closest(".code-block-wrapper")) return;
      const codeElem = pre.querySelector("code");
      if (!codeElem) return;

      const langClass = Array.from(codeElem.classList).find(c => c.startsWith("language-"));
      const langName = langClass ? langClass.replace("language-", "") : "code";

      hljs.highlightElement(codeElem);

      const wrapper = document.createElement("div");
      wrapper.className = "code-block-wrapper";

      const header = document.createElement("div");
      header.className = "code-block-header";
      header.innerHTML = `
        <span class="code-lang">${langName}</span>
        <button class="copy-code-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy code</span>
        </button>
      `;

      const copyBtn = header.querySelector(".copy-code-btn");
      copyBtn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(codeElem.innerText);
        copyBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10a37f" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="color: #10a37f;">Copied!</span>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy code</span>
          `;
        }, 2000);
      });

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);
    });
  }, [content]);

  return <div ref={containerRef} />;
}
