import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';

export default function ChatModal({
  isOpen,
  onClose,
  user,
  token,
  initialConversationId = null,
  initialVendorId = null,
  initialBookingId = null,
  initialType = null,
  initialMessage = null,
  scope = 'all', // 'all' | 'client' | 'admin'
  onBookingAction = null,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(initialConversationId);
  const [messages, setMessages] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const activeConv = conversations.find((c) => c.id === activeConvId);

  // Helper to determine partner display details based on chat type & viewer role
  const getConversationMeta = (c) => {
    if (!c) return { title: '', subtitle: '', badge: '', isSupport: false, avatarLetter: 'P', avatarGradient: 'from-blue-500 to-indigo-600' };
    const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
    const isVendorUser = user?.role === 'vendor';

    if (c.type === 'admin_vendor') {
      if (isAdminUser) {
        return {
          title: c.business_name || c.vendor_owner_name || 'Vendor Partner',
          subtitle: c.vendor_location ? `Studio in ${c.vendor_location}` : 'Creative Vendor Partner',
          badge: 'Vendor Partner',
          isSupport: true,
          avatarLetter: (c.business_name || c.vendor_owner_name || 'V').charAt(0).toUpperCase(),
          avatarGradient: 'from-purple-600 to-indigo-600',
        };
      } else {
        return {
          title: 'Platform Administrator',
          subtitle: c.admin_name ? `Handled by ${c.admin_name}` : 'Creative Hub Official Support',
          badge: '🛡️ Platform Admin',
          isSupport: true,
          avatarLetter: '🛡️',
          avatarGradient: 'from-blue-700 to-slate-900',
        };
      }
    } else {
      if (isVendorUser) {
        return {
          title: c.customer_name || 'Client',
          subtitle: c.project_name ? `Project: ${c.project_name}` : 'Direct Client Booking',
          badge: 'Customer',
          isSupport: false,
          avatarLetter: (c.customer_name || 'C').charAt(0).toUpperCase(),
          avatarGradient: 'from-blue-500 to-indigo-600',
        };
      } else {
        return {
          title: c.business_name || c.vendor_owner_name || 'Creative Partner',
          subtitle: c.project_name ? `Project: ${c.project_name}` : c.vendor_location || 'Creative Partner',
          badge: 'Creative Partner',
          isSupport: false,
          avatarLetter: (c.business_name || 'P').charAt(0).toUpperCase(),
          avatarGradient: 'from-blue-600 to-indigo-600',
        };
      }
    }
  };

  // Auto-scroll to bottom of messages
  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch user conversations with optional scope filter
  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const typeQuery = scope === 'client' ? '?type=client' : scope === 'admin' ? '?type=admin_vendor' : '';
      const res = await fetch(`http://127.0.0.1:5000/api/v1/chat/conversations${typeQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        let list = data.data || [];
        // Strict segregation: if user is vendor and viewing client messages, never show admin_vendor
        if (scope === 'client' || (user?.role === 'vendor' && scope !== 'admin')) {
          list = list.filter((c) => c.type !== 'admin_vendor');
        } else if (scope === 'admin') {
          list = list.filter((c) => c.type === 'admin_vendor');
        }
        setConversations(list);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [token, scope, user?.role]);

  // Load message history for active conversation
  const fetchMessages = useCallback(
    async (convId) => {
      if (!token || !convId) return;
      setLoadingMessages(true);
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${convId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.data);
          setTimeout(() => scrollToBottom('auto'), 100);

          // Update unread count in conversations state
          setConversations((prev) =>
            prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
          );
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [token]
  );

  // Initialize or start conversation if initial parameters provided
  useEffect(() => {
    if (!isOpen || !token) return;

    fetchConversations();

    const shouldInit = (initialVendorId || initialBookingId || initialType === 'admin_vendor') && !initialConversationId;

    if (shouldInit) {
      const initConversation = async () => {
        try {
          const reqBody = {
            vendor_id: initialVendorId,
            booking_id: initialBookingId,
            type: initialType || (user?.role === 'admin' || user?.role === 'super_admin' ? 'admin_vendor' : undefined),
          };

          const res = await fetch('http://127.0.0.1:5000/api/v1/chat/conversations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(reqBody),
          });
          const data = await res.json();
          if (data.success && data.data) {
            setActiveConvId(data.data.id);
            fetchConversations();
          }
        } catch (err) {
          console.error('Failed to initialize conversation:', err);
        }
      };
      initConversation();
    } else if (initialConversationId) {
      setActiveConvId(initialConversationId);
    }
  }, [isOpen, token, initialConversationId, initialVendorId, initialBookingId, initialType, user?.role, fetchConversations]);

  // Set initial prefilled message if provided (e.g. from Revision response)
  useEffect(() => {
    if (isOpen && initialMessage) {
      setMessageText(initialMessage);
    }
  }, [isOpen, initialMessage]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch messages whenever active conversation changes
  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId, fetchMessages]);

  // Socket.IO real-time event listeners
  useEffect(() => {
    if (!isOpen || !token) return;

    const socket = getSocket(token);
    if (!socket) return;

    if (activeConvId) {
      socket.emit('join_conversation', { conversation_id: activeConvId });
    }

    // New message handler
    const handleNewMessage = (newMsg) => {
      if (newMsg.conversation_id === activeConvId) {
        setMessages((prev) => {
          // Avoid duplicate messages if already present
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        scrollToBottom();

        // Mark as read immediately if current user is active in this conversation
        if (newMsg.sender_id !== user?.id) {
          fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${activeConvId}/read`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      // Update conversations list preview
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === newMsg.conversation_id);
        if (!exists) {
          fetchConversations();
          return prev;
        }
        return prev.map((c) => {
          if (c.id === newMsg.conversation_id) {
            const isCurrentChat = c.id === activeConvId;
            return {
              ...c,
              last_message_at: newMsg.created_at,
              last_message: {
                id: newMsg.id,
                message: newMsg.message,
                file_name: newMsg.file_name,
                file_type: newMsg.file_type,
                created_at: newMsg.created_at,
                sender_id: newMsg.sender_id,
              },
              unread_count: isCurrentChat || newMsg.sender_id === user?.id ? 0 : (c.unread_count || 0) + 1,
            };
          }
          return c;
        });
      });
    };

    // Read receipt handler
    const handleMessagesRead = ({ conversation_id }) => {
      if (conversation_id === activeConvId) {
        setMessages((prev) =>
          prev.map((m) => (m.sender_id === user?.id ? { ...m, is_read: true } : m))
        );
      }
    };

    // Typing indicator handlers
    const handleUserTyping = ({ conversation_id, user_id }) => {
      if (conversation_id === activeConvId && user_id !== user?.id) {
        setPartnerTyping(true);
      }
    };

    const handleUserStopTyping = ({ conversation_id, user_id }) => {
      if (conversation_id === activeConvId && user_id !== user?.id) {
        setPartnerTyping(false);
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      if (activeConvId) {
        socket.emit('leave_conversation', { conversation_id: activeConvId });
      }
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [isOpen, token, activeConvId, user?.id, fetchConversations]);

  // Emit typing indicator to socket
  const handleTypingChange = (e) => {
    setMessageText(e.target.value);
    const socket = getSocket(token);
    if (!socket || !activeConvId) return;

    socket.emit('typing', {
      conversation_id: activeConvId,
      user_name: user?.name || 'User',
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversation_id: activeConvId });
    }, 1500);
  };

  // Send Message (Text + Optional File)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!messageText.trim() && !selectedFile) || !activeConvId || uploading) return;

    setUploading(true);
    try {
      let res;
      if (selectedFile) {
        // Send as multipart form-data
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (messageText.trim()) {
          formData.append('message', messageText.trim());
        }

        res = await fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${activeConvId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      } else {
        // Send as clean JSON
        res = await fetch(`http://127.0.0.1:5000/api/v1/chat/conversations/${activeConvId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: messageText.trim(),
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        setMessageText('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Add to messages immediately (socket also broadcasts)
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.data.id)) return prev;
          return [...prev, data.data];
        });
        scrollToBottom();

        // Inform socket typing stopped
        const socket = getSocket(token);
        if (socket) socket.emit('stop_typing', { conversation_id: activeConvId });
      } else {
        alert(data.message || 'Failed to send message.');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Network error while sending message.');
    } finally {
      setUploading(false);
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const meta = getConversationMeta(c);
    const partnerName = meta.title;
    const projectName = c.project_name || '';
    const term = searchQuery.toLowerCase();
    return (
      partnerName?.toLowerCase().includes(term) ||
      projectName?.toLowerCase().includes(term) ||
      (c.business_name && c.business_name.toLowerCase().includes(term)) ||
      (c.customer_name && c.customer_name.toLowerCase().includes(term)) ||
      (c.type === 'admin_vendor' && 'admin support platform'.includes(term))
    );
  });

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
    >
      <div className="bg-white border border-slate-200 w-full max-w-4xl h-[680px] max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col sm:flex-row relative">
        
        {/* LEFT COLUMN: Conversations List */}
        <div
          className={`w-full sm:w-80 border-r border-slate-200 bg-slate-50 flex flex-col ${
            activeConvId ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {/* List Header */}
          <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {user?.role === 'admin' || user?.role === 'super_admin'
                  ? 'Vendor Support Messages'
                  : user?.role === 'vendor'
                  ? 'Client Project Messages'
                  : 'Messages'}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {user?.role === 'admin' || user?.role === 'super_admin'
                  ? 'Creative Hub Operations Desk'
                  : user?.role === 'vendor'
                  ? 'Direct Client Project Shoots'
                  : 'Direct Project Chat'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              title="Close messages and return to dashboard"
            >
              <span>✕</span>
              <span>Close</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 border-b border-slate-200 bg-white/60">
            <input
              type="text"
              placeholder="Search partner or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
            />
          </div>

          {/* Conversation Items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingConversations ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading chats...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-600">No Client Conversations Yet</p>
                <p className="text-[11px] text-slate-400">
                  {user?.role === 'admin' || user?.role === 'super_admin'
                    ? 'Click "Message" on any registered vendor to open a direct support thread.'
                    : user?.role === 'customer'
                    ? 'Message any studio or click "Chat with Studio" on your bookings.'
                    : 'Client messages for your project bookings and equipment holds will appear here.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const meta = getConversationMeta(c);
                const isSelected = c.id === activeConvId;

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-blue-600'
                        : 'hover:bg-slate-100/70'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${meta.avatarGradient} text-white font-bold flex items-center justify-center text-sm shadow-xs`}>
                        {meta.avatarLetter}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {meta.title}
                        </span>
                        {c.last_message_at && (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {new Date(c.last_message_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>

                      {/* Tag: Admin Support or Project Tag */}
                      {c.type === 'admin_vendor' ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-bold text-purple-700 bg-purple-100/80 px-1.5 py-0.2 rounded truncate">
                            🛡️ Platform Support
                          </span>
                        </div>
                      ) : c.project_name ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-semibold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded truncate">
                            {c.project_name}
                          </span>
                        </div>
                      ) : null}

                      {/* Message Preview */}
                      <p className="text-[11px] text-slate-500 truncate mt-1">
                        {c.last_message?.file_name ? (
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <span className="text-[9px] uppercase px-1 bg-slate-200 rounded text-slate-600">File</span>
                            <span>{c.last_message.file_name}</span>
                          </span>
                        ) : c.last_message?.message ? (
                          c.last_message.message
                        ) : (
                          <span className="italic text-slate-400">Conversation started</span>
                        )}
                      </p>
                    </div>

                    {/* Unread Counter Badge */}
                    {c.unread_count > 0 && (
                      <span className="shrink-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {c.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Thread */}
        <div
          className={`flex-1 flex flex-col bg-white ${
            !activeConvId ? 'hidden sm:flex' : 'flex'
          }`}
        >
          {activeConv ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white shadow-2xs">
                <div className="flex items-center gap-3">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setActiveConvId(null)}
                    className="sm:hidden text-slate-500 hover:text-slate-800 text-sm font-bold pr-1"
                  >
                    &larr; Back
                  </button>

                  <div className="relative">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-tr ${getConversationMeta(activeConv).avatarGradient} text-white font-bold flex items-center justify-center text-xs shadow-xs`}>
                      {getConversationMeta(activeConv).avatarLetter}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                        {getConversationMeta(activeConv).title}
                      </h4>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        activeConv.type === 'admin_vendor'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {getConversationMeta(activeConv).badge}
                      </span>
                    </div>

                    {partnerTyping ? (
                      <p className="text-[10px] text-blue-600 font-bold animate-pulse mt-0.5">
                        Typing a message...
                      </p>
                    ) : (
                      <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                        ● Online & Ready to chat
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Booking or Support Context Pill */}
                  {activeConv.type === 'admin_vendor' ? (
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-[10px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        🛡️ Platform Support
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {activeConv.business_name}
                      </span>
                    </div>
                  ) : activeConv.project_name ? (
                    <div className="hidden md:flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-700">
                        {activeConv.project_name}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        Budget: ₹{Number(activeConv.booking_total_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  ) : null}

                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Official Support Channel Banner */}
              {activeConv.type === 'admin_vendor' && (
                <div className="px-4 py-2 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border-b border-indigo-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-indigo-900">
                    <span className="text-sm">🛡️</span>
                    <span className="font-semibold">
                      {user?.role === 'admin' || user?.role === 'super_admin'
                        ? `Official Platform Support Thread with ${activeConv.business_name || 'Vendor'}`
                        : 'Official Platform Support Channel — Creative Hub Administration'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
                    Verified Desk
                  </span>
                </div>
              )}

              {/* Active Resolution Center Dispute Banner */}
              {activeConv.active_complaint && (
                <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 uppercase">
                      Resolution Center
                    </span>
                    <span className="font-semibold text-amber-950 truncate max-w-xs">
                      #{activeConv.active_complaint.complaint_number}: {activeConv.active_complaint.subject}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-amber-900">
                      {activeConv.active_complaint.is_expired
                        ? 'SLA Expired (In Arbitration)'
                        : `1-Wk Window: ${activeConv.active_complaint.days_remaining}d remaining (${activeConv.active_complaint.hours_remaining}h)`}
                    </span>
                  </div>
                </div>
              )}

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
                {loadingMessages ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-700">
                      {activeConv.type === 'admin_vendor'
                        ? user?.role === 'admin' || user?.role === 'super_admin'
                          ? `Start official support communication with ${activeConv.business_name}.`
                          : 'How can the platform administration help your studio today?'
                        : `Say hello to ${user?.role === 'vendor' ? activeConv.customer_name : activeConv.business_name}!`}
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      {activeConv.type === 'admin_vendor'
                        ? 'Discuss policy questions, profile verification, payment deposit status, or disputes.'
                        : 'Discuss shoot requirements, equipment details, schedule adjustments, or attach reference files.'}
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isMe = m.sender_id === user?.id;

                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        {/* Sender Tag if Admin or Partner */}
                        {!isMe && m.sender_role === 'admin' && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded mb-1 flex items-center gap-1">
                            <span>🛡️</span>
                            <span>Platform Support</span>
                          </span>
                        )}
                        {!isMe && m.sender_role === 'vendor' && (user?.role === 'admin' || user?.role === 'super_admin') && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded mb-1">
                            {activeConv?.business_name || m.sender_name || 'Vendor'}
                          </span>
                        )}

                        <div
                          className={`max-w-[85%] sm:max-w-[70%] p-3 text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-blue-600 text-white rounded-2xl rounded-tr-xs'
                              : m.sender_role === 'admin'
                              ? 'bg-purple-50/90 border border-purple-200 text-slate-800 rounded-2xl rounded-tl-xs'
                              : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-xs'
                          }`}
                        >
                          {/* Message Text */}
                          {m.message && <p className="whitespace-pre-wrap">{m.message}</p>}

                          {/* File Attachment Presentation */}
                          {m.file_url && (
                            <div className={`mt-2 ${m.message ? 'pt-2 border-t border-white/20' : ''}`}>
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
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-1 rounded uppercase">
                                    {m.file_type || 'File'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[11px] truncate">
                                      {m.file_name || 'Attached Document'}
                                    </p>
                                    <p className={`text-[10px] ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                      {m.file_size
                                        ? `${(Number(m.file_size) / (1024 * 1024)).toFixed(2)} MB`
                                        : 'Download Attachment'}
                                    </p>
                                  </div>
                                  <span className="text-xs font-semibold underline">Download</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Timestamp & Read Receipts */}
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
                <div ref={messagesEndRef} />
              </div>

              {/* Selected File Badge Preview */}
              {selectedFile && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded">File</span>
                    <div>
                      <span className="font-bold text-blue-950 block truncate max-w-xs sm:max-w-md">
                        {selectedFile.name}
                      </span>
                      <span className="text-[10px] text-blue-700">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready to send
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-slate-500 hover:text-rose-600 text-sm font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Admin Support Quick Canned Responses */}
              {(user?.role === 'admin' || user?.role === 'super_admin') && activeConv?.type === 'admin_vendor' && (
                <div className="px-3 py-2 bg-purple-50/80 border-t border-purple-100 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
                  <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <span>⚡</span> Canned:
                  </span>
                  {[
                    { label: '✅ Listing Approved', text: 'Hello, your profile verification and portfolio showcase have been approved by Creative Hub platform administration.' },
                    { label: '📄 Request KYC', text: 'Please provide your government-issued ID and recent production invoice or lookbook for listing verification.' },
                    { label: '💳 Deposit Confirmed', text: 'We have verified your security deposit. Your profile is now actively visible to clients in the marketplace.' },
                    { label: '⚖️ Dispute Reviewing', text: 'Platform administration is currently reviewing the client shoot timeline and dispute claim. We will issue a determination shortly.' },
                  ].map((canned, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMessageText(canned.text)}
                      className="shrink-0 px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-900 font-medium rounded-lg border border-purple-200 transition-colors shadow-2xs cursor-pointer hover:border-purple-300"
                    >
                      {canned.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Message Composer Input Form */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 border-t border-slate-200 bg-white flex items-center gap-2"
              >
                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {/* Attach File Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach File (Image, Video, Script, PDF)"
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <span>+</span>
                  <span>File</span>
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  placeholder="Type a message or shoot question..."
                  value={messageText}
                  onChange={handleTypingChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={(!messageText.trim() && !selectedFile) || uploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {uploading ? (
                    <span>Sending...</span>
                  ) : (
                    <span>Send &rarr;</span>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col bg-slate-50/50">
              {/* Thread Header for Empty State with Close Option */}
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white shadow-2xs">
                <span className="text-xs font-semibold text-slate-500">Project Conversation</span>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm transition-colors cursor-pointer"
                  title="Close messages and return to dashboard"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="max-w-sm space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold mx-auto border border-slate-200 shadow-2xs">
                    CHAT
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Select a Conversation</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Choose a project chat on the left, or initiate a conversation directly from your bookings or creative profiles.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>&larr;</span>
                    <span>Back to Dashboard</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
