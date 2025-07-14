// src/components/Chat/GroupChatRoom.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../supabaseClient';
import {
  loadMessages as loadEncryptedMessages,
  sendMessage as sendEncryptedMessage,
} from '../../utils/chatService';

const DEFAULT_AVATAR_URL =
  'https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg';

export default function GroupChatRoom({ roomId: rid, currentEmployee, roomName }) {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  // Messages
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg]     = useState('');
  const [loading, setLoading]   = useState(true);

  // Participants & admin
  const [participants, setParticipants]             = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [showMembers, setShowMembers]               = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState([]);
  const [showAddForm, setShowAddForm]               = useState(false);
  const [memberSearch, setMemberSearch]             = useState('');

  // Group name editing
  const [groupName, setGroupName]     = useState(roomName);
  const [editingName, setEditingName] = useState(false);

  // Admin & options dropdown
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [showOptions, setShowOptions]   = useState(false);
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

  // Determine if current user is admin
  useEffect(() => {
    if (!rid) return;
    (async () => {
      const { data } = await supabase
        .from('chat_room_participants')
        .select('is_admin')
        .eq('room_id', rid)
        .eq('employee_id', currentEmployee.employee_id)
        .single();
      if (data) setIsGroupAdmin(data.is_admin);
    })();
  }, [rid, currentEmployee.employee_id]);

  // Load & decrypt messages, subscribe real-time
  useEffect(() => {
    if (!rid) return;
    const load = async () => {
      setLoading(true);
      // 1️⃣ decrypt messages
      const decrypted = await loadEncryptedMessages(rid);

      // 2️⃣ bulk-fetch sender info
      const ids = [...new Set(decrypted.map(m => m.senderId))];
      const { data: emps } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path')
        .in('employee_id', ids);

      const map = {};
      emps.forEach(e => {
        const avatar = e.profile_photo_path
          ? supabase.storage.from('profile-photo').getPublicUrl(e.profile_photo_path).data.publicUrl
          : DEFAULT_AVATAR_URL;
        map[e.employee_id] = {
          name: `${e.first_name} ${e.last_name}`.trim(),
          avatar,
        };
      });

      // 3️⃣ build UI-ready message list
      const ui = decrypted.map(m => {
        const info = map[m.senderId] || { name: 'Unknown', avatar: DEFAULT_AVATAR_URL };
        return {
          id:          m.id,
          text:        m.text,
          ts:          m.sentAt,
          senderId:    m.senderId,
          senderName:  info.name,
          senderAvatar: info.avatar,
        };
      });

      setMessages(ui);
      setLoading(false);

      // mark as read
      await supabase
        .from('chat_room_participants')
        .update({ last_read: new Date().toISOString() })
        .eq('room_id', rid)
        .eq('employee_id', currentEmployee.employee_id);

      queryClient.invalidateQueries(['rooms', currentEmployee.employee_id]);
    };

    load();
    const channel = supabase
      .channel(`group-${rid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_room_id=eq.${rid}` },
        load
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [rid, currentEmployee.employee_id, queryClient]);

  // Auto-scroll when messages change
  useEffect(() => {
    const c = document.getElementById('group-chat-container');
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  // Send encrypted message
  const handleSend = async () => {
    if (!newMsg.trim() || !rid) return;
    await sendEncryptedMessage(rid, newMsg.trim(), currentEmployee.employee_id);
    setNewMsg('');
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    return Object.entries(
      messages.reduce((acc, msg) => {
        const key = new Date(msg.ts).toLocaleDateString(undefined, {
          month: 'long', day: 'numeric', year: 'numeric',
        });
        (acc[key] = acc[key] || []).push(msg);
        return acc;
      }, {})
    );
  }, [messages]);

  // Load participants & available employees for “View Members”
  useEffect(() => {
    if (!showMembers || !rid) return;
    (async () => {
      const { data: parts } = await supabase
        .from('chat_room_participants')
        .select(`
          employee_id,
          is_admin,
          employee!inner(
            first_name,
            last_name,
            profile_photo_path
          )
        `)
        .eq('room_id', rid);

      const list = parts.map(p => {
        const emp = p.employee;
        const path = emp.profile_photo_path;
        const avatar = path
          ? supabase.storage.from('profile-photo').getPublicUrl(path).data.publicUrl
          : DEFAULT_AVATAR_URL;
        return {
          id: p.employee_id,
          name: `${emp.first_name} ${emp.last_name}`.trim(),
          avatar,
          isAdmin: p.is_admin,
        };
      });
      setParticipants(list);

      const taken = list.map(p => p.id).join(',');
      const { data: avail } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path')
        .not('employee_id', 'in', `(${taken})`);

      setAvailableEmployees(
        avail.map(e => {
          const path = e.profile_photo_path;
          return {
            employee_id: e.employee_id,
            first_name: e.first_name,
            last_name: e.last_name,
            avatar: path
              ? supabase.storage.from('profile-photo').getPublicUrl(path).data.publicUrl
              : DEFAULT_AVATAR_URL,
          };
        })
      );
    })();
  }, [showMembers, rid]);

  // Persist changes
  const saveGroupName = async () => {
    await supabase.from('chat_rooms').update({ name: groupName.trim() }).eq('id', rid);
    setEditingName(false);
  };

  const addMember = async () => {
    if (!selectedNewMembers.length) return;
    await supabase.from('chat_room_participants').insert(
      selectedNewMembers.map(id => ({ room_id: rid, employee_id: id }))
    );
    setSelectedNewMembers([]);
    setShowAddForm(false);
    setShowMembers(true);
  };

  const toggleAdmin = async (empId, makeAdmin) => {
    await supabase
      .from('chat_room_participants')
      .update({ is_admin: makeAdmin })
      .eq('room_id', rid)
      .eq('employee_id', empId);
    setParticipants(prev =>
      prev.map(p => (p.id === empId ? { ...p, isAdmin: makeAdmin } : p))
    );
    if (empId === currentEmployee.employee_id) {
      setIsGroupAdmin(makeAdmin);
    }
  };

  const removeMember = async empId => {
    await supabase
      .from('chat_room_participants')
      .delete()
      .eq('room_id', rid)
      .eq('employee_id', empId);
    setParticipants(prev => prev.filter(p => p.id !== empId));
  };

  const leaveGroup = async () => {
    await supabase
      .from('chat_room_participants')
      .delete()
      .eq('room_id', rid)
      .eq('employee_id', currentEmployee.employee_id);
    navigate('/chat?mode=group');
  };

  const deleteGroup = async () => {
    await supabase.from('chat_room_participants').delete().eq('room_id', rid);
    await supabase.from('messages').delete().eq('chat_room_id', rid);
    await supabase.from('chat_rooms').delete().eq('id', rid);
    navigate('/chat?mode=group');
  };

  if (loading) return <div className="p-4 text-center">Loading chat…</div>;

  return (
    <>
      {/* Chat Box */}
      <div className="flex flex-col h-96 w-[80vw] max-w-3xl mx-auto border rounded-lg shadow-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/chat?mode=group')}
              className="text-blue-600 hover:underline"
            >
              ← Back
            </button>
            {editingName && isGroupAdmin ? (
              <>
                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="border px-2"
                />
                <button onClick={saveGroupName} className="text-blue-600">
                  Save
                </button>
                <button
                  onClick={() => {
                    setGroupName(roomName);
                    setEditingName(false);
                  }}
                  className="text-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : (
              <span className="font-semibold text-lg">{groupName}</span>
            )}
          </div>

          {/* Options dropdown */}
          <div className="relative" ref={optionsRef}>
            <button
              onClick={() => setShowOptions(v => !v)}
              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            >
              Options ▾
            </button>
            {showOptions && (
              <ul className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-10">
                {isGroupAdmin && !editingName && (
                  <li>
                    <button
                      onClick={() => {
                        setEditingName(true);
                        setShowOptions(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      Edit Name
                    </button>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => {
                      setShowMembers(true);
                      setShowAddForm(false);
                      setShowOptions(false);
                    }}
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
                {isGroupAdmin && (
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
                    <div
                      className={`flex items-start space-x-2 ${
                        isOwn ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="h-8 w-8 rounded-full"
                        style={{ marginTop: 2 }}
                      />
                      <div
                        className={`${
                          isOwn ? 'mr-2 text-right' : 'ml-2 text-left'
                        }`}
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
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
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
            <h3 className="text-lg font-semibold mb-3 flex justify-between items-center">
              Group Members
              {isGroupAdmin && (
                <button
                  onClick={() => setShowAddForm(v => !v)}
                  className="bg-green-600 text-white px-2 py-1 rounded text-sm"
                >
                  {showAddForm ? 'Cancel' : 'Add Employee'}
                </button>
              )}
            </h3>

            {showAddForm && isGroupAdmin && (
              <div className="mb-4 border-t pt-4">
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="border p-2 w-full rounded mb-2"
                />
                <div className="max-h-32 overflow-y-auto space-y-2 border p-2 rounded">
                  {availableEmployees
                    .filter(emp =>
                      `${emp.first_name} ${emp.last_name}`
                        .toLowerCase()
                        .includes(memberSearch.toLowerCase())
                    )
                    .map(emp => (
                      <label key={emp.employee_id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedNewMembers.includes(emp.employee_id)}
                          onChange={e => {
                            const id = emp.employee_id;
                            setSelectedNewMembers(prev =>
                              e.target.checked
                                ? [...prev, id]
                                : prev.filter(x => x !== id)
                            );
                          }}
                          className="form-checkbox"
                        />
                        <img
                          src={emp.avatar}
                          alt={`${emp.first_name} ${emp.last_name}`}
                          className="h-6 w-6 rounded-full"
                        />
                        <span>
                          {emp.first_name} {emp.last_name}
                        </span>
                      </label>
                    ))}
                </div>
                <button
                  onClick={addMember}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white rounded"
                >
                  Add Selected
                </button>
              </div>
            )}

            <ul className="space-y-2">
              {participants.map(p => (
                <li key={p.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img src={p.avatar} alt={p.name} className="h-8 w-8 rounded-full" />
                    <span className="text-sm">
                      {p.name}{' '}
                      {p.isAdmin && <em className="text-xs text-green-600">(admin)</em>}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {isGroupAdmin && p.id !== currentEmployee.employee_id && (
                      <>
                        <button
                          onClick={() => toggleAdmin(p.id, !p.isAdmin)}
                          className="text-blue-600 hover:underline"
                        >
                          {p.isAdmin ? 'Revoke' : 'Make'} Admin
                        </button>
                        <button
                          onClick={() => removeMember(p.id)}
                          className="text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </>
                    )}
                    {p.id === currentEmployee.employee_id && (
                      <button
                        onClick={leaveGroup}
                        className="text-red-600 hover:underline text-xs"
                      >
                        Leave
                      </button>
                    )}
                  </div>
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
}
