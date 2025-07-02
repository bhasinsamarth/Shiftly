// src/pages/ChatPage.jsx
import React, {
  useEffect,
  useState,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_AVATAR_URL =
  "https://naenzjlyvbjodvdjnnbr.supabase.co/storage/v1/object/public/profile-photo/matthew-blank-profile-photo-2.jpg";

// Lazy imports for the modals
const NewGroupModal = lazy(() =>
  import("../components/Chat/NewGroupModal.jsx")
);
const NewPrivateModal = lazy(() =>
  import("../components/Chat/NewPrivateModal.jsx")
);


// React Query hook for fetching and caching rooms
function useRooms(employee) {
  return useQuery({
    queryKey: ["rooms", employee.employee_id],
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("chat_room_participants")
        .select("chat_rooms(id, type, name)")
        .eq("employee_id", employee.employee_id);

      const rooms = parts.map((p) => p.chat_rooms);
      const store = rooms.find((r) => r.type === "store");
      const groups = rooms.filter((r) => r.type === "group");
      const groupChats = [...(store ? [store] : []), ...groups];

      const privIds = rooms
        .filter((r) => r.type === "private")
        .map((r) => r.id);

      let privateChats = [];
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
        privateChats = privIds.map((id) => ({
          roomId: id,
          name: namesByRoom[id],
        }));
      }

      return { groupChats, privateChats };
    },
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 60, // 1 hour
  });
}

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();

  // employee & coworker state
  const [employee, setEmployee] = useState(null);
  const [storeName, setStoreName] = useState("");
  const [allEmployees, setAllEmployees] = useState([]);

  // load current employee, storeName, coworkers
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: idRec } = await supabase
        .from("employee")
        .select("employee_id, store_id")
        .eq("id", user.id)
        .single();
      if (!idRec) return;
      const empId = idRec.employee_id;
      const storeId = idRec.store_id;

      const [empRes, storeRes, coworkersRes] = await Promise.all([
        supabase
          .from("employee")
          .select("employee_id, store_id, profile_photo_path")
          .eq("id", user.id)
          .single(),
        supabase
          .from("store")
          .select("store_name")
          .eq("store_id", storeId)
          .single(),
        supabase
          .from("employee")
          .select(
            "employee_id, first_name, last_name, email, profile_photo_path"
          )
          .neq("employee_id", empId),
      ]);

      if (empRes.data) setEmployee(empRes.data);
      setStoreName(storeRes.data?.store_name || `Store ${storeId}`);

      setAllEmployees(
        (coworkersRes.data || []).map((e) => ({
          ...e,
          avatar: e.profile_photo_path
            ? supabase
                .storage
                .from("profile-photo")
                .getPublicUrl(e.profile_photo_path)
                .data.publicUrl
            : DEFAULT_AVATAR_URL,
        }))
      );
    })();
  }, [user]);

  // once employee exists, ensure store-room & participant
  useEffect(() => {
    if (!employee) return;
    (async () => {
      const { store_id, employee_id } = employee;
      const { data: storeRec } = await supabase
        .from("store")
        .select("store_name")
        .eq("store_id", store_id)
        .single();
      const name = storeRec?.store_name || `Store ${store_id}`;
      setStoreName(name);

      let { data: storeRoom } = await supabase
        .from("chat_rooms")
        .select("id, type, name")
        .eq("type", "store")
        .eq("store_id", store_id)
        .maybeSingle();
      if (!storeRoom) {
        const { data: created } = await supabase
          .from("chat_rooms")
          .insert([{ type: "store", store_id, name }])
          .select("id, type, name")
          .single();
        storeRoom = created;
      }

      await supabase
        .from("chat_room_participants")
        .upsert(
          { room_id: storeRoom.id, employee_id },
          { onConflict: ["room_id", "employee_id"] }
        );
    })();
  }, [employee]);

  // use React Query to get your group/private chats
  const {
    data: roomData,
    isLoading: roomsLoading,
  } = useRooms(employee || { employee_id: null });

  // UI state for modals, tabs, form inputs
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const initialMode =
    params.get("mode") === "private" ? "private" : "group";
  const [mode, setMode] = useState(initialMode);

  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewPrivateModal, setShowNewPrivateModal] =
    useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupParticipants, setSelectedGroupParticipants] =
    useState([]);
  const [selectedPrivateParticipant, setSelectedPrivateParticipant] =
    useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupError, setGroupError] = useState("");

  // filter coworkers
  const filteredEmployees = useMemo(
    () =>
      allEmployees.filter((emp) =>
        `${emp.first_name} ${emp.last_name}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      ),
    [allEmployees, searchQuery]
  );

  // helpers
  const switchMode = (newMode) => {
    setMode(newMode);
    navigate(`/chat?mode=${newMode}`, { replace: true });
  };
  const openChat = (roomId) =>
    navigate(`/chat/room/${roomId}?mode=${mode}`);

  // create group chat
  const createGroupChat = async () => {
    if (!newGroupName.trim()) {
      setGroupError("Group name is required.");
      return;
    }
    if (selectedGroupParticipants.length === 0) {
      setGroupError("Select at least one member.");
      return;
    }
    setGroupError("");

    const { data: newRoom } = await supabase
      .from("chat_rooms")
      .insert([{ type: "group", name: newGroupName.trim() }])
      .select("id")
      .single();

    const participants = [
      {
        room_id: newRoom.id,
        employee_id: employee.employee_id,
        is_admin: true,
      },
      ...selectedGroupParticipants.map((id) => ({
        room_id: newRoom.id,
        employee_id: id,
        is_admin: false,
      })),
    ];

    await supabase
      .from("chat_room_participants")
      .upsert(participants, {
        onConflict: ["room_id", "employee_id"],
      });

    setShowNewGroupModal(false);
    setNewGroupName("");
    setSelectedGroupParticipants([]);
    openChat(newRoom.id);
  };

  // create private chat
  const createPrivateChat = async () => {
    if (!selectedPrivateParticipant) return;
    const userA = employee.employee_id;
    const userB = selectedPrivateParticipant;

    const { data: newRoom } = await supabase
      .from("chat_rooms")
      .insert([{ type: "private" }])
      .select("id")
      .single();

    await Promise.all(
      [userA, userB].map((pid) =>
        supabase
          .from("chat_room_participants")
          .upsert(
            { room_id: newRoom.id, employee_id: pid },
            { onConflict: ["room_id", "employee_id"] }
          )
      )
    );

    setShowNewPrivateModal(false);
    setSelectedPrivateParticipant(null);
    openChat(newRoom.id);
  };

  if (!employee || roomsLoading) {
    return <div className="p-6 text-center">Loading…</div>;
  }

  const { groupChats, privateChats } = roomData;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Chats</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => switchMode("group")}
          className={`px-4 py-2 rounded ${
            mode === "group"
              ? "bg-blue-600 text-white"
              : "bg-gray-200"
          }`}
        >
          Group Chats
        </button>
        <button
          onClick={() => switchMode("private")}
          className={`px-4 py-2 rounded ${
            mode === "private"
              ? "bg-blue-600 text-white"
              : "bg-gray-200"
          }`}
        >
          Private Chats
        </button>
      </div>

      {/* Group Chats */}
      {mode === "group" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Groups</h2>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              + New Group
            </button>
          </div>
          <ul className="space-y-2">
            {groupChats.map((room) => (
              <li
                key={room.id}
                onClick={() => openChat(room.id)}
                className="cursor-pointer p-3 border rounded hover:bg-gray-50"
              >
                {room.type === "store" ? storeName : room.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Private Chats */}
      {mode === "private" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Your Chats</h2>
            <button
              onClick={() => setShowNewPrivateModal(true)}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              + New Chat
            </button>
          </div>
          <ul className="space-y-2">
            {privateChats.map(({ roomId, name }) => (
              <li
                key={roomId}
                onClick={() => openChat(roomId)}
                className="cursor-pointer p-3 border rounded hover:bg-gray-50"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lazy-loaded Modals */}
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center">
            Loading…
          </div>
        }
      >
        {showNewGroupModal && (
          <NewGroupModal
            allEmployees={filteredEmployees}
            onCreate={createGroupChat}
            onClose={() => {
              setShowNewGroupModal(false);
              setGroupError("");
            }}
            selected={selectedGroupParticipants}
            setSelected={setSelectedGroupParticipants}
            groupName={newGroupName}
            setGroupName={setNewGroupName}
            error={groupError}
          />
        )}
        {showNewPrivateModal && (
          <NewPrivateModal
            allEmployees={filteredEmployees}
            onCreate={createPrivateChat}
            onClose={() => setShowNewPrivateModal(false)}
            selected={selectedPrivateParticipant}
            setSelected={setSelectedPrivateParticipant}
          />
        )}
      </Suspense>
    </div>
  );
}
