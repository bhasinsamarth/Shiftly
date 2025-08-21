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
  const [messagesState, setMessagesState] = useState([]);
  const [newMsg, setNewMsg]     = useState('');
  const [loading, setLoading]   = useState(true);

  // Optimistic UI for sending messages
  const [optimisticMessages, setOptimisticMessages] = useState([]);

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
        sentAt: m.sentAt, // changed from ts to sentAt for consistency
        senderId: m.senderId,
        senderName: map[m.senderId]?.name || 'Unknown',
        senderAvatar: map[m.senderId]?.avatar || DEFAULT_AVATAR_URL
      }));

      setMessagesState(ui);
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
  }, [messagesState, optimisticMessages]); // include optimisticMessages for instant scroll

  // 3️⃣ Send encrypted with optimistic UI
  const handleSend = async () => {
    if (!newMsg.trim()) return;
    const tempMsg = {
      id: `optimistic-${Date.now()}`,
      senderId: currentEmployee.employee_id,
      text: newMsg.trim(),
      sentAt: new Date().toISOString(), // changed from ts to sentAt for consistency
      optimistic: true,
    };
    setOptimisticMessages(msgs => [...msgs, tempMsg]); // Show pending message instantly
    setNewMsg('');
    await sendMessage(rid, tempMsg.text, currentEmployee.employee_id);
    setOptimisticMessages(msgs => msgs.filter(m => m.id !== tempMsg.id)); // Remove pending after send
  };

  // Combine real and optimistic messages
  const allMessages = [...messagesState, ...optimisticMessages];

  // 4️⃣ Group by date
  const groupedMessages = useMemo(() => {
    return Object.entries(
      allMessages.reduce((acc, msg) => {
        const key = new Date(msg.sentAt).toLocaleDateString(undefined, {
          month: 'long', day: 'numeric', year: 'numeric'
        });
        (acc[key] = acc[key] || []).push(msg);
        return acc;
      }, {})
    );
  }, [allMessages]);

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

  //if (loading) return <div className="p-4 text-center">Loading store chat…</div>;

  return (
    <>
      {/* Chat Box */}
      <div className="flex flex-col h-full w-full bg-white">
        {/* Header */}
        <div className="h-16 px-6 flex items-center border-b bg-white justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-lg">{storeName}</span>
          </div>
          <div className="relative" ref={optionsRef}>
            <button onClick={() => setShowOptions(o => !o)} className="px-3 py-2 bg-gray-100 rounded-lg font-medium text-gray-700 hover:bg-gray-200">
              Options ▾
            </button>
            {showOptions && (
              <ul className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg z-10 overflow-hidden">
                <li>
                  <button
                    onClick={() => { setShowMembers(true); setShowOptions(false); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100"
                  >
                    View Members
                  </button>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Messages */}
        <div id="store-chat-container" className="flex-1 min-h-0 overflow-y-auto px-6 py-4 bg-gray-50" style={{ minHeight: 0, maxHeight: 'calc(700px - 64px - 56px)' }}>
          {groupedMessages.map(([date, msgs]) => (
            <div key={date} className="space-y-6">
              <div className="text-center my-2 text-gray-400 text-xs font-medium">{date}</div>
              {msgs.map(msg => {
                const mine = msg.senderId === currentEmployee.employee_id;
                return (
                  <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-4`}>
                    <div className={`flex items-end gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                      <img
                        src={msg.senderAvatar || DEFAULT_AVATAR_URL}
                        alt={msg.senderName || ''}
                        className="h-8 w-8 rounded-full object-cover"
                        style={{ marginBottom: 2 }}
                      />
                      <div className={`max-w-lg ${mine ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block px-3 py-2 rounded-lg text-sm ${mine ? (msg.optimistic ? 'bg-blue-300 text-white opacity-70 animate-pulse' : 'bg-blue-600 text-white') : 'bg-white text-gray-800 border'}`}>
                          {msg.text}
                        </div>
                        <div className={`text-xs mt-1 ${msg.optimistic ? 'text-gray-400' : 'text-gray-500'}`}>{msg.optimistic ? 'Sending…' : new Date(msg.sentAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</div>
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
          <button onClick={handleSend} className="bg-blue-600 text-white px-4 py-2 rounded-full font-medium hover:bg-blue-700 transition">
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
