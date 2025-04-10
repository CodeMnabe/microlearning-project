"use client";
import { useState, useEffect } from "react";
import styles from "./users.module.css";

import UserList from "./UserList";
import UserPage from "./UserPage";
import MessageList from "./MessagesList";
import CreateUserModal from "./CreateUser";
import { useGlobalLoader } from "../LoadingScreen/GlobalLoaderContext";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("name");
  const [threads, setThreads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [msgFilterType, setMsgFilterType] = useState("words");
  const [msgSearchTerm, setMsgSearchTerm] = useState("");
  const [msgStartDate, setMsgStartDate] = useState("");
  const [msgEndDate, setMsgEndDate] = useState("");

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedThreadId, setSelectedThreadId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const { startLoading, stopLoading } = useGlobalLoader();

  useEffect(() => {
    startLoading();
    async function fetchData() {
      try {
        const res = await fetch(`/api/users?orgId=${1}`);
        const users = await res.json();
        setUsers(users);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        stopLoading();
      }
    }

    fetchData();
  }, [startLoading, stopLoading]);

  useEffect(() => {
    async function fetchMessages() {
      if (!selectedThreadId) {
        // If no thread selected, clear out messages
        setMessages([]);
        return;
      }
      try {
        const res = await fetch(`/api/messages?threadId=${selectedThreadId}`);
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    }
    fetchMessages();
  }, [selectedThreadId]);

  async function handleUserClick(userId) {
    setSelectedUserId(userId);
    setSelectedThreadId(null);

    try {
      const res = await fetch(`/api/threads?userId=${userId}`);

      if (!res.ok) {
        console.error("Request failed with status:", res.status);
        return;
      }

      const data = await res.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error("Error fetching threads:", error);
    }
  }

  function handleThreadClick(threadId) {
    setSelectedThreadId(threadId);
  }

  const handleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  async function handleCreateUser({ userName, phoneNumber }) {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        organizationId: 1,
        phoneNumber: phoneNumber,
        name: userName,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error(`Error creating user: ${err.error}`);
      return;
    }

    const data = await res.json();

    // Optional: refresh users list
    const updatedUsers = await fetch(`/api/users?orgId=${1}`).then((r) =>
      r.json()
    );
    setUsers(updatedUsers);
    setIsModalOpen(false);
  }

  const filteredUsers = users.filter((user) => {
    if (filterType === "name") {
      return user.name.toLowerCase().includes(searchTerm.toLowerCase());
    } else if (filterType === "phone") {
      return user.phoneNumber.includes(searchTerm);
    }
    return true;
  });

  const filteredMessages = messages.filter((msg) => {
    if (msgFilterType === "words") {
      return msg.content.toLowerCase().includes(msgSearchTerm.toLowerCase());
    } else if (msgFilterType === "date") {
      if (!msgStartDate || !msgEndDate) {
        // If either date is missing, show all messages or skip filtering
        return true;
      }
      const msgDate = new Date(msg.createdAt);
      const start = new Date(msgStartDate);
      const end = new Date(msgEndDate);

      // Return true if msgDate is between start and end (inclusive)
      return msgDate >= start && msgDate <= end;
    }
    return true; // fallback, should never happen
  });

  return (
    <div className={`${styles.row} ${styles.mainContent}`}>
      <div className={`${styles.column}`}>
        <h2>Utilizadores</h2>
        <div className={styles.combinedSearch}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="name">Nome</option>
            <option value="phone">Número</option>
          </select>

          <div className={styles.divider}></div>

          <input
            type="text"
            placeholder={`Filtrar por ${
              filterType === "name" ? "nome" : "número"
            }`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <UserList users={filteredUsers} onUserClick={handleUserClick} />
      </div>

      <div className={`${styles.column}`}>
        <h2>Utilizador</h2>

        {/* //TODO: Fazer filtro para threads por assistente */}
        <UserPage
          user={users.find((u) => u.id === selectedUserId)}
          threads={threads}
          onThreadClick={handleThreadClick}
          onUserUpdated={(updatedUser) => {
            // Replace old user in local state
            setUsers((prev) =>
              prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
            );
          }}
          onUserDeleted={(deletedUserId) => {
            // Filter out the deleted user
            setUsers((prev) => prev.filter((u) => u.id !== deletedUserId));
            // If you just deleted the selected user, clear them from the UI
            if (deletedUserId === selectedUserId) {
              setSelectedUserId(null);
              setThreads([]);
            }
          }}
        />
      </div>

      <div className={`${styles.column}`}>
        <h2>Mensagens</h2>
        <div className={styles.messageFilterBar}>
          <select
            value={msgFilterType}
            onChange={(e) => setMsgFilterType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="words">Palavras</option>
            <option value="date">Data</option>
          </select>

          <div className={styles.divider}></div>

          {msgFilterType === "words" ? (
            <input
              type="text"
              placeholder="Filtrar mensagens por conteúdo..."
              value={msgSearchTerm}
              onChange={(e) => setMsgSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          ) : (
            <div className={styles.dateRange}>
              <input
                type="date"
                value={msgStartDate}
                onChange={(e) => setMsgStartDate(e.target.value)}
                className={styles.dateInput}
              />
              <span className={styles.dateRangeDash}>—</span>
              <input
                type="date"
                value={msgEndDate}
                onChange={(e) => setMsgEndDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
          )}
        </div>

        <MessageList messages={filteredMessages} />
      </div>

      <button className={styles.floatingButton} onClick={handleModal}>
        +
      </button>

      <CreateUserModal
        isOpen={isModalOpen}
        onClose={handleModal}
        onCreateUser={handleCreateUser}
      />
    </div>
  );
}
