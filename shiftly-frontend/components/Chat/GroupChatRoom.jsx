// src/components/Chat/GroupChatRoom.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

const GroupChatRoom = ({ roomId, currentEmployee, roomName }) => {
  const navigate = useNavigate();
  const rid = roomId;

  // ── Chat messages ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Admin & members state ─────────────────────────────────────────────────────
  const [showMembers, setShowMembers] = useState(false);
  const [participants, setParticipants] = useState([]);         // { id, name, avatar, isAdmin }
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [newMemberId, setNewMemberId] = useState(null);

  // ── Group‐name editing ─────────────────────────────────────────────────────────
  const [groupName, setGroupName] = useState(roomName);
  const [editingName, setEditingName] = useState(false);

  // ── Options menu ───────────────────────────────────────────────────────────────
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

  // ── 1️⃣ Load messages + subscribe ───────────────────────────────────────────────
  useEffect(() => {
    if (!rid) return;
    async function loadMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, message, created_at, sender_id,
          employee(first_name, last_name, profile_photo_path)
        `)
        .eq('chat_room_id', rid)
        .order('created_at', { ascending: true });
      if (!error && data) {
        const enriched = await Promise.all(data.map(msg => {
          const emp = msg.employee || {};
          let avatar = 'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';
          if (emp.profile_photo_path) {
            const { data: urlData } = supabase
              .storage
              .from('profile-photo')
              .getPublicUrl(emp.profile_photo_path);
            avatar = urlData.publicUrl;
          }
          return {
            id: msg.id,
            text: msg.message,
            ts: msg.created_at,
            senderId: msg.sender_id,
            senderName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
            senderAvatar: avatar,
          };
        }));
        setMessages(enriched);
      }
      setLoading(false);
    }
    loadMessages();

    const channel = supabase
      .channel(`group-${rid}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `chat_room_id=eq.${rid}`
      }, async ({ new: m }) => {
        const { data: emp } = await supabase
          .from('employee')
          .select('first_name, last_name, profile_photo_path')
          .eq('employee_id', m.sender_id)
          .single();
        let avatar = 'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';
        if (emp?.profile_photo_path) {
          const { data: urlData } = supabase
            .storage
            .from('profile-photo')
            .getPublicUrl(emp.profile_photo_path);
          avatar = urlData.publicUrl;
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

  // ── 2️⃣ Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const c = document.getElementById('group-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  // ── 3️⃣ Send message ────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMsg.trim() || !rid) return;
    await supabase.from('messages').insert({
      chat_room_id: rid,
      sender_id: currentEmployee.employee_id,
      message: newMsg.trim(),
    });
    setNewMsg('');
  };

  // ── 4️⃣ Group by date ───────────────────────────────────────────────────────────
  const groupedMessages = useMemo(() => {
    return Object.entries(
      messages.reduce((acc, msg) => {
        const dateKey = new Date(msg.ts).toLocaleDateString(undefined, {
          month: 'long', day: 'numeric', year: 'numeric'
        });
        acc[dateKey] = acc[dateKey] || [];
        acc[dateKey].push(msg);
        return acc;
      }, {})
    );
  }, [messages]);

  // ── 5️⃣ Fetch members when showing modal ────────────────────────────────────────
  useEffect(() => {
    if (!showMembers || !rid) return;
    (async () => {
      const { data: parts, error: partErr } = await supabase
        .from('chat_room_participants')
        .select('employee_id, is_admin')
        .eq('room_id', rid);
      if (partErr) {
        console.error('Error loading participants:', partErr);
        return;
      }
      const empIds = parts.map(p => p.employee_id);
      const { data: emps, error: empErr } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path')
        .in('employee_id', empIds);
      if (empErr) {
        console.error('Error loading employee details:', empErr);
        return;
      }
      const list = parts.map(({ employee_id, is_admin }) => {
        const e = emps.find(x => x.employee_id === employee_id) || {};
        let avatar = 'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';
        if (e.profile_photo_path) {
          const { data: urlData } = supabase
            .storage
            .from('profile-photo')
            .getPublicUrl(e.profile_photo_path);
          avatar = urlData.publicUrl;
        }
        return {
          id: employee_id,
          name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
          avatar,
          isAdmin: is_admin,
        };
      });
      setParticipants(list);

      const taken = list.map(p => p.id).join(',');
      const { data: avail, error: availErr } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name')
        .not('employee_id', 'in', `(${taken})`);
      if (availErr) {
        console.error('Error loading available employees:', availErr);
        return;
      }
      setAvailableEmployees(avail);
    })();
  }, [showMembers, rid]);

  // ── 6️⃣ Admin/member actions ───────────────────────────────────────────────────
  const isCurrentAdmin = participants.some(p => p.id === currentEmployee.employee_id && p.isAdmin);

  const saveGroupName = async () => {
    await supabase.from('chat_rooms').update({ name: groupName.trim() }).eq('id', rid);
    setEditingName(false);
  };

  const addMember = async () => {
    if (!newMemberId) return;
    await supabase.from('chat_room_participants').insert({
      room_id: rid,
      employee_id: newMemberId,
      is_admin: false
    });
    setNewMemberId(null);
    setShowMembers(false);
    setTimeout(() => setShowMembers(true), 0);
  };

  const removeMember = async (empId) => {
    await supabase
      .from('chat_room_participants')
      .delete()
      .eq('room_id', rid)
      .eq('employee_id', empId);
    setShowMembers(false);
    setTimeout(() => setShowMembers(true), 0);
  };

  const toggleAdmin = async (empId, makeAdmin) => {
    await supabase
      .from('chat_room_participants')
      .update({ is_admin: makeAdmin })
      .eq('room_id', rid)
      .eq('employee_id', empId);
    setShowMembers(false);
    setTimeout(() => setShowMembers(true), 0);
  };

  // ── 7️⃣ Leave group (and clean up if empty) ────────────────────────────────────
  const leaveGroup = async () => {
    // remove this user
    await supabase
      .from('chat_room_participants')
      .delete()
      .eq('room_id', rid)
      .eq('employee_id', currentEmployee.employee_id);

    // check if any participants remain
    const { count } = await supabase
      .from('chat_room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', rid);

    if (count === 0) {
      // delete all related messages
      await supabase
        .from('messages')
        .delete()
        .eq('chat_room_id', rid);
      // delete any leftover participants (should be none)
      await supabase
        .from('chat_room_participants')
        .delete()
        .eq('room_id', rid);
      // delete the room
      await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', rid);
    }

    navigate('/chat');
  };

  // ── 8️⃣ Delete group entirely ──────────────────────────────────────────────────
  const deleteGroup = async () => {
    // remove participants
    await supabase.from('chat_room_participants').delete().eq('room_id', rid);
    // remove messages
    await supabase.from('messages').delete().eq('chat_room_id', rid);
    // remove room
    await supabase.from('chat_rooms').delete().eq('id', rid);
    navigate('/chat');
  };

  if (loading) return <div className="p-4 text-center">Loading chat…</div>;

  return (
    <>
      <div className="flex flex-col h-96 border rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 font-semibold text-lg flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/chat')}
              className="text-blue-600 hover:underline"
            >
              ← Back
            </button>
            {editingName && isCurrentAdmin ? (
              <>
                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="border px-2"
                />
                <button onClick={saveGroupName} className="text-blue-600">Save</button>
                <button
                  onClick={() => { setGroupName(roomName); setEditingName(false); }}
                  className="text-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : (
              <span>{groupName}</span>
            )}
          </div>

          {/* Options */}
          <div className="relative" ref={optionsRef}>
            <button
              onClick={() => setShowOptions(v => !v)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Options ▾
            </button>
            {showOptions && (
              <ul className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-10">
                {isCurrentAdmin && !editingName && (
                  <li>
                    <button
                      onClick={() => { setEditingName(true); setShowOptions(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Edit Name
                    </button>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => { setShowMembers(true); setShowOptions(false); }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    View Members
                  </button>
                </li>
                <li>
                  <button
                    onClick={leaveGroup}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                  >
                    Leave Group
                  </button>
                </li>
                {isCurrentAdmin && (
                  <li>
                    <button
                      onClick={deleteGroup}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                    >
                      Delete Group
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Messages */}
        <div id="group-chat-container" className="flex-1 overflow-y-auto p-4">
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
                    <div className={`flex items-start space-x-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="h-8 w-8 rounded-full"
                        style={{ marginTop: '2px' }}
                      />
                      <div className={`${isOwn ? 'mr-2 text-right' : 'ml-2 text-left'}`} style={{ maxWidth: '75%' }}>
                        <div className="text-xs font-semibold text-gray-700">{msg.senderName}</div>
                        <div className={`mt-1 inline-block px-4 py-2 rounded-lg shadow text-sm ${
                          isOwn ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {msg.text}
                        </div>
                        <div className="text-[10px] mt-1 opacity-60 text-right">
                          {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            onKeyDown={e => e.key==='Enter' && sendMessage()}
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
          <div className="bg-white rounded-lg shadow-lg w-96 max-h-[80vh] overflow-auto p-4">
            <h3 className="text-lg font-semibold mb-3">Group Members</h3>
            {isCurrentAdmin && (
              <div className="mb-4">
                <select
                  value={newMemberId || ''}
                  onChange={e => setNewMemberId(Number(e.target.value))}
                  className="border p-2 w-full rounded"
                >
                  <option value="" disabled>Add a member…</option>
                  {availableEmployees.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.first_name} {e.last_name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addMember}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Add
                </button>
              </div>
            )}
            <ul className="space-y-2">
              {participants.map(p => (
                <li key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img src={p.avatar} alt={p.name} className="h-8 w-8 rounded-full" />
                    <span className="text-sm">
                      {p.name} {p.isAdmin && <em className="text-xs text-green-600">(admin)</em>}
                    </span>
                  </div>
                  {isCurrentAdmin && p.id!==currentEmployee.employee_id && (
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => toggleAdmin(p.id, !p.isAdmin)} className="text-blue-600 hover:underline">
                        {p.isAdmin ? 'Revoke' : 'Make'} Admin
                      </button>
                      <button onClick={() => removeMember(p.id)} className="text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                  )}
                  {p.id===currentEmployee.employee_id && (
                    <button onClick={leaveGroup} className="text-red-600 text-xs hover:underline">
                      Leave
                    </button>
                  )}
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

export default GroupChatRoom;
