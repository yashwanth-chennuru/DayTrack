import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { AuthProvider, useAuth } from "./AuthProvider";
import LoginScreen from "./LoginScreen";
import { useFirestoreItems } from "./hooks/useFirestoreItems";

interface Item {
  id: string;
  text: string;
  done: boolean;
  deadline?: string;
}

function formatTime(time24: string) {
  const [h, m] = time24.split(":");
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
}

function isOverdue(time24: string, itemDate: Date) {
  if (!isToday(itemDate)) return false;
  const [h, m] = time24.split(":");
  const now = new Date();
  const deadlineDate = new Date();
  deadlineDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  return now > deadlineDate;
}

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// Custom cross-browser TimePicker (no native <input type="time">)
function TimePicker({ value, onChange, accent }: { value: string; onChange: (v: string) => void; accent: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  // Parse current value (24h "HH:MM") into hour12, minute, period
  const parsed = value ? value.split(":") : null;
  let hour12 = parsed ? parseInt(parsed[0], 10) : 12;
  let period = parsed ? (hour12 >= 12 ? "PM" : "AM") : "AM";
  let minute = parsed ? parsed[1] : "00";
  if (parsed) {
    hour12 = hour12 % 12 || 12;
  }

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.top - 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  // Close popup when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function update(h12: number, min: string, p: string) {
    let h24 = h12 % 12;
    if (p === "PM") h24 += 12;
    const val = `${h24.toString().padStart(2, "0")}:${min}`;
    onChange(val);
  }

  const selectStyle: React.CSSProperties = {
    appearance: "none",
    WebkitAppearance: "none",
    background: "var(--input-background, #f5f5f0)",
    border: "1px solid var(--border, #e5e5e5)",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 12,
    fontFamily: "monospace",
    color: "var(--foreground, #1a1a18)",
    cursor: "pointer",
    outline: "none",
    textAlign: "center" as const,
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex-shrink-0 bg-input-background rounded-lg px-2 py-2 text-xs font-mono transition-all cursor-pointer flex items-center gap-1"
        style={{
          color: value ? "var(--foreground)" : "var(--muted-foreground)",
          border: open ? `1.5px solid ${accent}` : "1px solid transparent",
        }}
        title="Set deadline"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        {value ? `${hour12}:${minute} ${period}` : "Time"}
      </button>

      {open && (
        <div
          ref={popupRef}
          className="bg-card border border-border rounded-xl shadow-lg p-3 flex items-center gap-1.5"
          style={{
            position: "fixed",
            top: pos.top,
            right: pos.right,
            transform: "translateY(-100%)",
            zIndex: 9999,
            minWidth: 180,
          }}
        >
          {/* Hour */}
          <select
            style={selectStyle}
            value={hour12}
            onChange={(e) => update(parseInt(e.target.value, 10), minute, period)}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          <span className="text-xs font-bold text-muted-foreground">:</span>

          {/* Minute */}
          <select
            style={selectStyle}
            value={minute}
            onChange={(e) => update(hour12, e.target.value, period)}
          >
            {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0")).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* AM/PM */}
          <select
            style={selectStyle}
            value={period}
            onChange={(e) => update(hour12, minute, e.target.value)}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="text-xs text-muted-foreground hover:text-destructive ml-1 transition-colors"
              title="Clear time"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </>
  );
}

interface PanelProps {
  label: string;
  accent: string;
  date: Date;
  kind: "habits" | "goals";
}

function Panel({ label, accent, date, kind }: PanelProps) {
  const { items, persist } = useFirestoreItems(date, kind);
  const [draft, setDraft] = useState("");
  const [deadline, setDeadline] = useState("");

  function add() {
    const text = draft.trim();
    if (!text) return;
    const newItem: Item = { id: uid(), text, done: false };
    if (deadline) newItem.deadline = deadline;
    persist([...items, newItem]);
    setDraft("");
    setDeadline("");
  }

  function toggle(id: string) {
    persist(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }

  function remove(id: string) {
    persist(items.filter((i) => i.id !== id));
  }

  const done = items.filter((i) => i.done).length;

  return (
    <div className="flex flex-col h-full bg-card rounded-2xl border border-border overflow-hidden">
      {/* Panel header */}
      <div
        className="px-5 py-4 flex items-center justify-between border-b border-border"
        style={{ borderLeftWidth: 3, borderLeftColor: accent }}
      >
        <div>
          <h2 className="text-sm font-semibold tracking-widest uppercase text-foreground/70">
            {label}
          </h2>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            {done}/{items.length} done
          </p>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-medium"
          style={{ background: accent + "18", color: accent }}
        >
          {items.length}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 scrollbar-hide">
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[80px]">
            <p className="text-xs text-muted-foreground font-mono">
              nothing here yet
            </p>
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
          >
            {/* Custom checkbox */}
            <button
              onClick={() => toggle(item.id)}
              className="mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: item.done ? accent : "rgba(26,26,24,0.25)",
                background: item.done ? accent : "transparent",
              }}
              aria-label={item.done ? "Mark incomplete" : "Mark complete"}
            >
              {item.done && (
                <svg
                  width="9"
                  height="7"
                  viewBox="0 0 9 7"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1 3.5L3.5 6L8 1"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            <div className="flex-1 flex flex-col justify-center">
              <span
                className="text-sm leading-relaxed transition-all duration-200"
                style={{
                  textDecoration: item.done ? "line-through" : "none",
                  color: item.done
                    ? "var(--muted-foreground)"
                    : "var(--foreground)",
                }}
              >
                {item.text}
              </span>
              {item.deadline && (
                <span 
                  className="text-[10px] font-mono mt-0.5 flex items-center gap-1"
                  style={{
                    color: item.done 
                      ? "var(--muted-foreground)" 
                      : (isOverdue(item.deadline, date) ? "#ef4444" : "var(--muted-foreground)")
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  {formatTime(item.deadline)}
                </span>
              )}
            </div>

            <button
              onClick={() => remove(item.id)}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Add input */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex gap-2 items-center">
          <input
            className="flex-1 min-w-0 bg-input-background rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 placeholder:text-muted-foreground/60 transition-all"
            style={{ "--tw-ring-color": accent } as React.CSSProperties}
            placeholder={`Add ${kind === "habits" ? "habit" : "goal"}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <TimePicker value={deadline} onChange={setDeadline} accent={accent} />
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: accent, color: "#fff" }}
            aria-label="Add item"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Calendar panel — week strip + prev/next
const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function DateSidebar({
  selected,
  onSelect,
}: {
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function prevWeek() {
    setWeekStart((d) => subDays(d, 7));
  }

  function nextWeek() {
    setWeekStart((d) => addDays(d, 7));
  }

  const monthLabel = format(weekStart, "MMMM yyyy");

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col gap-4">
      {/* Month header */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevWeek}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-xs font-mono font-medium text-muted-foreground tracking-wide uppercase">
            {monthLabel}
          </span>
          <button
            onClick={nextWeek}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-mono text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-1">
          {week.map((d) => {
            const isSelected = dateKey(d) === dateKey(selected);
            const _isToday = isToday(d);
            return (
              <button
                key={d.toISOString()}
                onClick={() => onSelect(d)}
                className="flex flex-col items-center justify-center aspect-square rounded-lg text-xs font-mono transition-all"
                style={
                  isSelected
                    ? { background: "#1a1a18", color: "#f7f6f3" }
                    : _isToday
                    ? {
                        background: "#d9770618",
                        color: "#d97706",
                        fontWeight: 600,
                      }
                    : {}
                }
              >
                <span>{format(d, "d")}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day info */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-1">
          Selected
        </p>
        <p className="text-2xl font-semibold leading-tight text-foreground">
          {format(selected, "EEEE")}
        </p>
        <p className="text-sm text-muted-foreground font-mono mt-0.5">
          {format(selected, "dd MMM yyyy")}
        </p>
        {isToday(selected) && (
          <span
            className="inline-block mt-3 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full"
            style={{ background: "#d9770618", color: "#d97706" }}
          >
            TODAY
          </span>
        )}
      </div>

      {/* Jump to today */}
      {!isToday(selected) && (
        <button
          onClick={() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            onSelect(today);
            const ws = new Date(today);
            ws.setDate(ws.getDate() - ws.getDay());
            setWeekStart(ws);
          }}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors text-center py-1"
        >
          ← back to today
        </button>
      )}
    </aside>
  );
}

function TrackerApp() {
  const { signOut, user } = useAuth();
  const [selected, setSelected] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  return (
    <div
      className="min-h-screen bg-background"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-3">
          <div
            className="w-5 h-5 rounded"
            style={{ background: "#d97706" }}
          />
          <span className="text-sm font-semibold tracking-wide text-foreground">
            DayTrack
          </span>
          <span className="text-xs font-mono text-muted-foreground ml-auto">
            {format(new Date(), "EEE, dd MMM")}
          </span>
          {/* Sign out button */}
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 ml-3 px-2.5 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            title={`Signed in as ${user?.email}`}
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex gap-5 items-start">
          {/* Sidebar */}
          <DateSidebar selected={selected} onSelect={setSelected} />

          {/* Panels */}
          <div className="flex-1 grid grid-cols-2 gap-5 min-h-[580px]">
            <Panel
              label="Habits"
              accent="#d97706"
              date={selected}
              kind="habits"
            />
            <Panel
              label="Goals & Tasks"
              accent="#3b82f6"
              date={selected}
              kind="goals"
            />
          </div>
        </div>
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-5 h-5 rounded animate-pulse"
            style={{ background: "#d97706" }}
          />
          <span className="text-sm font-mono text-muted-foreground">
            Loading…
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <TrackerApp />;
}
