// src/components/Chat/PrivateChatRoom.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const DEFAULT_AVATAR_URL =
  'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';

export default function PrivateChatRoom({ roomId: rid, currentEmployee }) {
  const navigate = useNavigate();
  const empId    = currentEmployee.employee_id;

  const [deletedAt, setDeletedAt]   = useState(null);
  const [messages, setMessages]     = useState([]);
  const [newMsg, setNewMsg]         = useState('');
  const [loading, setLoading]       = useState(true);

  const [myName, setMyName]               = useState('');
  const [myAvatar, setMyAvatar]           = useState(DEFAULT_AVATAR_URL);
  const [partnerName, setPartnerName]     = useState('');
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

  // 4️⃣ Load messages after deletedAt
  useEffect(() => {
    if (!rid) return;
    setLoading(true);
    const since = deletedAt || new Date(0).toISOString();
    supabase
      .from('messages')
      .select('id,message,created_at,sender_id')
      .eq('chat_room_id', rid)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || []);
        setLoading(false);
      });
  }, [rid, deletedAt]);

  // 5️⃣ Send a message
  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    const { data: ins } = await supabase
      .from('messages')
      .insert({ chat_room_id: rid, sender_id: empId, message: newMsg.trim() })
      .select('id,message,created_at,sender_id')
      .single();
    if (ins && new Date(ins.created_at) > new Date(deletedAt || 0)) {
      setMessages(prev => [...prev, ins]);
    }
    setNewMsg('');
  };

  // 6️⃣ Group by date & auto-scroll
  const grouped = useMemo(() => {
    const byDay = {};
    messages.forEach(m => {
      const day = new Date(m.created_at).toLocaleDateString(undefined, {
        month: 'long', day: 'numeric', year: 'numeric'
      });
      (byDay[day] = byDay[day] || []).push(m);
    });
    return Object.entries(byDay);
  }, [messages]);

  useEffect(() => {
    const c = document.getElementById('private-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  if (loading) return <div className="p-4 text-center">Loading chat…</div>;

  return (
    <div className="flex flex-col h-96 w-[80vw] max-w-3xl mx-auto border rounded-lg shadow-md overflow-hidden bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex items-center space-x-4">
        <button
          onClick={() => navigate('/chat?mode=private')}
          className="text-blue-600 hover:underline"
        >
          ← Back
        </button>
        <img src={partnerAvatar} alt={partnerName} className="h-8 w-8 rounded-full" />
        <span className="font-semibold text-lg">{partnerName}</span>
      </div>

      {/* Messages */}
      <div id="private-chat-container" className="flex-1 overflow-y-auto p-4 space-y-4">
        {grouped.map(([date, msgs]) => (
          <div key={date}>
            <div className="text-center text-xs text-gray-500 my-2">{date}</div>
            {msgs.map(msg => {
              const isMine = msg.sender_id === empId;
              const avatar = isMine ? myAvatar : partnerAvatar;
              const name   = isMine ? myName   : partnerName;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start ${isMine ? 'flex-row-reverse' : ''}`}>
                    <img
                      src={avatar}
                      alt={name}
                      className="h-8 w-8 rounded-full"
                      style={{ marginTop: 2 }}
                    />
                    <div className={`${isMine ? 'mr-2 text-right' : 'ml-2 text-left'}`} style={{ maxWidth: '75%' }}>
                      <div className="text-xs font-semibold text-gray-700">{name}</div>
                      <div className={`mt-1 inline-block px-4 py-2 rounded-lg shadow text-sm ${
                        isMine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                      }`}>{msg.message}</div>
                      <div className="text-[10px] mt-1 opacity-60 text-right">
                        {new Date(msg.created_at).toLocaleTimeString([], {
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
      <div className="p-4 border-t bg-white flex gap-2">
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message…"
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
);
}
