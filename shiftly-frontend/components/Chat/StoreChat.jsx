// src/components/Chat/StoreChat.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import {
  loadMessages as loadEncryptedMessages,
  sendMessage as sendMessage,
} from '../../utils/chatService';

const DEFAULT_AVATAR_URL =
  'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';

export default function StoreChat({ roomId: rid, currentEmployee }) {
  const navigate = useNavigate();
  const optionsRef = useRef();

  // — Store ID (from chat_rooms) & name
  const [storeId, setStoreId]     = useState(null);
  const [storeName, setStoreName] = useState('Loading…');

  // — Messages
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg]     = useState('');
  const [loading, setLoading]   = useState(true);

  // — Members modal
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers]         = useState([]);

  // — Options dropdown
  const [showOptions, setShowOptions] = useState(false);
  useEffect(() => {
    const onClickOutside = e => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // — Admin context (role_id 1,2,3)
  const isCurrentAdmin = [1, 2, 3].includes(currentEmployee.role_id);

  // 0️⃣ Fetch store_id & store_name from chat_rooms → store
  useEffect(() => {
    if (!rid) return;
    (async () => {
      // get store_id from chat_rooms
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('store_id')
        .eq('id', rid)
        .single();
      if (room?.store_id) {
        setStoreId(room.store_id);
        // then fetch store_name
        const { data: store } = await supabase
          .from('store')
          .select('store_name')
          .eq('store_id', room.store_id)
          .single();
        setStoreName(store?.store_name || 'Store Chat');
      } else {
        setStoreName('Store Chat');
      }
    })();
  }, [rid]);

  // 1️⃣ Load & decrypt messages + realtime
  useEffect(() => {
    if (!rid) return;
    const load = async () => {
      setLoading(true);
      const decrypted = await loadEncryptedMessages(rid);
      const ids = [...new Set(decrypted.map(m => m.senderId))];
      const { data: emps } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path')
        .in('employee_id', ids);

      const map = {};
      emps.forEach(e => {
        map[e.employee_id] = {
          name: `${e.first_name} ${e.last_name}`.trim(),
          avatar: e.profile_photo_path
            ? supabase.storage
                .from('profile-photo')
                .getPublicUrl(e.profile_photo_path).data.publicUrl
            : DEFAULT_AVATAR_URL
        };
      });

      const ui = decrypted.map(m => ({
        id: m.id,
        text: m.text,
        ts: m.sentAt,
        senderId: m.senderId,
        senderName: map[m.senderId]?.name || 'Unknown',
        senderAvatar: map[m.senderId]?.avatar || DEFAULT_AVATAR_URL
      }));

      setMessages(ui);
      setLoading(false);
    };

    load();
    const channel = supabase
      .channel(`store-${rid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${rid}` },
        load
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [rid]);

  // 2️⃣ Auto-scroll
  useEffect(() => {
    const c = document.getElementById('store-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  // 3️⃣ Send encrypted
  const handleSend = async () => {
    if (!newMsg.trim()) return;
    await sendMessage(rid, newMsg.trim(), currentEmployee.employee_id);
    setNewMsg('');
  };

  // 4️⃣ Group by date
  const groupedMessages = useMemo(() => {
    return Object.entries(
      messages.reduce((acc, msg) => {
        const key = new Date(msg.ts).toLocaleDateString(undefined, {
          month: 'long', day: 'numeric', year: 'numeric'
        });
        (acc[key] = acc[key] || []).push(msg);
        return acc;
      }, {})
    );
  }, [messages]);

  // 5️⃣ Load store members
  useEffect(() => {
    if (!showMembers || !storeId) {
      if (!showMembers) setMembers([]);
      return;
    }
    (async () => {
      const { data: emps } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path, role_id')
        .eq('store_id', storeId);
      setMembers(
        emps.map(e => ({
          id: e.employee_id,
          name: `${e.first_name} ${e.last_name}`.trim(),
          avatar: e.profile_photo_path
            ? supabase.storage
                .from('profile-photo')
                .getPublicUrl(e.profile_photo_path).data.publicUrl
            : DEFAULT_AVATAR_URL,
          isAdmin: [1, 2, 3].includes(e.role_id)
        }))
      );
    })();
  }, [showMembers, storeId]);

  // 6️⃣ Remove member
  const removeMember = async id => {
    if (!isCurrentAdmin) return;
    await supabase
      .from('employee')
      .update({ store_id: null })
      .eq('employee_id', id);
    setMembers(ms => ms.filter(m => m.id !== id));
  };

  if (loading) return <div className="p-4 text-center">Loading store chat…</div>;

  return (
    <>
      {/* Chat Box */}
      <div className="flex flex-col h-96 w-[80vw] max-w-3xl mx-auto border rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 font-semibold text-lg flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/chat')} className="text-blue-600 hover:underline">
              ← Back
            </button>
            <span>{storeName}</span>
          </div>
          <div className="relative" ref={optionsRef}>
            <button onClick={() => setShowOptions(o => !o)} className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300">
              Options ▾
            </button>
            {showOptions && (
              <ul className="absolute right-0 mt-2 w-32 bg-white border rounded shadow-lg z-10">
                <li>
                  <button
                    onClick={() => { setShowMembers(true); setShowOptions(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    View Members
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Messages */}
        <div id="store-chat-container" className="flex-1 overflow-y-auto p-4">
          {groupedMessages.map(([date, msgs]) => (
            <div key={date} className="space-y-4">
              <div className="text-center my-2 text-gray-500 text-xs font-medium">{date}</div>
              {msgs.map(msg => {
                const mine = msg.senderId === currentEmployee.employee_id;
                return (
                  <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start space-x-2 ${mine ? 'flex-row-reverse' : ''}`}>
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="h-8 w-8 rounded-full"
                        style={{ marginTop: 2 }}
                      />
                      <div className={`${mine ? 'mr-2 text-right' : 'ml-2 text-left'}`} style={{ maxWidth: '75%' }}>
                        <div className="text-xs font-semibold text-gray-700">{msg.senderName}</div>
                        <div className={`mt-1 inline-block px-4 py-2 rounded-lg shadow text-sm ${mine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                          {msg.text}
                        </div>
                        <div className="text-[10px] mt-1 opacity-60 text-right">
                          {new Date(msg.ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
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
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleSend} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            Send
          </button>
        </div>
      </div>

      {/* Members Modal */}
      {showMembers && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-80 max-h-[80vh] overflow-auto p-4">
            <h3 className="text-lg font-semibold mb-3">Store Members</h3>
            {members.length === 0 && <p className="text-center text-gray-500">No members found.</p>}
            <ul className="space-y-2">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img src={m.avatar} alt={m.name} className="h-8 w-8 rounded-full" />
                    <span className="text-sm">{m.name}</span>
                  </div>
                  {isCurrentAdmin && !m.isAdmin && m.id !== currentEmployee.employee_id && (
                    <button onClick={() => removeMember(m.id)} className="text-red-600 text-xs hover:underline">
                      Remove
                    </button>
                  )}
                  {m.isAdmin && <span className="text-xs text-green-600">(admin)</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 text-right">
              <button onClick={() => setShowMembers(false)} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
