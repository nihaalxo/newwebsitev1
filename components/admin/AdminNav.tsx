// Plain links rather than <Link>: each is a full page load, so an editor with unsaved changes can ask first.

export default function AdminNav() {
  return (
    <nav className="adm-nav" aria-label="Admin">
      <a href="/admin">Projects</a>
      <a href="/" target="_blank" rel="noopener">
        View site<span className="adm-vh"> (opens in a new tab)</span>
      </a>
    </nav>
  );
}
