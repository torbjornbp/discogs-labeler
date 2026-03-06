export default function SortIcon({ active, dir }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", marginLeft: 4, gap: 1, opacity: active ? 1 : 0.25, verticalAlign: "middle" }}>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="none">
        <path d="M3.5 0L7 4H0L3.5 0Z" fill={active && dir === "asc" ? "#1a6ef5" : "#999"} />
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="none">
        <path d="M3.5 4L0 0H7L3.5 4Z" fill={active && dir === "desc" ? "#1a6ef5" : "#999"} />
      </svg>
    </span>
  );
}
