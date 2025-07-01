// src/pages/ChatPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";

const ChatPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // employee & store info
  const [employee, setEmployee] = useState(null);
  const [storeName, setStoreName] = useState("");
  const [allEmployees, setAllEmployees] = useState([]);

  // chat room lists
  const [groupChats, setGroupChats] = useState([]);     // store + custom groups
  const [privateChats, setPrivateChats] = useState([]); // { roomId, name }[]

  // UI state
  const [mode, setMode] = useState("group");
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewPrivateModal, setShowNewPrivateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupParticipants, setSelectedGroupParticipants] = useState([]);
  const [selectedPrivateParticipant, setSelectedPrivateParticipant] = useState(null);

  // 1️⃣ Load current employee, storeName, and coworkers
  useEffect(() => {
    (async () => {
      if (!user?.id) return;

      // a) fetch employee record
      const { data: emp } = await supabase
        .from("employee")
        .select("employee_id, store_id")
        .eq("id", user.id)
        .single();
      setEmployee(emp);

      // b) fetch store name
      const { data: storeRec } = await supabase
        .from("store")
        .select("store_name")
        .eq("store_id", emp.store_id)
        .single();
      setStoreName(storeRec?.store_name || `Store ${emp.store_id}`);

      // c) fetch coworkers
      const { data: others } = await supabase
        .from("employee")
        .select("employee_id, first_name, last_name, email")
        .neq("employee_id", emp.employee_id);
      setAllEmployees(others || []);
    })();
  }, [user]);

  // 2️⃣ Ensure default **store** room exists, upsert this user, then fetch **all** their rooms
  useEffect(() => {
    if (!employee || !storeName) return;

    (async () => {
      // a) find-or-create the store chat room
      let { data: storeRoom } = await supabase
        .from("chat_rooms")
        .select("id, type, name")
        .eq("type", "store")
        .eq("store_id", employee.store_id)
        .maybeSingle();

      if (!storeRoom) {
        const { data: created } = await supabase
          .from("chat_rooms")
          .insert([{
            type: "store",
            store_id: employee.store_id,
            name: storeName
          }])
          .select("id, type, name")
          .single();
        storeRoom = created;
      }

      // b) make sure this employee is a participant
      await supabase
        .from("chat_room_participants")
        .upsert(
          { room_id: storeRoom.id, employee_id: employee.employee_id },
          { onConflict: ["room_id", "employee_id"] }
        );

      // c) now fetch **all** rooms this user is in
      const { data: parts } = await supabase
        .from("chat_room_participants")
        .select("chat_rooms(id, type, name)")
        .eq("employee_id", employee.employee_id);

      const rooms = parts.map(p => p.chat_rooms);

      // split store vs custom groups
      const store = rooms.find(r => r.type === "store");
      const custom = rooms.filter(r => r.type === "group");
      setGroupChats([...(store ? [store] : []), ...custom]);

      // private chats: find all private rooms and grab the **other** participant’s name
      const privIds = rooms.filter(r => r.type === "private").map(r => r.id);
      if (privIds.length) {
        const { data: otherParts } = await supabase
          .from("chat_room_participants")
          .select("room_id, employee(first_name, last_name)")
          .in("room_id", privIds)
          .neq("employee_id", employee.employee_id);

        const namesByRoom = {};
        otherParts.forEach(({ room_id, employee }) => {
          namesByRoom[room_id] = `${employee.first_name} ${employee.last_name}`;
        });

        setPrivateChats(
          privIds.map(id => ({ roomId: id, name: namesByRoom[id] }))
        );
      } else {
        setPrivateChats([]);
      }
    })();
  }, [employee, storeName]);

  const openChat = (roomId) => navigate(`/chat/room/${roomId}`);

  // 3️⃣ Create new group chat (creator marked admin)
  const createGroupChat = async () => {
    if (!newGroupName.trim() || selectedGroupParticipants.length === 0) return;

    const { data: newRoom } = await supabase
      .from("chat_rooms")
      .insert([{ type: "group", name: newGroupName.trim() }])
      .select("id")
      .single();

    // mark creator as admin, others as regular members
    const participants = [
      { room_id: newRoom.id, employee_id: employee.employee_id, is_admin: true },
      ...selectedGroupParticipants.map(id => ({
        room_id: newRoom.id,
        employee_id: id,
        is_admin: false
      }))
    ];

    await supabase
      .from("chat_room_participants")
      .upsert(participants, { onConflict: ["room_id","employee_id"] });

    setShowNewGroupModal(false);
    setNewGroupName("");
    setSelectedGroupParticipants([]);
    openChat(newRoom.id);
  };

  // 4️⃣ Create brand-new private chat
  const createPrivateChat = async () => {
    if (!selectedPrivateParticipant) return;
    const userA = employee.employee_id;
    const userB = selectedPrivateParticipant;

    const { data: newRoom } = await supabase
      .from("chat_rooms")
      .insert([{ type: "private" }])
      .select("id")
      .single();
    const roomId = newRoom.id;

    for (let pid of [userA, userB]) {
      await supabase
        .from("chat_room_participants")
        .upsert({ room_id: roomId, employee_id: pid }, { onConflict: ["room_id","employee_id"] });
    }

    setShowNewPrivateModal(false);
    setSelectedPrivateParticipant(null);
    openChat(roomId);
  };

  if (!employee) return <div className="p-6 text-center">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chats</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("group")}
          className={`px-4 py-2 rounded ${mode==="group" ? "bg-blue-600 text-white":"bg-gray-200"}`}
        >Group Chats</button>
        <button
          onClick={() => setMode("private")}
          className={`px-4 py-2 rounded ${mode==="private" ? "bg-blue-600 text-white":"bg-gray-200"}`}
        >Private Chats</button>
      </div>

      {/* Group Chats */}
      {mode==="group" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Groups</h2>
            <button
              onClick={()=>setShowNewGroupModal(true)}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >+ New Group</button>
          </div>
          <ul className="space-y-2">
            {groupChats.map(room => (
              <li
                key={room.id}
                onClick={()=>openChat(room.id)}
                className="cursor-pointer p-3 border rounded hover:bg-gray-50"
              >
                {room.type==="store" ? storeName : room.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Private Chats */}
      {mode==="private" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Chats</h2>
            <button
              onClick={()=>setShowNewPrivateModal(true)}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >+ New Chat</button>
          </div>
          <ul className="space-y-2">
            {privateChats.map(({roomId,name})=>(
              <li
                key={roomId}
                onClick={()=>openChat(roomId)}
                className="cursor-pointer p-3 border rounded hover:bg-gray-50"
              >{name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <CheckSquare className="mr-2 h-5 w-5 text-gray-600" /> Create New Group
            </h3>
            <input
              type="text"
              placeholder="Group Name"
              value={newGroupName}
              onChange={e=>setNewGroupName(e.target.value)}
              className="border p-2 w-full rounded mb-3"
            />
            <label className="flex items-center mb-2 text-sm font-medium">
              <CheckSquare className="mr-2 h-4 w-4 text-gray-600" /> Select Members
            </label>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {allEmployees.map(emp=>(
                <label key={emp.employee_id} className="flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-blue-600"
                    checked={selectedGroupParticipants.includes(emp.employee_id)}
                    onChange={e=>{
                      const id = emp.employee_id;
                      setSelectedGroupParticipants(prev=>
                        e.target.checked
                          ? [...prev,id]
                          : prev.filter(pid=>pid!==id)
                      );
                    }}
                  />
                  <span className="ml-2">{emp.first_name} {emp.last_name}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={()=>setShowNewGroupModal(false)}
                className="px-3 py-1 rounded border"
              >Cancel</button>
              <button
                onClick={createGroupChat}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >Create</button>
            </div>
          </div>
        </div>
      )}

      {/* New Private Modal */}
      {showNewPrivateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg w-80">
            <h3 className="text-lg font-semibold mb-3">New Direct Message</h3>
            <select
              value={selectedPrivateParticipant||""}
              onChange={e=>setSelectedPrivateParticipant(Number(e.target.value))}
              className="border p-2 w-full rounded mb-4"
            >
              <option value="" disabled>Select a user...</option>
              {allEmployees.map(emp=>(
                <option key={emp.employee_id} value={emp.employee_id}>
                  {emp.first_name} {emp.last_name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={()=>setShowNewPrivateModal(false)}
                className="px-3 py-1 rounded border"
              >Cancel</button>
              <button
                onClick={createPrivateChat}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >Start</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
