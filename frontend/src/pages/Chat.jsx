import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import CrisisDisclaimer from '../components/CrisisDisclaimer';
import { API_BASE_URL } from '../api/client';
import * as endpoints from '../api/endpoints';
import { MessageCircle, Send, Plus, Trash2, Pencil, ShieldAlert, Sparkles } from 'lucide-react';

export default function Chat() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [renameInput, setRenameInput] = useState('');

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const accessToken = useStore((s) => s.accessToken);
  const showToast = useStore((s) => s.showToast);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Fetch session history on mount
  useEffect(() => {
    fetchSessions();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Whenever activeSessionId changes, connect/reconnect WebSocket
  useEffect(() => {
    if (activeSessionId) {
      setMessages([]);
      setIsConnected(false);
      connectWebSocket(activeSessionId);
    }
  }, [activeSessionId]);

  const fetchSessions = async (selectFirst = false) => {
    setSessionsLoading(true);
    try {
      const res = await endpoints.getChatSessions();
      setSessions(res.data);
      if (res.data.length > 0) {
        const storedId = localStorage.getItem('bloom_chat_session_id');
        const exists = res.data.some((s) => s.session_id === storedId);
        if (selectFirst || !storedId || !exists) {
          const firstId = res.data[0].session_id;
          setActiveSessionId(firstId);
          localStorage.setItem('bloom_chat_session_id', firstId);
        } else {
          setActiveSessionId(storedId);
        }
      } else {
        // No sessions exist yet, create first session!
        handleCreateSession([]);
      }
    } catch (err) {
      console.error('Failed to load chat sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) {
      showToast('Please type a message', 'error');
      return;
    }
    if (!isConnected) {
      showToast('Not connected to chat. Please wait...', 'error');
      return;
    }
    const msg = input.trim();
    setInput('');
    wsRef.current?.send(JSON.stringify({ type: 'message', message: msg }));
  };

  const handleCreateSession = (existingSessions = sessions) => {
    if (existingSessions.length >= 3) {
      setShowLimitModal(true);
      return;
    }
    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    setActiveSessionId(newSessionId);
    localStorage.setItem('bloom_chat_session_id', newSessionId);

    const newSessionObj = {
      session_id: newSessionId,
      last_message: 'New conversation 🌱',
      last_timestamp: new Date().toISOString(),
    };
    setSessions((prev) => [newSessionObj, ...prev]);
  };

  const handleDeleteSession = async (sessId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this conversation? This will clear all messages in it.')) return;
    try {
      await endpoints.deleteChatSession(sessId);
      showToast('Conversation deleted');

      const remaining = sessions.filter((s) => s.session_id !== sessId);
      setSessions(remaining);

      if (activeSessionId === sessId) {
        if (remaining.length > 0) {
          const nextId = remaining[0].session_id;
          setActiveSessionId(nextId);
          localStorage.setItem('bloom_chat_session_id', nextId);
        } else {
          localStorage.removeItem('bloom_chat_session_id');
          setActiveSessionId('');
          fetchSessions(true);
        }
      }
    } catch (err) {
      showToast('Failed to delete session', 'error');
    }
  };

  const handleRenameSession = async (sessId, newName) => {
    if (!newName.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await endpoints.renameChatSession(sessId, newName.trim());
      setSessions((prev) =>
        prev.map((s) => (s.session_id === sessId ? { ...s, name: newName.trim() } : s))
      );
      setEditingSessionId(null);
      showToast('Conversation renamed');
    } catch (err) {
      showToast('Failed to rename conversation', 'error');
    }
  };

  const refreshSessionsList = async () => {
    try {
      const res = await endpoints.getChatSessions();
      setSessions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const connectWebSocket = (sessId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/chat';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'auth',
          token: accessToken,
          session_id: sessId,
        })
      );
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'auth_ok':
          setIsConnected(true);
          if (data.history) {
            setMessages(data.history);
          }
          break;
        case 'response':
          setIsTyping(false);
          setMessages((prev) => [...prev, { role: 'assistant', text: data.text }]);
          refreshSessionsList();
          break;
        case 'crisis':
          setMessages((prev) => [...prev, { role: 'crisis', text: data.text }]);
          break;
        case 'error':
          setIsTyping(false);
          setMessages((prev) => [...prev, { role: 'system', text: data.text }]);
          break;
        default:
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !isConnected || !wsRef.current) return;

    const text = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setIsTyping(true);

    wsRef.current.send(
      JSON.stringify({
        type: 'message',
        text,
      })
    );
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <MessageCircle size={36} style={{ color: 'var(--accent-chat)', marginTop: '4px' }} />
        <div>
          <h1 style={{ margin: '0 0 var(--space-xs)' }}>Bloom Companion</h1>
          <p style={{ margin: 0 }}>A supportive space to reflect and talk through your feelings.</p>
        </div>
      </div>

      <CrisisDisclaimer />

      <div className="chat-container" style={{ marginTop: 'var(--space-md)' }}>
        {/* Sidebar */}
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">
            <button className="btn btn-primary w-full" onClick={() => handleCreateSession()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={16} /> New Chat
            </button>
          </div>
          <div className="chat-session-list">
            {sessionsLoading && sessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-md)', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Loading chats...
              </div>
            ) : (
              sessions.map((s, idx) => (
                <div
                  key={s.session_id}
                  className={`chat-session-item ${activeSessionId === s.session_id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSessionId(s.session_id);
                    localStorage.setItem('bloom_chat_session_id', s.session_id);
                  }}
                >
                  <div className="chat-session-info" style={{ flex: 1, minWidth: 0 }}>
                    {editingSessionId === s.session_id ? (
                      <input
                        type="text"
                        className="chat-input"
                        value={renameInput}
                        onChange={(e) => setRenameInput(e.target.value)}
                        onBlur={() => handleRenameSession(s.session_id, renameInput)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSession(s.session_id, renameInput);
                          if (e.key === 'Escape') setEditingSessionId(null);
                        }}
                        autoFocus
                        style={{
                          fontSize: '0.875rem',
                          padding: '2px 6px',
                          height: 'auto',
                          width: '100%',
                          background: 'var(--color-bg-input)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, justifyContent: 'space-between' }}>
                        <span 
                          className="chat-session-title" 
                          style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        >
                          {s.name || `Conversation ${sessions.length - idx}`}
                        </span>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSessionId(s.session_id);
                            setRenameInput(s.name || `Conversation ${sessions.length - idx}`);
                          }}
                          title="Rename"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    <span className="chat-session-preview">{s.last_message || 'New conversation'}</span>
                  </div>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={(e) => handleDeleteSession(s.session_id, e)}
                    style={{ padding: '4px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Delete Chat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="chat-main">
          <div className="chat-messages">
            {messages.length === 0 && isConnected && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-2xl)',
                color: 'var(--color-text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Sparkles size={48} style={{ color: 'var(--accent-chat)', marginBottom: 'var(--space-md)', opacity: 0.8 }} />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: 'var(--color-text-primary)', marginBottom: 'var(--space-sm)' }}>Bloom Companion</h3>
                <p style={{ maxWidth: '400px', lineHeight: 1.6 }}>
                  Hi there! I'm Bloom, your supportive recovery companion. I'm here to listen and encourage you. How are you feeling today?
                </p>
              </div>
            )}

            {!isConnected && (
              <div style={{
                textAlign: 'center',
                padding: 'var(--space-2xl)',
                color: 'var(--color-text-muted)',
              }}>
                <div className="spinner" style={{ margin: '0 auto var(--space-md)' }} />
                <p>Connecting...</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.text.split('\n').map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < msg.text.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            ))}

            {isTyping && (
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form className="chat-input-area" onSubmit={sendMessage}>
            <input
              className="chat-input"
              type="text"
              placeholder={isConnected ? 'Type your message...' : 'Connecting...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!isConnected}
            />
            <button
              className="chat-send-btn"
              type="submit"
              disabled={!isConnected || !input.trim()}
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Limit Modal */}
      {showLimitModal && (
        <div className="modal-overlay" onClick={() => setShowLimitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-mood)', fontFamily: 'var(--font-heading)' }}>
              <ShieldAlert size={20} /> Chat Limit Reached
            </h3>
            <p style={{ marginBottom: 'var(--space-lg)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              You can only have up to 3 active conversations at a time.
              <br /><br />
              Please delete an existing conversation using the trash icon in the sidebar before starting a new one.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowLimitModal(false)}>
                Okay, got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
