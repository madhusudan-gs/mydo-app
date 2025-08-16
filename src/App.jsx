import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Circle, Calendar, Inbox, Clock, RefreshCcw,
  Download, Upload, Trash2, Pause, Play, X, Filter, Settings,
  ChevronDown, ChevronRight, Timer, ListTodo, Archive
} from "lucide-react";

/* ----------------------------- Helpers ----------------------------- */
const PRIORITIES = ["Low", "Med", "High", "Urgent"];
const RECUR_OPTS = ["none", "daily", "weekly", "monthly"];

const todayISO = () => new Date().toISOString().slice(0, 10);
const isSameDay = (a, b) =>
  a && b && new Date(a).toDateString() === new Date(b).toDateString();
const inNextDays = (d, n) => {
  if (!d) return false;
  const due = new Date(d);
  const now = new Date();
  const lim = new Date();
  lim.setDate(now.getDate() + n);
  return due >= new Date(now.toDateString()) && due <= lim;
};
const classNames = (...a) => a.filter(Boolean).join(" ");
const loadLS = (k, fallback) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
  catch { return fallback; }
};
const saveLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const groupBy = (arr, fn) =>
  arr.reduce((m, x) => { const k = fn(x); (m[k] ||= []).push(x); return m; }, {});

const nextRecurringDate = (date, recur) => {
  const d = new Date(date || Date.now());
  const nd = new Date(d);
  if (recur === "daily") nd.setDate(d.getDate() + 1);
  else if (recur === "weekly") nd.setDate(d.getDate() + 7);
  else if (recur === "monthly") nd.setMonth(d.getMonth() + 1);
  else return null;
  return nd.toISOString().slice(0, 10);
};

/* ----------------------------- UI Primitives ----------------------------- */
const Button = ({ as: As = "button", className, children, ...props }) => (
  <As
    className={classNames(
      "inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm border border-neutral-200 hover:shadow-md active:scale-[.99] transition",
      className
    )}
    {...props}
  >
    {children}
  </As>
);
const Input = (props) => (
  <input
    {...props}
    className={classNames(
      "w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-neutral-300",
      props.className
    )}
  />
);
const Textarea = (props) => (
  <textarea
    {...props}
    className={classNames(
      "w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 ring-neutral-300",
      props.className
    )}
  />
);
const Section = ({ title, icon: Icon, actions, children }) => (
  <div className="relative bg-white rounded-2xl p-4 shadow-sm border">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 font-semibold">
        <Icon size={18} /> {title}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
    {children}
  </div>
);

/* ----------------------------- Pomodoro Hook ----------------------------- */
function usePomodoro(initial = { work: 25 * 60, break: 5 * 60 }) {
  const [dur, setDur] = useState(initial);
  const [mode, setMode] = useState("work");
  const [secs, setSecs] = useState(dur.work);
  const [running, setRunning] = useState(false);
  const [boundTaskId, setBoundTaskId] = useState(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (secs === 0) {
      const next = mode === "work" ? dur.break : dur.work;
      setMode((m) => (m === "work" ? "break" : "work"));
      setSecs(next);
    }
  }, [secs, mode, dur]);

  const reset = () => { setMode("work"); setSecs(dur.work); setRunning(false); };
  const fmt = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
      .toString()
      .padStart(2, "0")}`;

  return {
    mode, secs, fmt, running, setRunning, reset, setDur, dur,
    bind: (id) => setBoundTaskId(id), boundTaskId,
  };
}

/* ----------------------------- Main App ----------------------------- */
export default function MyDo() {
  const [tasks, setTasks] = useState(() => loadLS("mydo.tasks", []));
  const [view, setView] = useState(() =>
    loadLS("mydo.view", { type: "today", key: null })
  );
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef(null);
  const pomo = usePomodoro();

  useEffect(() => saveLS("mydo.tasks", tasks), [tasks]);
  useEffect(() => saveLS("mydo.view", view), [view]);

  // Shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key.toLowerCase() === "a") setShowAdd(true);
      if (e.key.toLowerCase() === "t") {
        setShowAdd(true);
        setTimeout(() => {
          const el = document.getElementById("due-input");
          if (el) el.value = todayISO();
        }, 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allProjects = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.project).filter(Boolean))).sort(),
    [tasks]
  );
  const allLabels = useMemo(
    () => Array.from(new Set(tasks.flatMap((t) => t.labels || []))).sort(),
    [tasks]
  );

  // Filtering & sorting
  const filtered = useMemo(() => {
    let list = tasks.filter((t) => !t.archived);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((t) =>
        [t.title, t.notes, t.project, ...(t.labels || [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(s)
      );
    }
    if (view.type === "today") {
      list = list.filter((t) => !t.completedAt && isSameDay(t.due, todayISO()));
    }
    return list;
  }, [tasks, view, q]);

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-800 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-4">
        {/* Sidebar */}
        <aside className="col-span-12 md:col-span-3 flex flex-col gap-3">
          <Section
            title="MyDo"
            icon={ListTodo}
            actions={<Button onClick={() => setShowAdd(true)}><Plus size={16}/>Add</Button>}
          >
            <div className="flex items-center gap-2 mb-3">
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search ( / )"
              />
              <Button onClick={() => setQ("")} title="Clear"><X size={16}/></Button>
            </div>
          </Section>
        </aside>

        {/* Main */}
        <main className="col-span-12 md:col-span-9 flex flex-col gap-4">
          <Header pomo={pomo}/>
          <div className="relative z-10">
            <Section
              title="Tasks"
              icon={Filter}
              actions={<Button onClick={() => setShowAdd(true)}><Plus size={16}/>Quick Add (A)</Button>}
            >
              {filtered.map((t) => (
                <div key={t.id} className="p-2 border rounded">{t.title}</div>
              ))}
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ----------------------------- Components ----------------------------- */
function Header({ pomo }) {
  return (
    <Section title="Focus Timer" icon={Timer}>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-mono">{pomo.fmt(pomo.secs)}</span>
        <Button onClick={() => pomo.setRunning((r) => !r)}>
          {pomo.running ? <Pause size={16}/> : <Play size={16}/>}
        </Button>
      </div>
    </Section>
  );
}
