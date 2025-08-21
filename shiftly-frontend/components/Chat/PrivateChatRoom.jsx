// src/components/Chat/PrivateChatRoom.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { loadMessages, sendMessage } from '../../utils/chatService';

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

  // 1️⃣ Load my profile
  useEffect(() => {
    if (!empId) return;
    supabase
      .from('employee')
      .select('first_name, preferred_name, profile_photo_path')
      .eq('employee_id', empId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setMyName(data.preferred_name || data.first_name);
        if (data.profile_photo_path) {
          const { data: urlData } = supabase
            .storage.from('profile-photo')
            .getPublicUrl(data.profile_photo_path);
          setMyAvatar(urlData.publicUrl);
        }
      });
  }, [empId]);

  // 2️⃣ Load partner info
  useEffect(() => {
    if (!rid || !empId) return;
    supabase
      .from('chat_room_participants')
      .select('employee(first_name,last_name,profile_photo_path)')
      .eq('room_id', rid)
      .neq('employee_id', empId)
      .single()
      .then(({ data: row }) => {
        const emp = row?.employee;
        if (!emp) return setPartnerName('Unknown');
        setPartnerName(`${emp.first_name} ${emp.last_name}`);
        if (emp.profile_photo_path) {
          const { data: urlData } = supabase
            .storage.from('profile-photo')
            .getPublicUrl(emp.profile_photo_path);
          setPartnerAvatar(urlData.publicUrl);
        }
      });
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

  // 4️⃣ Load & decrypt messages (with soft-delete filtering + real-time)
  useEffect(() => {
    if (!rid) return;
    const reload = async () => {
      setLoading(true);
      // load all decrypted
      let all = await loadMessages(rid);
      // filter out before deletedAt
      if (deletedAt) {
        all = all.filter(m => new Date(m.sentAt) > new Date(deletedAt));
      }
      setMessages(all);
      setLoading(false);
    };
    reload();
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
        reload
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [rid, deletedAt]);

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
