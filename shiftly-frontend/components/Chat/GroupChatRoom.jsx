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

  // Modal state for moderation alerts
  const [alertModalMsg, setAlertModalMsg] = useState('');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const openAlertModal = msg => {
    setAlertModalMsg(msg);
    setShowAlertModal(true);
  };

  // Subscribe to moderation events (content_safety_events INSERT)
  useEffect(() => {
    if (!currentEmployee?.employee_id) return;
    const channel = supabase
      .channel(`content_safety_events_group_${rid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content_safety_events',
          filter: `employee_id=eq.${currentEmployee.employee_id}`,
        },
        payload => {
          console.debug('[Moderation Event - GroupChatRoom]', payload);
          if (payload?.new?.reason) {
            openAlertModal(payload.new.reason);
          } else if (payload?.new?.error) {
            openAlertModal('A moderation event occurred.');
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentEmployee?.employee_id, rid]);

  // Load group members and available employees when members modal is opened
  useEffect(() => {
    if (!showMembers || !rid) return;
    (async () => {
      // Fetch participants
      const { data: partData } = await supabase
        .from('chat_room_participants')
        .select('employee_id, is_admin, employee(first_name, last_name, profile_photo_path)')
        .eq('room_id', rid);
      const participants = (partData || []).map(p => {
        const emp = p.employee;
        return {
          id: p.employee_id,
          name: `${emp.first_name} ${emp.last_name}`,
          avatar: emp.profile_photo_path
            ? supabase.storage.from('profile-photo').getPublicUrl(emp.profile_photo_path).data.publicUrl
            : DEFAULT_AVATAR_URL,
          isAdmin: p.is_admin,
        };
      });
      setParticipants(participants);

      // Fetch all employees not in group
      const groupIds = participants.map(p => p.id);
      const { data: allEmps } = await supabase
        .from('employee')
        .select('employee_id, first_name, last_name, profile_photo_path');
      const available = (allEmps || [])
        .filter(e => !groupIds.includes(e.employee_id))
        .map(e => ({
          employee_id: e.employee_id,
          first_name: e.first_name,
          last_name: e.last_name,
          avatar: e.profile_photo_path
            ? supabase.storage.from('profile-photo').getPublicUrl(e.profile_photo_path).data.publicUrl
            : DEFAULT_AVATAR_URL,
        }));
      setAvailableEmployees(available);
    })();
  }, [showMembers, rid]);

  if (loading) return <div className="p-4 text-center">Loading chat…</div>;

  return (
    <>
      {/* Moderation Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-[9999] flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            <h2 className="text-xl font-bold mb-4 text-red-700">Alert</h2>
            <p className="mb-6 text-gray-800">{alertModalMsg}</p>
            <button
              onClick={() => setShowAlertModal(false)}
              className="px-6 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Chat Box */}
      <div className="flex flex-col h-full w-full bg-white">
        {/* Header */}
        <div className="h-16 px-6 flex items-center border-b bg-white justify-between">
          <div className="flex items-center gap-4">
            {editingName && isGroupAdmin ? (
              <>
                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="border rounded px-2 py-1 text-base"
                />
                <button onClick={saveGroupName} className="text-blue-600 font-medium ml-2">Save</button>
                <button
                  onClick={() => {
                    setGroupName(roomName);
                    setEditingName(false);
                  }}
                  className="text-gray-600 ml-2"
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
              className="px-3 py-2 bg-gray-100 rounded-lg font-medium text-gray-700 hover:bg-gray-200"
            >
              Options ▾
            </button>
            {showOptions && (
              <ul className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-lg z-10 overflow-hidden">
                {isGroupAdmin && !editingName && (
                  <li>
                    <button
                      onClick={() => {
                        setEditingName(true);
                        setShowOptions(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-100"
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
                    className="w-full text-left px-4 py-3 hover:bg-gray-100"
                  >
                    View Members
                  </button>
                </li>
                <li>
                  <button
                    onClick={leaveGroup}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 text-red-600"
                  >
                    Leave Group
                  </button>
                </li>
                {isGroupAdmin && (
                  <li>
                    <button
                      onClick={deleteGroup}
                      className="w-full text-left px-4 py-3 hover:bg-gray-100 text-red-600"
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
        <div id="group-chat-container" className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
          {groupedMessages.map(([date, msgs]) => (
            <div key={date} className="space-y-4">
              <div className="text-center my-2 text-gray-400 text-xs font-medium">
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
                      className={`flex items-end gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      <img
                        src={msg.senderAvatar}
                        alt={msg.senderName}
                        className="h-8 w-8 rounded-full object-cover"
                        style={{ marginBottom: 2 }}
                      />
                      <div className={`max-w-lg ${isOwn ? 'text-right' : 'text-left'}`}>
                        <div className="text-xs font-medium text-gray-600 mb-1">
                          {msg.senderName}
                        </div>
                        <div
                          className={`inline-block px-3 py-2 rounded-lg text-sm ${
                            isOwn
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-800 border'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <div className="text-xs mt-1 text-gray-500">
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
