import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, CheckCircle2, Circle, Calendar, Inbox, Clock, RefreshCcw,
  Download, Upload, Trash2, Pause, Play, X, Timer, ListTodo, Archive
} from "lucide-react";

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

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState("inbox");
  const [newTask, setNewTask] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    const s = localStorage.getItem("mydo-tasks");
    if (s) setTasks(JSON.parse(s));
  }, []);
  useEffect(() => {
    localStorage.setItem("mydo-tasks", JSON.stringify(tasks));
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = tasks;
    if (view === "today") list = list.filter(t => !t.completedAt && isSameDay(t.due, todayISO()));
    if (view === "upcoming") list = list.filter(t => !t.completedAt && inNextDays(t.due, 7));
    if (view === "completed") list = list.filter(t => !!t.completedAt);
    if (view === "archive") list = list.filter(t => !!t.archived);
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(s));
    }
    return list;
  }, [tasks, view, q]);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([{ id: uuidv4(), title: newTask, createdAt: new Date().toISOString() }, ...tasks]);
    setNewTask("");
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r p-4 space-y-2">
        <button onClick={() => setView("inbox")} className="flex items-center gap-2">
          <Inbox size={16}/> Inbox
        </button>
        <button onClick={() => setView("today")} className="flex items-center gap-2">
          <Calendar size={16}/> Today
        </button>
        <button onClick={() => setView("upcoming")} className="flex items-center gap-2">
          <Clock size={16}/> Upcoming
        </button>
        <button onClick={() => setView("completed")} className="flex items-center gap-2">
          <CheckCircle2 size={16}/> Completed
        </button>
        <button onClick={() => setView("archive")} className="flex items-center gap-2">
          <Archive size={16}/> Archive
        </button>
      </aside>
      <main className="flex-1 p-6">
        <div className="flex gap-2 mb-4">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add task..."
            className="border rounded px-3 py-2 w-full"
          />
          <button onClick={addTask} className="bg-black text-white px-4 py-2 rounded">Add</button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <ul className="space-y-2">
          {filtered.map((t) => (
            <li key={t.id} className="p-3 border rounded flex justify-between items-center">
              <span>{t.title}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setTasks(tasks.map(x => x.id === t.id ? { ...x, completedAt: x.completedAt ? null : new Date().toISOString() } : x))}
                  className="text-green-600 text-sm"
                >
                  {t.completedAt ? "Undo" : "Done"}
                </button>
                <button
                  onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
                  className="text-red-500 text-sm"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
