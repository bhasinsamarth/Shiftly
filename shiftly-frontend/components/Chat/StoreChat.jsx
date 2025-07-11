// src/components/Chat/StoreChat.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const DEFAULT_AVATAR_URL =
  'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';

const StoreChat = ({ roomId, currentEmployee, roomName }) => {
  const navigate = useNavigate();
  const rid = roomId;

  // ── Messages ───────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Members modal ──────────────────────────────────────────────────────────────
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState([]);

  // ── Options dropdown ───────────────────────────────────────────────────────────
  const [showOptions, setShowOptions] = useState(false);
  const optionsRef = useRef();
  useEffect(() => {
    function onClickOutside(e) {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ── Admin context: role_id 1,2,3 are store admins ─────────────────────────────
  const isCurrentAdmin = [1, 2, 3].includes(currentEmployee.role_id);

  // ── 1️⃣ Load messages + realtime subscribe ────────────────────────────────────
  useEffect(() => {
    if (!rid) return;
    (async () => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, message, created_at, sender_id,
          employee(first_name, last_name, profile_photo_path)
        `)
        .eq('chat_room_id', rid)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(
          data.map(msg => {
            const emp = msg.employee || {};
            let avatar = DEFAULT_AVATAR_URL;
            if (emp.profile_photo_path) {
              const { data: { publicUrl } } = supabase
                .storage
                .from('profile-photo')
                .getPublicUrl(emp.profile_photo_path);
              avatar = publicUrl;
            }
            return {
              id: msg.id,
              text: msg.message,
              ts: msg.created_at,
              senderId: msg.sender_id,
              senderName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
              senderAvatar: avatar,
            };
          })
        );
      }
      setLoading(false);
    })();

    const channel = supabase
      .channel(`store-${rid}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `chat_room_id=eq.${rid}`
      }, async ({ new: m }) => {
        const { data: emp } = await supabase
          .from('employee')
          .select('first_name, last_name, profile_photo_path')
          .eq('employee_id', m.sender_id)
          .single();
        let avatar = DEFAULT_AVATAR_URL;
        if (emp?.profile_photo_path) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-photo')
            .getPublicUrl(emp.profile_photo_path);
          avatar = publicUrl;
        }
        setMessages(prev => [
          ...prev,
          {
            id: m.id,
            text: m.message,
            ts: m.created_at,
            senderId: m.sender_id,
            senderName: `${emp.first_name} ${emp.last_name}`.trim(),
            senderAvatar: avatar,
          },
        ]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [rid]);

  // ── 2️⃣ Auto-scroll when new messages arrive ───────────────────────────────────
  useEffect(() => {
    const c = document.getElementById('store-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  // ── 3️⃣ Send a new message ─────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMsg.trim()) return;
    await supabase.from('messages').insert({
      chat_room_id: rid,
      sender_id: currentEmployee.employee_id,
      message: newMsg.trim(),
    });
    setNewMsg('');
  };

  // ── 4️⃣ Group messages by date (memoized) ──────────────────────────────────────
  const groupedMessages = useMemo(() => {
    return Object.entries(
      messages.reduce((acc, msg) => {
        const dateKey = new Date(msg.ts).toLocaleDateString(undefined, {
          month: 'long', day: 'numeric', year: 'numeric',
        });
        (acc[dateKey] = acc[dateKey] || []).push(msg);
        return acc;
      }, {})
    );
  }, [messages]);

  // ── 5️⃣ Load all store members (everyone with the same store_id) ──────────────
  useEffect(() => {
    if (!showMembers) return;
    (async () => {
      if (currentEmployee.store_id == null) return;
      const { data: emps, error } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path, role_id')
        .eq('store_id', currentEmployee.store_id);

      if (error) {
        console.error('Error loading store members:', error);
        return;
      }

      const list = emps.map(e => {
        let avatar = DEFAULT_AVATAR_URL;
        if (e.profile_photo_path) {
          const { data: { publicUrl } } = supabase
            .storage
            .from('profile-photo')
            .getPublicUrl(e.profile_photo_path);
          avatar = publicUrl;
        }
        return {
          id: e.employee_id,
          name: `${e.first_name} ${e.last_name}`.trim(),
          avatar,
          isAdmin: [1, 2, 3].includes(e.role_id),
        };
      });

      setMembers(list);
    })();
  }, [showMembers, currentEmployee.store_id]);

  // ── 6️⃣ Admin only: remove a member by clearing their store_id ────────────────
  const removeMember = async empId => {
    if (!isCurrentAdmin) return;
    await supabase
      .from('employee')
      .update({ store_id: null })
      .eq('employee_id', empId);
    setMembers(m => m.filter(x => x.id !== empId));
  };

  if (loading) {
    return <div className="p-4 text-center">Loading store chat…</div>;
  }

  return (
    <>
      {/* Chat Box */}
      <div className="flex flex-col h-96 w-[80vw] max-w-3xl mx-auto border rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 font-semibold text-lg flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/chat')}
              className="text-blue-600 hover:underline"
            >
              ← Back
            </button>
            <span>{"Chat"}</span>
          </div>

          <div className="relative" ref={optionsRef}>
            <button
              onClick={() => setShowOptions(v => !v)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
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
              <div className="text-center my-2 text-gray-500 text-xs font-medium">
                {date}
              </div>
              {msgs.map(msg => {
                const isOwn = msg.senderId === currentEmployee.employee_id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-start space-x-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="h-8 w-8 rounded-full"
                        style={{ marginTop: '2px' }}
                      />
                      <div
                        className={`${isOwn ? 'mr-2 text-right' : 'ml-2 text-left'}`}
                        style={{ maxWidth: '75%' }}
                      >
                        <div className="text-xs font-semibold text-gray-700">
                          {msg.senderName}
                        </div>
                        <div
                          className={`mt-1 inline-block px-4 py-2 rounded-lg shadow text-sm ${
                            isOwn
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <div className="text-[10px] mt-1 opacity-60 text-right">
                          {new Date(msg.ts).toLocaleTimeString([], {
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
            onChange={e => setNewMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Send
          </button>
        </div>
      </div>

      {/* Members Modal */}
      {showMembers && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-80 max-h-[80vh] overflow-auto p-4">
            <h3 className="text-lg font-semibold mb-3">Store Members</h3>
            <ul className="space-y-2">
              {members.map(m => (
                <li key={m.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img src={m.avatar} alt={m.name} className="h-8 w-8 rounded-full" />
                    <span className="text-sm">{m.name}</span>
                  </div>
                  {isCurrentAdmin && !m.isAdmin && m.id !== currentEmployee.employee_id && (
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Remove
                    </button>
                  )}
                  {m.isAdmin && <span className="text-xs text-green-600">(admin)</span>}
                </li>
              ))}
            </ul>
            <div className="mt-4 text-right">
              <button
                onClick={() => setShowMembers(false)}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StoreChat;
