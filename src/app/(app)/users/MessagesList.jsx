import styles from "./users.module.css";

export default function MessageList({ messages }) {
  if (!messages || messages.length === 0) {
    return <p>No messages yet.</p>;
  }

  return (
    <>
      {messages.map((message) => (
        <p className={styles.card} key={message.id}>
          <strong>ID:</strong> {message.id} &nbsp;
          <strong>Sender:</strong> {message.role} &nbsp;
          <strong>Content:</strong> {message.content || "No Text Found!"}
        </p>
      ))}
    </>
  );
}
