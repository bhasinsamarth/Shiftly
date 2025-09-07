// src/components/Chat/PrivateChatRoom.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { loadMessages, sendMessage } from '../../utils/chatService';
import {
  getCachedEmployeeData,
  getCachedParticipantData,
  getCachedMessages,
  addMessageToCache
} from '../../utils/chatCacheService';

const DEFAULT_AVATAR_URL =
  'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';

export default function PrivateChatRoom({ roomId: rid, currentEmployee }) {
  const navigate = useNavigate();
  const empId    = currentEmployee.employee_id;

  // Soft-delete cutoff
  const [deletedAt, setDeletedAt] = useState(null);
  // Decrypted messages
  const [messages, setMessages]   = useState([]);
  // Input state
  const [newMsg, setNewMsg]       = useState('');
  const [loading, setLoading]     = useState(true);

  // Profile & partner info
  const [myName, setMyName]           = useState('');
  const [myAvatar, setMyAvatar]       = useState(DEFAULT_AVATAR_URL);
  const [partnerName, setPartnerName] = useState('');
  const [partnerAvatar, setPartnerAvatar] = useState(DEFAULT_AVATAR_URL);

  // 1️⃣ Load my profile (OPTIMIZED)
  useEffect(() => {
    if (!empId) return;
    (async () => {
      try {
        const employeeMap = await getCachedEmployeeData([empId]);
        const myData = employeeMap[empId];
        if (myData) {
          setMyName(myData.name);
          setMyAvatar(myData.avatar);
        }
      } catch (error) {
        console.error('Error loading my profile:', error);
      }
    })();
  }, [empId]);

  // 2️⃣ Load partner info (OPTIMIZED)
  useEffect(() => {
    if (!rid || !empId) return;
    (async () => {
      try {
        const participants = await getCachedParticipantData(rid, empId);
        const partnerData = participants?.[0]?.employee;
        
        if (!partnerData) {
          setPartnerName('Unknown');
          return;
        }
        
        setPartnerName(`${partnerData.first_name} ${partnerData.last_name}`);
        
        if (partnerData.profile_photo_path) {
          const { data: urlData } = supabase
            .storage.from('profile-photo')
            .getPublicUrl(partnerData.profile_photo_path);
          setPartnerAvatar(urlData.publicUrl);
        }
      } catch (error) {
        console.error('Error loading partner info:', error);
        setPartnerName('Unknown');
      }
    })();
  }, [rid, empId]);

  // 3️⃣ Fetch deleted_at cutoff
  useEffect(() => {
    if (!rid || !empId) return;
    supabase
      .from('chat_room_participants')
      .select('deleted_at')
      .eq('room_id', rid)
      .eq('employee_id', empId)
      .single()
      .then(({ data }) => {
        setDeletedAt(data?.deleted_at || null);
      });
  }, [rid, empId]);

  // 4️⃣ Load & decrypt messages (OPTIMIZED with soft-delete filtering + real-time)
  const loadMessagesOptimized = useCallback(async () => {
    try {
      setLoading(true);
      // Use cached messages
      let all = await getCachedMessages(rid);
      // filter out before deletedAt
      if (deletedAt) {
        all = all.filter(m => new Date(m.sentAt) > new Date(deletedAt));
      }
      setMessages(all);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [rid, deletedAt]);

  // Handle new message insertion (optimized)
  const handleNewMessage = useCallback(async (payload) => {
    try {
      // Only load the new message instead of all messages
      const newMessage = await loadMessages(rid);
      const latestMessage = newMessage[newMessage.length - 1];
      
      if (latestMessage) {
        // Check if it should be filtered by deletedAt
        if (!deletedAt || new Date(latestMessage.sentAt) > new Date(deletedAt)) {
          addMessageToCache(rid, latestMessage);
          setMessages(prev => [...prev, latestMessage]);
        }
      }
    } catch (error) {
      console.error('Error handling new message:', error);
      // Fallback to full reload if incremental fails
      loadMessagesOptimized();
    }
  }, [rid, deletedAt, loadMessagesOptimized]);

  useEffect(() => {
    if (!rid) return;
    
    // Initial load
    loadMessagesOptimized();
    
    // Set up real-time subscription with optimized handler
    const channel = supabase
      .channel(`messages-${rid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${rid}`
        },
        handleNewMessage
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rid, loadMessagesOptimized, handleNewMessage]);

  // 5️⃣ Send a message (optimistic UI)
  const [optimisticMessages, setOptimisticMessages] = useState([]);
  const handleSend = async () => {
    if (!newMsg.trim()) return;
    const tempMsg = {
      id: `optimistic-${Date.now()}`,
      senderId: empId,
      text: newMsg.trim(),
      sentAt: new Date().toISOString(),
      optimistic: true,
    };
    setOptimisticMessages(msgs => [...msgs, tempMsg]); // Add to chat box immediately
    setNewMsg('');
    await sendMessage(rid, tempMsg.text, empId);
    // Do NOT remove optimistic message here; wait for backend confirmation
  };

  // Remove optimistic messages only when real message arrives
  useEffect(() => {
    if (!optimisticMessages.length || !messages.length) return;
    setOptimisticMessages(msgs =>
      msgs.filter(optMsg =>
        !messages.some(realMsg =>
          realMsg.senderId === optMsg.senderId &&
          realMsg.text === optMsg.text &&
          Math.abs(new Date(realMsg.sentAt) - new Date(optMsg.sentAt)) < 60000 // within 1 min
        )
      )
    );
  }, [messages]);

  // 6️⃣ Group by date & auto-scroll
  const allMessages = [...messages, ...optimisticMessages];
  const grouped = useMemo(() => {
    const byDay = {};
    allMessages.forEach(m => {
      const day = new Date(m.sentAt).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric'
      });
      ;(byDay[day] ||= []).push(m);
    });
    return Object.entries(byDay);
  }, [allMessages]);

  useEffect(() => {
    const c = document.getElementById('private-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [allMessages]);

  return (
    <div className="flex flex-col w-full max-w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl mx-auto bg-white rounded-none shadow-none overflow-hidden" style={{ height: '700px' }}>
      {/* Header */}
      <div className="flex-shrink-0 h-16 px-6 flex items-center border-b bg-white gap-4">
        <img src={partnerAvatar} alt={partnerName} className="h-10 w-10 rounded-full object-cover" />
        <span className="font-semibold text-lg">{partnerName}</span>
      </div>

      {/* Messages */}
      <div
        id="private-chat-container"
        className="flex-1 min-h-0 overflow-y-auto px-6 py-3 bg-gray-50"
        style={{ minHeight: 0, maxHeight: 'calc(700px - 64px - 56px)' }} // 64px header + 56px input
      >
        {grouped.map(([date, msgs]) => (
          <div key={date}>
            <div className="text-center text-xs text-gray-400 my-2 font-medium">{date}</div>
            {msgs.map(msg => {
              const isMine = msg.senderId === empId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-4`}
                >
                  <div
                    className={`flex items-end gap-3 ${isMine ? 'flex-row-reverse' : ''}`}
                  >
                    <img
                      src={isMine ? myAvatar : partnerAvatar}
                      alt={isMine ? myName : partnerName}
                      className="h-8 w-8 rounded-full object-cover"
                      style={{ marginBottom: 2 }}
                    />
                    <div className={`max-w-lg ${isMine ? 'text-right' : 'text-left'}`}>
                      <div
                        className={`inline-block px-3 py-2 rounded-lg text-sm ${
                          isMine ? (msg.optimistic ? 'bg-blue-300 text-white opacity-70 animate-pulse' : 'bg-blue-600 text-white') : 'bg-white text-gray-800 border'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <div className={`text-xs mt-1 ${msg.optimistic ? 'text-gray-400' : 'text-gray-500'}`}>{msg.optimistic ? 'Sending…' : new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 py-2 border-t bg-white flex items-center gap-2 sticky bottom-0 z-10"
        style={{ boxShadow: '0 -2px 8px rgba(0,0,0,0.03)' }}>
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Write a message"
          className="flex-1 rounded-full border px-4 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
          style={{ minWidth: 0 }}
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded-full font-medium hover:bg-blue-700 transition"
          style={{ whiteSpace: 'nowrap' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
