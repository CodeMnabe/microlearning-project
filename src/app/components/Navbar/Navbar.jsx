import Link from "next/link";
import styles from "./navbar.module.css";

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.logo}>
        <Link href="/">Home</Link>
      </div>
      <ul className={styles.navLinks}>
        <li>
          <Link href="/users">Users</Link>
        </li>
        <li>
          <Link href="/assistants">Assistants</Link>
        </li>
        <li>
          <Link href="/admin">Admin</Link>
        </li>
      </ul>
    </nav>
  );
}
