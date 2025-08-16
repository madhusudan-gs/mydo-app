import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Circle, Calendar, Inbox, Clock, RefreshCcw,
  Download, Upload, Trash2, Pause, Play, X, Filter, Settings,
  ChevronDown, ChevronRight, Timer, ListTodo, Archive
} from "lucide-react";

/* --------------------------------- Helpers -------------------------------- */
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

/* ------------------------------- UI Primitives ----------------------------- */
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
// NOTE: made relative to create a stacking context (overlap fix)
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

/* ------------------------------- Pomodoro Hook ----------------------------- */
function usePomodoro(initial = { work: 25 * 60, break: 5 * 60 }) {
  const [dur, setDur] = useState(initial);
  const [mode, setMode] = useState("work"); // work | break
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

/* --------------------------------- App ------------------------------------ */
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
    switch (view.type) {
      case "inbox":
        list = list.filter((t) => !t.completedAt);
        break;
      case "today":
        list = list.filter(
          (t) =>
            !t.completedAt &&
            (isSameDay(t.due, todayISO()) ||
              (t.due && new Date(t.due) < new Date()))
        );
        break;
      case "upcoming":
        list = list.filter((t) => !t.completedAt && inNextDays(t.due, 7));
        break;
      case "project":
        list = list.filter((t) => t.project === view.key && !t.completedAt);
        break;
      case "label":
        list = list.filter((t) => (t.labels || []).includes(view.key) && !t.completedAt);
        break;
      case "completed":
        list = list.filter((t) => !!t.completedAt);
        break;
      case "archive":
        list = tasks.filter((t) => !!t.archived);
        break;
      default:
        break;
    }
    const pRank = (p) => PRIORITIES.indexOf(p ?? "Low");
    list.sort((a, b) => {
      const ad = a.due ? new Date(a.due).getTime() : Infinity;
      const bd = b.due ? new Date(b.due).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      if (pRank(b.priority) !== pRank(a.priority)) return pRank(b.priority) - pRank(a.priority);
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    return list;
  }, [tasks, view, q]);

  const counts = useMemo(
    () => ({
      inbox: tasks.filter((t) => !t.completedAt && !t.archived).length,
      today: tasks.filter(
        (t) =>
          !t.completedAt &&
          (isSameDay(t.due, todayISO()) ||
            (t.due && new Date(t.due) < new Date()))
      ).length,
      upcoming: tasks.filter((t) => !t.completedAt && inNextDays(t.due, 7)).length,
      completed: tasks.filter((t) => !!t.completedAt).length,
      archive: tasks.filter((t) => !!t.archived).length,
    }),
    [tasks]
  );

  // Mutations
  const addTask = (t) =>
    setTasks((prev) => [
      { ...t, id: uuidv4(), createdAt: new Date().toISOString() },
      ...prev,
    ]);
  const toggleDone = (id) =>
    setTasks((prev) =>
      prev.flatMap((t) => {
        if (t.id !== id) return [t];
        const completed = !t.completedAt;
        const base = { ...t, completedAt: completed ? new Date().toISOString() : null };
        // Handle recurring
        if (completed && t.recur && t.recur !== "none") {
          const nd = nextRecurringDate(t.due || todayISO(), t.recur);
          const next = {
            ...t,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            completedAt: null,
            due: nd,
          };
          return [base, next];
        }
        return [base];
      })
    );
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const archiveTask = (id) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, archived: true } : t)));
  const updateTask = (id, patch) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const bulkCompleteToday = () =>
    setTasks((prev) =>
      prev.map((t) =>
        !t.completedAt &&
        (isSameDay(t.due, todayISO()) || (t.due && new Date(t.due) < new Date()))
          ? { ...t, completedAt: new Date().toISOString() }
          : t
      )
    );

  // Export / Import
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ v: 1, tasks }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mydo-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        else if (Array.isArray(data)) setTasks(data);
        else alert("Invalid file format");
      } catch { alert("Invalid file"); }
    };
    reader.readAsText(file);
  };

  // Grouping
  const groupedByDue = useMemo(
    () => groupBy(filtered, (t) => (t.due ? new Date(t.due).toDateString() : "No due date")),
    [filtered]
  );

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
            <nav className="flex flex-col gap-1">
              <NavItem icon={Inbox} label="Inbox" count={counts.inbox} active={view.type==="inbox"} onClick={() => setView({ type: "inbox" })}/>
              <NavItem icon={Calendar} label="Today" count={counts.today} active={view.type==="today"} onClick={() => setView({ type: "today" })}/>
              <NavItem icon={Clock} label="Upcoming" count={counts.upcoming} active={view.type==="upcoming"} onClick={() => setView({ type: "upcoming" })}/>
              <NavItem icon={CheckCircle2} label="Completed" count={counts.completed} active={view.type==="completed"} onClick={() => setView({ type: "completed" })}/>
              <NavItem icon={Archive} label="Archive" count={counts.archive} active={view.type==="archive"} onClick={() => setView({ type: "archive" })}/>
            </nav>

            {/* Projects */}
            <div className="mt-4">
              <button onClick={() => setProjectsOpen((s) => !s)} className="flex items-center gap-2 text-sm font-semibold">
                {projectsOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/> }
                Projects
              </button>
              <AnimatePresence>
                {projectsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pl-5 mt-2 flex flex-col gap-1"
                  >
                    {allProjects.length === 0 && <div className="text-sm text-neutral-500">No projects yet</div>}
                    {allProjects.map((p) => (
                      <NavLeaf key={p} active={view.type==="project" && view.key===p} onClick={() => setView({ type: "project", key: p })} label={p}/>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Labels */}
            <div className="mt-2">
              <button onClick={() => setLabelsOpen((s) => !s)} className="flex items-center gap-2 text-sm font-semibold">
                {labelsOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/> }
                Labels
              </button>
              <AnimatePresence>
                {labelsOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pl-5 mt-2 flex flex-col gap-1"
                  >
                    {allLabels.length === 0 && <div className="text-sm text-neutral-500">No labels yet</div>}
                    {allLabels.map((l) => (
                      <NavLeaf key={l} active={view.type==="label" && view.key===l} onClick={() => setView({ type: "label", key: l })} label={`#${l}`}/>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Utilities */}
            <div className="mt-4 flex gap-2">
              <Button onClick={exportJSON}><Download size={16}/>Export</Button>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
                />
                <span className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 border hover:shadow-md">
                  <Upload size={16}/>Import
                </span>
              </label>
            </div>
            <div className="mt-2">
              <Button className="w-full" onClick={() => setSettingsOpen(true)}><Settings size={16}/>Settings</Button>
            </div>
          </Section>
        </aside>

        {/* Main */}
        <main className="col-span-12 md:col-span-9 flex flex-col gap-4">
          <Header pomo={pomo}/>
          {/* Wrap Quick Add in a higher z-index container (overlap fix) */}
          <div className="relative z-10">
            <Section
              title={viewTitle(view)}
              icon={Filter}
              actions={
                <>
                  {view.type === "today" && (
                    <Button onClick={bulkCompleteToday} title="Complete all due today">
                      <CheckCircle2 size={16}/>Complete Today
                    </Button>
                  )}
                  <Button onClick={() => setShowAdd(true)}><Plus size={16}/>Quick Add (A)</Button>
                </>
              }
            >
              <div className="flex flex-col gap-5">
                {Object.entries(groupedByDue)
                  .sort(([ak], [bk]) =>
                    (ak === "No due date") - (bk === "No due date") ||
                    new Date(ak) - new Date(bk)
                  )
                  .map(([k, items]) => (
                    <div key={k}>
                      <div className="text-sm font-semibold mb-2 text-neutral-600 flex items-center gap-2">
                        <Calendar size={14}/> {k}
                      </div>
                      <div className="flex flex-col gap-2">
                        {items.map((t) => (
                          <TaskRow
                            key={t.id}
                            t={t}
                            onToggle={() => toggleDone(t.id)}
                            onRemove={() => removeTask(t.id)}
                            onArchive={() => archiveTask(t.id)}
                            onEdit={(patch) => updateTask(t.id, patch)}
                            onBindPomodoro={() => pomo.bind(t.id)}
                            bound={pomo.boundTaskId === t.id}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                {filtered.length === 0 && (
                  <EmptyState onAdd={() => setShowAdd(true)} />
                )}
              </div>
            </Section>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAdd && (
          <Modal onClose={() => setShowAdd(false)}>
            <AddTaskForm
              onSubmit={(t) => { addTask(t); setShowAdd(false); }}
              defaultDue={view.type === "today" ? todayISO() : ""}
            />
          </Modal>
        )}
        {settingsOpen && (
          <Modal onClose={() => setSettingsOpen(false)}>
            <SettingsPane
              pomo={pomo}
              clearAll={() => {
                if (confirm("This will delete all tasks")) setTasks([]);
              }}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------- Components -------------------------------- */
function Header({ pomo }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
      <Section title="Focus Timer" icon={Timer}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className={classNames("text-3xl font-mono", pomo.mode === "work" ? "text-neutral-900" : "text-green-600")}>
              {pomo.fmt(pomo.secs)}
            </span>
            <span className="text-xs px-2 py-1 rounded-full border">{pomo.mode.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => pomo.setRunning((r) => !r)}>
              {
