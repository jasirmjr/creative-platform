import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../utils/socket';
import {
  X,
  Search,
  Paperclip,
  Send,
  ArrowLeft,
  Check,
  CheckCheck,
  MessageSquare,
  ShieldCheck,
  FileText,
  Download,
  AlertTriangle,
} from 'lucide-react';

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
          title: 'Creative Hub Support',
          subtitle: c.admin_name ? `Handled by ${c.admin_name}` : 'Creative Hub Official Support',
          badge: 'Platform Admin',
          isSupport: true,
          avatarLetter: 'S',
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
      const res = await fetch(`/api/v1/chat/conversations${typeQuery}`, {
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
        const res = await fetch(`/api/v1/chat/conversations/${convId}/messages`, {
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

          const res = await fetch('/api/v1/chat/conversations', {
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
          fetch(`/api/v1/chat/conversations/${activeConvId}/read`, {
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

        res = await fetch(`/api/v1/chat/conversations/${activeConvId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      } else {
        // Send as clean JSON
        res = await fetch(`/api/v1/chat/conversations/${activeConvId}/messages`, {
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

  // On wide screens, open the most recent conversation instead of an empty pane
  useEffect(() => {
    if (!isOpen || activeConvId || loadingConversations || conversations.length === 0) return;
    if (initialVendorId || initialBookingId || initialType || initialConversationId) return;
    if (window.matchMedia('(min-width: 640px)').matches) {
      setActiveConvId(conversations[0].id);
    }
  }, [isOpen, activeConvId, loadingConversations, conversations, initialVendorId, initialBookingId, initialType, initialConversationId]);

  if (!isOpen) return null;

  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';
  const activeMeta = getConversationMeta(activeConv);

  const isSameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formatDayLabel = (d) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(d, new Date())) return 'Today';
    if (isSameDay(d, yesterday)) return 'Yesterday';
    return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatListTime = (d) => {
    if (!d) return '';
    if (isSameDay(d, new Date())) return formatTime(d);
    const label = formatDayLabel(d);
    return label === 'Yesterday' ? label : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const AvatarBubble = ({ meta, size = 'w-10 h-10 text-sm' }) => (
    <div className={`${size} rounded-full bg-gradient-to-br ${meta.avatarGradient} text-white font-semibold flex items-center justify-center shrink-0`}>
      {meta.isSupport && !isAdminUser ? <ShieldCheck className="w-5 h-5" /> : meta.avatarLetter}
    </div>
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="bg-white w-full max-w-5xl h-full sm:h-[min(720px,92vh)] sm:rounded-2xl shadow-2xl overflow-hidden flex">
        {/* Conversation list */}
        <div className={`w-full min-w-0 sm:w-80 sm:shrink-0 border-r border-slate-200 flex-col ${activeConvId ? 'hidden sm:flex' : 'flex'}`}>
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Messages</h3>
              <p className="text-xs text-slate-500">
                {isAdminUser ? 'Vendor support threads' : user?.role === 'vendor' ? 'Chats with your clients' : 'Chats with your creative partners'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              aria-label="Close messages"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name or project"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 border border-transparent rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingConversations ? (
              <p className="p-8 text-center text-sm text-slate-400">Loading conversations…</p>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 mt-2">
                  {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                </p>
                {!searchQuery && (
                  <p className="text-xs text-slate-500 mt-1">
                    {isAdminUser
                      ? 'Use "Message" on a vendor to start a support thread.'
                      : user?.role === 'customer'
                      ? 'Use "Message" on any booking or creative profile to start chatting.'
                      : 'Messages from clients about your bookings will appear here.'}
                  </p>
                )}
              </div>
            ) : (
              filteredConversations.map((c) => {
                const meta = getConversationMeta(c);
                const isSelected = c.id === activeConvId;
                const unread = c.unread_count > 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConvId(c.id)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <AvatarBubble meta={meta} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-sm truncate ${unread ? 'font-bold text-slate-900' : 'font-semibold text-slate-800'}`}>
                          {meta.title}
                        </span>
                        <span className={`text-[11px] shrink-0 ${unread ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
                          {formatListTime(c.last_message_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {c.type === 'admin_vendor' ? 'Platform support' : c.project_name || meta.subtitle}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-xs truncate min-w-0 ${unread ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                          {c.last_message?.file_name ? (
                            <span className="inline-flex items-center gap-1">
                              <Paperclip className="w-3 h-3" />
                              {c.last_message.file_name}
                            </span>
                          ) : (
                            c.last_message?.message || 'No messages yet'
                          )}
                        </p>
                        {unread && (
                          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold flex items-center justify-center">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Active thread */}
        <div className={`flex-1 min-w-0 flex-col bg-white ${!activeConvId ? 'hidden sm:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveConvId(null)}
                  className="sm:hidden p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <AvatarBubble meta={activeMeta} size="w-9 h-9 text-sm" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900 truncate">{activeMeta.title}</h4>
                  <p className={`text-xs truncate ${partnerTyping ? 'text-blue-600 font-medium' : 'text-slate-500'}`}>
                    {partnerTyping ? 'Typing…' : activeMeta.subtitle}
                  </p>
                </div>
                {activeConv.type !== 'admin_vendor' && activeConv.project_name && Number(activeConv.booking_total_amount) > 0 && (
                  <div className="hidden md:block text-right">
                    <p className="text-xs font-medium text-slate-700 truncate max-w-48">{activeConv.project_name}</p>
                    <p className="text-xs text-slate-500">₹{Number(activeConv.booking_total_amount).toLocaleString('en-IN')}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close messages"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {activeConv.type === 'admin_vendor' && (
                <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2 text-xs text-indigo-900">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  {isAdminUser
                    ? `Official support thread with ${activeConv.business_name || 'this vendor'}`
                    : 'Official Creative Hub support. Our team usually replies within a few hours.'}
                </div>
              )}

              {activeConv.active_complaint && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                  <span className="flex items-center gap-2 text-amber-900 font-medium min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate">
                      Open dispute #{activeConv.active_complaint.complaint_number}: {activeConv.active_complaint.subject}
                    </span>
                  </span>
                  <span className="sm:ml-auto text-amber-800 shrink-0">
                    {activeConv.active_complaint.is_expired
                      ? 'Response window ended · with admin'
                      : `${activeConv.active_complaint.days_remaining}d ${activeConv.active_complaint.hours_remaining}h left to resolve`}
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50">
                {loadingMessages ? (
                  <p className="py-12 text-center text-sm text-slate-400">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6">
                    <AvatarBubble meta={activeMeta} size="w-14 h-14 text-lg" />
                    <p className="text-sm font-semibold text-slate-800 mt-3">
                      {activeConv.type === 'admin_vendor'
                        ? isAdminUser
                          ? `Start a support conversation with ${activeConv.business_name}`
                          : 'How can we help your studio today?'
                        : `Say hello to ${activeMeta.title}`}
                    </p>
                    <p className="text-sm text-slate-500 mt-1 max-w-xs">
                      {activeConv.type === 'admin_vendor'
                        ? 'Ask about verification, deposits, payouts or disputes.'
                        : 'Share shoot details, timings, references or files.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {messages.map((m, idx) => {
                      const isMe = m.sender_id === user?.id;
                      const prev = messages[idx - 1];
                      const showDay = !prev || !isSameDay(prev.created_at, m.created_at);
                      const grouped = prev && !showDay && prev.sender_id === m.sender_id;

                      return (
                        <React.Fragment key={m.id || idx}>
                          {showDay && (
                            <div className="flex justify-center py-3">
                              <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-0.5">
                                {formatDayLabel(m.created_at)}
                              </span>
                            </div>
                          )}
                          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${grouped ? '' : 'pt-2'}`}>
                            {!isMe && !grouped && m.sender_role === 'admin' && (
                              <span className="text-[11px] font-semibold text-indigo-700 mb-1 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Creative Hub Support
                              </span>
                            )}
                            {!isMe && !grouped && m.sender_role === 'vendor' && isAdminUser && (
                              <span className="text-[11px] font-semibold text-slate-600 mb-1">
                                {activeConv?.business_name || m.sender_name || 'Vendor'}
                              </span>
                            )}

                            <div
                              className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2 text-sm leading-relaxed rounded-2xl ${
                                isMe
                                  ? 'bg-blue-600 text-white rounded-br-md'
                                  : m.sender_role === 'admin'
                                  ? 'bg-indigo-50 border border-indigo-100 text-slate-800 rounded-bl-md'
                                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                              }`}
                            >
                              {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}

                              {m.file_url && (
                                <div className={m.message ? 'mt-2' : ''}>
                                  {m.file_type === 'image' ? (
                                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="block">
                                      <img
                                        src={m.file_url}
                                        alt={m.file_name || 'Attached image'}
                                        className="max-h-60 w-auto rounded-lg hover:opacity-95 transition-opacity"
                                      />
                                    </a>
                                  ) : m.file_type === 'video' ? (
                                    <video src={m.file_url} controls className="max-h-60 w-full rounded-lg" />
                                  ) : (
                                    <a
                                      href={m.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${
                                        isMe ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      <FileText className={`w-8 h-8 shrink-0 ${isMe ? 'text-white' : 'text-blue-600'}`} />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{m.file_name || 'Attachment'}</p>
                                        <p className={`text-xs ${isMe ? 'text-blue-100' : 'text-slate-500'}`}>
                                          {m.file_size ? `${(Number(m.file_size) / (1024 * 1024)).toFixed(1)} MB` : 'File'}
                                        </p>
                                      </div>
                                      <Download className="w-4 h-4 shrink-0" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className={`flex items-center gap-1 text-[11px] text-slate-400 mt-0.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                              <span>{formatTime(m.created_at)}</span>
                              {isMe &&
                                (m.is_read ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-600" aria-label="Read" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" aria-label="Sent" />
                                ))}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {isAdminUser && activeConv?.type === 'admin_vendor' && (
                <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="text-xs font-medium text-slate-500 shrink-0">Quick replies:</span>
                  {[
                    { label: 'Listing approved', text: 'Hello, your profile verification and portfolio showcase have been approved by Creative Hub platform administration.' },
                    { label: 'Request KYC', text: 'Please provide your government-issued ID and recent production invoice or lookbook for listing verification.' },
                    { label: 'Deposit confirmed', text: 'We have verified your security deposit. Your profile is now actively visible to clients in the marketplace.' },
                    { label: 'Reviewing dispute', text: 'Platform administration is currently reviewing the client shoot timeline and dispute claim. We will issue a determination shortly.' },
                  ].map((canned) => (
                    <button
                      key={canned.label}
                      type="button"
                      onClick={() => setMessageText(canned.text)}
                      className="shrink-0 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full cursor-pointer"
                    >
                      {canned.label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white">
                {selectedFile && (
                  <div className="mb-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-sm">
                    <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{selectedFile.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="ml-auto p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                      aria-label="Remove attachment"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
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
                    title="Attach a file"
                    className="w-10 h-10 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <textarea
                    rows={1}
                    placeholder="Write a message…"
                    value={messageText}
                    onChange={(e) => {
                      handleTypingChange(e);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                        e.target.style.height = 'auto';
                      }
                    }}
                    className="flex-1 resize-none max-h-32 bg-slate-100 border border-transparent rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={(!messageText.trim() && !selectedFile) || uploading}
                    title="Send"
                    className="w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-400 mt-1.5 pl-12">Press Enter to send · Shift + Enter for a new line</p>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close messages"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 flex items-center justify-center p-8 text-center bg-slate-50">
                <div className="max-w-xs">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-base font-semibold text-slate-800 mt-3">
                    {conversations.length === 0 ? 'No conversations yet' : 'Pick a conversation'}
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">
                    {conversations.length === 0
                      ? 'Start a chat from any booking or creative profile using the Message button.'
                      : 'Choose someone on the left to see your messages.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
