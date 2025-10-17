import styles from "./users.module.css";

export default function UserList({ users, onUserClick }) {
  if (!users || users.length === 0) {
    return <p>No users found.</p>;
  }

  return (
    <>
      {users.map((user) => (
        <div
          className={styles.card}
          key={user.id}
          onClick={() => onUserClick(user.id)}
        >
          <p>{user.name}</p>
        </div>
      ))}
    </>
  );
}
