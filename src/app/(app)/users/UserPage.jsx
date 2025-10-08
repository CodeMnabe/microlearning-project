import { useState, useEffect } from "react";
import styles from "./users.module.css";

export default function UserPage({
  user,
  threads,
  onThreadClick,
  onUserUpdated,
  onUserDeleted,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [editPhone, setEditPhone] = useState(user?.phone_number || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditPhone(user.phone_number);
    }
  }, [user]);

  if (!user) {
    return <p>Selecione um utilizador.</p>;
  }

  function handleEditClick() {
    setIsEditing(true);
  }

  async function handleSaveClick() {
    setIsSaving(true);
    try {
      console.log("Saving");
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: user.id,
          name: editName,
          phone_number: editPhone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Erro ao atualizar utilizador:", data.error);
        return;
      }

      setIsEditing(false);
      onUserUpdated(data.user); // Update parent state
    } catch (err) {
      console.error("Erro ao guardar:", err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteUserClick() {
    const confirmed = window.confirm(
      `Tem a certeza que quer eliminar o utilizador ${user.name}?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/users?id=${user.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Erro ao eliminar utilizador:", errorData.error);
        alert("Erro ao eliminar utilizador: " + errorData.error);
        return;
      }

      // Optionally, let parent know user was deleted so the UI can update
      alert(`Utilizador ${user.name} eliminado com sucesso`);
      // e.g., onUserDeleted(user.id) if you pass that down
      onUserDeleted?.(user.id);
    } catch (err) {
      console.error("Erro ao eliminar utilizador:", err);
      alert("Erro ao eliminar utilizador: " + err.message);
    }
  }

  return (
    <div>
      <div className={styles.card}>
        <p>
          <strong>ID:</strong> {user.id}
        </p>

        <p>
          <strong>Nome:</strong>{" "}
          {isEditing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          ) : (
            user.name
          )}
        </p>

        <p>
          <strong>Telefone:</strong>{" "}
          {isEditing ? (
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          ) : (
            user.phone_number
          )}
        </p>

        <p>
          <strong>Organização:</strong> {user.organizationId}
        </p>

        {isEditing ? (
          <button
            onClick={handleSaveClick}
            disabled={isSaving}
            className={styles.userButton}
          >
            {isSaving ? "A guardar..." : "Guardar"}
          </button>
        ) : (
          <button onClick={handleEditClick} className={styles.userButton}>
            Editar
          </button>
        )}
        <button
          onClick={handleDeleteUserClick}
          className={`${styles.userButton} ${styles.deleteButton}`}
        >
          Eliminar
        </button>
      </div>

      <h4 style={{ marginTop: "1rem" }}>Threads</h4>

      {threads.length === 0 ? (
        <p>Este utilizador não tem threads.</p>
      ) : (
        threads.map((thread) => (
          <div
            className={styles.card}
            key={thread.id}
            onClick={() => onThreadClick(thread.aiThreadId)}
          >
            <p>
              <strong>ID:</strong> {thread.id} <br />
              <strong>Thread ID:</strong> {thread.aiThreadId}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
