// src/components/Chat/PrivateChatRoom.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient';

const PrivateChatRoom = ({ roomId, currentEmployee }) => {
  const rid = roomId; // keep as UUID string
  const [partnerName, setPartnerName] = useState('Chat');
  const [partnerAvatar, setPartnerAvatar] = useState('');
  const [myName, setMyName] = useState('');
  const [myAvatar, setMyAvatar] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // Load my profile
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('employee')
        .select('first_name, preferred_name, profile_photo_path')
        .eq('employee_id', currentEmployee.employee_id)
        .single();
      const name = data?.preferred_name || data?.first_name || 'Me';
      let avatar = 'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';
      if (data?.profile_photo_path) {
        const { data: urlData } = supabase
          .storage
          .from('profile-photo')
          .getPublicUrl(data.profile_photo_path);
        avatar = urlData.publicUrl;
      }
      setMyName(name);
      setMyAvatar(avatar);
    })();
  }, [currentEmployee]);

  // Load partner info
  useEffect(() => {
    if (!rid) return;
    (async () => {
      const { data: row } = await supabase
        .from('chat_room_participants')
        .select('employee(first_name, last_name, profile_photo_path)')
        .eq('room_id', rid)
        .neq('employee_id', currentEmployee.employee_id)
        .single();
      const emp = row?.employee;
      if (!emp) return;
      const name = `${emp.first_name} ${emp.last_name}`.trim();
      let avatar = 'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';
      if (emp.profile_photo_path) {
        const { data: urlData } = supabase
          .storage
          .from('profile-photo')
          .getPublicUrl(emp.profile_photo_path);
        avatar = urlData.publicUrl;
      }
      setPartnerName(name);
      setPartnerAvatar(avatar);
    })();
  }, [rid, currentEmployee]);

  // Load messages
  useEffect(() => {
    if (!rid) return;
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, message, created_at, sender_id')
        .eq('chat_room_id', rid)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`private-${rid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${rid}` },
        ({ new: m }) => setMessages((prev) => [...prev, m])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [rid]);

  // auto-scroll
  useEffect(() => {
    const c = document.getElementById('private-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !rid) return;
    await supabase.from('messages').insert({
      chat_room_id: rid,
      sender_id: currentEmployee.employee_id,
      message: newMsg.trim(),
    });
    setNewMsg('');
  };

  // memoized grouping
  const groupedMessages = useMemo(() => {
    return Object.entries(
      messages.reduce((acc, msg) => {
        const dateKey = new Date(msg.created_at).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        acc[dateKey] = acc[dateKey] || [];
        acc[dateKey].push(msg);
        return acc;
      }, {})
    );
  }, [messages]);

  if (loading) return <div className="p-4 text-center">Loading chat…</div>;

  return (
    <div className="flex flex-col h-96 border rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 font-semibold text-lg flex items-center space-x-2">
        <img src={partnerAvatar} alt={partnerName} className="h-8 w-8 rounded-full" />
        <span>{partnerName}</span>
      </div>
      {/* Messages */}
      <div id="private-chat-container" className="flex-1 overflow-y-auto p-4">
        {groupedMessages.map(([date, msgs]) => (
          <div key={date} className="space-y-4">
            <div className="text-center my-2 text-gray-500 text-xs font-medium">{date}</div>
            {msgs.map((msg) => {
              const isOwn = msg.sender_id === currentEmployee.employee_id;
              const avatar = isOwn ? myAvatar : partnerAvatar;
              const name = isOwn ? myName : partnerName;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <img
                      src={avatar}
                      alt={name}
                      className="h-8 w-8 rounded-full"
                      style={{ marginTop: '2px' }}
                    />
                    <div className={`${isOwn ? 'mr-2 text-right' : 'ml-2 text-left'}`} style={{ maxWidth: '75%' }}>
                      <div className="text-xs font-semibold text-gray-700">{name}</div>
                      <div className={`mt-1 inline-block px-4 py-2 rounded-lg shadow text-sm ${
                        isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                      }`}>{msg.message}</div>
                      <div className="text-[10px] mt-1 opacity-60 text-right">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
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
          onChange={(e) => setNewMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          Send
        </button>
      </div>
    </div>
  );
};

export default PrivateChatRoom;
