import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';

export default function AdminSupportDeskModal({
  isOpen,
  onClose,
  user,
  token,
}) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Initialize or fetch dedicated admin support conversation
  const fetchSupportConversation = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/v1/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'admin_vendor',
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setConversation(data.data);
        fetchMessages(data.data.id);
      }
    } catch (err) {
      console.error('Failed to initialize support conversation:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 2. Fetch messages for this dedicated support thread
  const fetchMessages = async (convId) => {
    if (!token || !convId) return;
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${convId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
        setTimeout(() => scrollToBottom('auto'), 100);
      }
    } catch (err) {
      console.error('Failed to load support messages:', err);
    }
  };

  useEffect(() => {
    if (isOpen && token) {
      fetchSupportConversation();
    } else {
      setConversation(null);
      setMessages([]);
    }
  }, [isOpen, token, fetchSupportConversation]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 3. Real-time Socket.IO connection
  useEffect(() => {
    if (!isOpen || !token || !conversation?.id) return;

    const socket = getSocket(token);
    if (!socket) return;

    socket.emit('join_conversation', { conversation_id: conversation.id });

    const handleNewMessage = (newMsg) => {
      if (newMsg.conversation_id === conversation.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();

        // Mark as read if sent by admin
        if (newMsg.sender_role === 'admin') {
          fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${conversation.id}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
    };

    const handleMessagesRead = ({ conversation_id }) => {
      if (conversation_id === conversation.id) {
        setMessages((prev) =>
          prev.map((m) => (m.sender_role === 'vendor' ? { ...m, is_read: true } : m))
        );
      }
    };

    const handleUserTyping = ({ conversation_id, user_id }) => {
      if (conversation_id === conversation.id && user_id !== user?.id) {
        setPartnerTyping(true);
      }
    };

    const handleUserStopTyping = ({ conversation_id, user_id }) => {
      if (conversation_id === conversation.id && user_id !== user?.id) {
        setPartnerTyping(false);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.emit('leave_conversation', { conversation_id: conversation.id });
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [isOpen, token, conversation?.id, user?.id]);

  // Handle Typing indicator
  const handleTypingChange = (e) => {
    setMessageText(e.target.value);
    const socket = getSocket(token);
    if (!socket || !conversation?.id) return;

    socket.emit('typing', {
      conversation_id: conversation.id,
      user_name: user?.name || 'Vendor Partner',
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversation_id: conversation.id });
    }, 1500);
  };

  // Send message to Admin
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!messageText.trim() && !selectedFile) || !conversation?.id || uploading) return;

    setUploading(true);
    try {
      let finalMessage = messageText.trim();
      if (selectedCategory && !finalMessage.startsWith(`[${selectedCategory}]`)) {
        finalMessage = `[${selectedCategory}] ${finalMessage}`;
      }

      let res;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (finalMessage) formData.append('message', finalMessage);

        res = await fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      } else {
        res = await fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${conversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: finalMessage }),
        });
      }

      const data = await res.json();
      if (data.success) {
        setMessageText('');
        setSelectedFile(null);
        setSelectedCategory(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        setMessages((prev) => {
          if (prev.some((m) => m.id === data.data.id)) return prev;
          return [...prev, data.data];
        });
        scrollToBottom();

        const socket = getSocket(token);
        if (socket) socket.emit('stop_typing', { conversation_id: conversation.id });
      } else {
        alert(data.message || 'Failed to send message.');
      }
    } catch (err) {
      console.error('Error sending support message:', err);
      alert('Network error while sending support message.');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectTopic = (topic) => {
    if (selectedCategory === topic) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(topic);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-fadeIn"
    >
      <div className="bg-white border border-slate-200 w-full max-w-3xl h-[680px] max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* MODAL HEADER */}
        <div className="p-4 border-b border-slate-200 bg-linear-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xs flex items-center justify-center text-lg shadow-xs">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Platform Operations & Support Desk
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded-full">
                  Official Channel
                </span>
              </div>
              <p className="text-[11px] text-purple-200/80 mt-0.5 flex items-center gap-2">
                <span>Direct line to Creative Hub Platform Administration</span>
                <span>&bull;</span>
                <span className="text-emerald-400 font-medium">● Support Online</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/90 flex items-center justify-center text-sm transition-colors cursor-pointer"
            title="Close support desk"
          >
            ✕
          </button>
        </div>

        {/* VERIFIED STATUS BAR */}
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-indigo-950">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-900">Dedicated Studio Channel:</span>
            <span className="font-semibold text-slate-700">{user?.vendor_profile?.business_name || user?.name || 'Creator Studio'}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-indigo-800">
            <span>Operating Hours: 9 AM &ndash; 9 PM IST</span>
            <span>&bull;</span>
            <span className="font-semibold text-emerald-700">Turnaround: &lt; 15 mins</span>
          </div>
        </div>

        {/* MESSAGES SCROLL REGION */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400">Connecting to Platform Support...</div>
          ) : messages.length === 0 ? (
            <div className="py-14 text-center max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-xl mx-auto shadow-2xs">
                🛡️
              </div>
              <h4 className="text-sm font-bold text-slate-800">How can Platform Support assist you?</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connect directly with Platform Administrators for help with KYC verification, listing deposits, shoot arbitration, or marketplace policies.
              </p>
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Popular Topics
                </span>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {['Listing Verification', 'Deposit Receipt', 'Client Dispute', 'Profile Update'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectTopic(t)}
                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => {
              const isMe = m.sender_role === 'vendor';
              const isAdmin = m.sender_role === 'admin';

              return (
                <div
                  key={m.id || idx}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  {/* Sender Badge */}
                  {isAdmin && (
                    <span className="text-[10px] font-bold text-purple-800 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-md mb-1 flex items-center gap-1 shadow-2xs">
                      <span>🛡️</span>
                      <span>Platform Administrator</span>
                    </span>
                  )}
                  {isMe && (
                    <span className="text-[10px] font-medium text-slate-400 mb-1 px-1">
                      You ({user?.vendor_profile?.business_name || 'Studio'})
                    </span>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] p-3.5 text-xs leading-relaxed shadow-xs ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-2xl rounded-tr-xs'
                        : 'bg-white border border-purple-200 text-slate-900 rounded-2xl rounded-tl-xs shadow-xs'
                    }`}
                  >
                    {/* Message Body */}
                    {m.message && <p className="whitespace-pre-wrap">{m.message}</p>}

                    {/* Attachment rendering */}
                    {m.file_url && (
                      <div className={`mt-2 ${m.message ? 'pt-2 border-t border-slate-200/50' : ''}`}>
                        {m.file_type === 'image' ? (
                          <a
                            href={`http://127.0.0.1:5000${m.file_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl overflow-hidden group relative"
                          >
                            <img
                              src={`http://127.0.0.1:5000${m.file_url}`}
                              alt={m.file_name || 'Attached Image'}
                              className="max-h-56 w-auto object-cover rounded-xl border border-black/10 group-hover:opacity-95 transition-opacity"
                            />
                            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-xs font-semibold">
                              Click to View ↗
                            </span>
                          </a>
                        ) : m.file_type === 'video' ? (
                          <video
                            src={`http://127.0.0.1:5000${m.file_url}`}
                            controls
                            className="max-h-56 w-full rounded-xl"
                          />
                        ) : (
                          <a
                            href={`http://127.0.0.1:5000${m.file_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-colors ${
                              isMe
                                ? 'bg-blue-700/60 border-blue-400/40 text-white hover:bg-blue-700'
                                : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded uppercase">
                              {m.file_type || 'Doc'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[11px] truncate">
                                {m.file_name || 'Attached Document'}
                              </p>
                              <p className={`text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                {m.file_size ? `${(Number(m.file_size) / (1024 * 1024)).toFixed(2)} MB` : 'Download file'}
                              </p>
                            </div>
                            <span className="text-xs font-semibold underline">Download</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Timestamp & receipts */}
                  <div
                    className={`flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1 ${
                      isMe ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <span>
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {isMe && (
                      <span className={m.is_read ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                        {m.is_read ? '✓✓ Read' : '✓ Sent'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {partnerTyping && (
            <div className="flex items-center gap-2 text-[11px] text-purple-700 font-semibold animate-pulse pl-2">
              <span>🛡️</span>
              <span>Platform Administration is typing a response...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* QUICK TOPIC SELECTION CHIPS */}
        <div className="px-4 py-2 bg-white border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Query Topic:
          </span>
          {[
            { id: 'Listing Verification', label: '📋 Listing Verification' },
            { id: 'Deposit & Payouts', label: '💳 Deposit & Payouts' },
            { id: 'Client Dispute', label: '⚖️ Client Dispute' },
            { id: 'Account & Skills', label: '⚙️ Account & Skills' },
          ].map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => handleSelectTopic(topic.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === topic.id
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {topic.label}
            </button>
          ))}
        </div>

        {/* SELECTED FILE PREVIEW */}
        {selectedFile && (
          <div className="px-4 py-2 bg-purple-50 border-t border-purple-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded">
                Attachment
              </span>
              <span className="font-bold text-purple-950 truncate max-w-sm">
                {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-slate-500 hover:text-rose-600 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* INPUT COMPOSER */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
            }}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach ID proof, document, or media"
            className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1"
          >
            <span>+</span>
            <span>Attach</span>
          </button>

          <input
            type="text"
            placeholder={
              selectedCategory
                ? `Inquiry regarding [${selectedCategory}]...`
                : 'Message Platform Operations Desk...'
            }
            value={messageText}
            onChange={handleTypingChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-600 focus:bg-white transition-all"
          />

          <button
            type="submit"
            disabled={(!messageText.trim() && !selectedFile) || uploading}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            {uploading ? <span>Sending...</span> : <span>Send &rarr;</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
