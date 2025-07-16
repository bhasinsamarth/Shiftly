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

  // 5️⃣ Send a message (encrypt & insert)
  const handleSend = async () => {
    if (!newMsg.trim()) return;
    await sendMessage(rid, newMsg.trim(), empId);
    setNewMsg('');
  };

  // 6️⃣ Group by date & auto-scroll
  const grouped = useMemo(() => {
    const byDay = {};
    messages.forEach(m => {
      const day = new Date(m.sentAt).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric'
      });
      ;(byDay[day] ||= []).push(m);
    });
    return Object.entries(byDay);
  }, [messages]);

  useEffect(() => {
    const c = document.getElementById('private-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  if (loading) return <div className="p-4 text-center">Loading chat…</div>;

  return (
    <div className="flex flex-col h-full w-full bg-white">
      {/* Header */}
      <div className="h-16 px-6 flex items-center border-b bg-white gap-4">
        <img src={partnerAvatar} alt={partnerName} className="h-10 w-10 rounded-full object-cover" />
        <span className="font-semibold text-lg">{partnerName}</span>
      </div>

      {/* Messages */}
      <div
        id="private-chat-container"
        className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50"
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
                          isMine ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border'
                        }`}
                      >
                        {msg.text}
                      </div>
                      <div className="text-xs mt-1 text-gray-500">
                        {new Date(msg.sentAt).toLocaleTimeString([], {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t bg-white flex items-center gap-3">
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Write a message"
          className="flex-1 rounded-full border px-4 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 text-white px-4 py-2 rounded-full font-medium hover:bg-blue-700 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
