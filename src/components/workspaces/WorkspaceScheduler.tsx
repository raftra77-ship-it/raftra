import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  Plus,
  Zap,
  CheckCircle2,
  TrendingUp,
  Layers,
  Sparkles,
  Search,
  Sliders,
  Trash2,
  Edit3,
  ExternalLink,
  X,
  Check,
  Flag,
  ArrowRight,
  Flame,
  ShoppingBag,
  Bell
} from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface UpcomingEvent {
  id: string;
  name: string;
  date: string;
  daysLeft: string;
  country: string;
  category: string;
  isCustom?: boolean;
}

interface ScheduleTask {
  id: string;
  name: string;
  frequency: string;
  nextRun: string;
  status: 'active' | 'paused';
  description?: string;
}

interface ScheduleTemplate {
  id: string;
  name: string;
  description: string;
  suggestedFrequency: string;
  icon: string;
}

export const WorkspaceScheduler: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  // Upcoming Events
  const [events, setEvents] = useState<UpcomingEvent[]>([
    {
      id: 'event-1',
      name: 'Ganesh Chaturthi',
      date: 'Sep 14, 2026',
      daysLeft: 'in 27 days',
      country: 'IN',
      category: 'Festival / Festive Shopping'
    },
    {
      id: 'event-2',
      name: 'Navratri and Dussehra',
      date: 'Oct 11 - Oct 20, 2026',
      daysLeft: 'in 54 days',
      country: 'IN',
      category: 'Big Festive Blitz'
    },
    {
      id: 'event-3',
      name: 'Diwali',
      date: 'Nov 8, 2026',
      daysLeft: 'in 82 days',
      country: 'IN',
      category: 'Peak Shopping Season'
    }
  ]);

  // Active user schedules
  const [schedules, setSchedules] = useState<ScheduleTask[]>([
    {
      id: 'task-1',
      name: 'Demo Brand Fresh Creative Batch',
      frequency: 'Mon, Thu at 9:00 AM',
      nextRun: 'Next run in 2d',
      status: 'active',
      description: 'Generates 10 fresh static variants + 2 video storyboards from top winning angles.'
    },
    {
      id: 'task-2',
      name: 'Weekly competitor report',
      frequency: 'Weekly on Mon at 9:00 AM',
      nextRun: 'Next run in 6d',
      status: 'active',
      description: 'Summarizes competitor ad copy hooks, creative styles, and keyword bid changes.'
    }
  ]);

  // Recommended Quick-Schedule Templates
  const templates: ScheduleTemplate[] = [
    {
      id: 'tmpl-comp-analysis',
      name: 'Schedule competitor analysis',
      description: 'Summary of what your competitors launched overnight.',
      suggestedFrequency: 'Daily at 8:00 AM',
      icon: '🔍'
    },
    {
      id: 'tmpl-perf-digest',
      name: 'Schedule a daily performance digest',
      description: 'A daily roundup of how your campaigns and creatives perform.',
      suggestedFrequency: 'Daily at 9:30 AM',
      icon: '📊'
    },
    {
      id: 'tmpl-creative-refresh',
      name: 'Schedule a weekly creative refresh',
      description: 'Fresh creative variants from your best performers each week.',
      suggestedFrequency: 'Weekly on Wednesdays',
      icon: '🎨'
    },
    {
      id: 'tmpl-trend-research',
      name: 'Schedule trend research',
      description: 'Regular research on emerging trends and seasonal moments.',
      suggestedFrequency: 'Every Monday & Friday',
      icon: '📈'
    }
  ];

  // Modals state
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);

  // New Event Form
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventDaysLeft, setNewEventDaysLeft] = useState('in 14 days');
  const [newEventCountry, setNewEventCountry] = useState('IN');

  // New Task Form
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskFrequency, setNewTaskFrequency] = useState('Mon, Thu at 9:00 AM');

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const newEv: UpcomingEvent = {
      id: `event-${Date.now()}`,
      name: newEventName,
      date: newEventDate || 'Upcoming 2026',
      daysLeft: newEventDaysLeft,
      country: newEventCountry,
      category: 'Custom Brand Event',
      isCustom: true
    };

    setEvents(prev => [...prev, newEv]);
    setShowAddEventModal(false);
    setNewEventName('');
    setNewEventDate('');
  };

  const handleAddFromTemplate = (tmpl: ScheduleTemplate) => {
    // Check if already scheduled
    if (schedules.some(s => s.name.toLowerCase() === tmpl.name.replace(/^schedule\s+(a\s+)?/i, '').toLowerCase())) {
      alert(`"${tmpl.name}" is already active in your schedule!`);
      return;
    }

    const cleanName = tmpl.name.replace(/^schedule\s+(a\s+)?/i, (match) => {
      return match.includes('daily') ? 'Daily ' : match.includes('weekly') ? 'Weekly ' : '';
    });

    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    const newTask: ScheduleTask = {
      id: `task-${Date.now()}`,
      name: formattedName.length > 3 ? formattedName : tmpl.name,
      frequency: tmpl.suggestedFrequency,
      nextRun: 'Next run in 1d',
      status: 'active',
      description: tmpl.description
    };

    setSchedules(prev => [...prev, newTask]);
    alert(`✓ Successfully scheduled: "${tmpl.name}"!`);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    const newTask: ScheduleTask = {
      id: `task-${Date.now()}`,
      name: newTaskName,
      frequency: newTaskFrequency,
      nextRun: 'Next run in 2d',
      status: 'active',
      description: 'Custom automated task queued for recurring execution.'
    };

    setSchedules(prev => [...prev, newTask]);
    setShowAddTaskModal(false);
    setNewTaskName('');
  };

  const handleToggleTaskStatus = (id: string) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s));
  };

  const handleTriggerTaskNow = (id: string) => {
    setRunningTaskId(id);
    setTimeout(() => {
      setRunningTaskId(null);
      alert('Task triggered and executed successfully!');
    }, 1200);
  };

  const handleDeleteTask = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
      
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '32px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Scheduler
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: 0, lineHeight: 1.5 }}>
            Plan and queue your tasks so nothing slips through.
          </p>
        </div>

        <GlowButton
          variant="glow"
          onClick={() => setShowAddTaskModal(true)}
          style={{ fontSize: '13px', padding: '9px 22px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={15} /> Schedule a Task
        </GlowButton>
      </div>

      {/* ── 1. UPCOMING EVENTS SECTION ─────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="#FF6B00" />
            <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              Upcoming events
            </h2>
          </div>

          <button
            onClick={() => setShowAddEventModal(true)}
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '100px',
              padding: '6px 16px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={13} /> Add Upcoming Event
          </button>
        </div>

        {/* Event Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
          {events.map((ev) => (
            <div
              key={ev.id}
              className="glow-card"
              style={{
                background: 'linear-gradient(135deg, rgba(24, 24, 36, 0.75) 0%, rgba(12, 12, 18, 0.95) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '18px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Top Row: Days left badge & Country */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#FFB300',
                    background: 'rgba(255, 179, 0, 0.12)',
                    border: '1px solid rgba(255, 179, 0, 0.3)',
                    padding: '3px 10px',
                    borderRadius: '100px'
                  }}
                >
                  {ev.daysLeft}
                </span>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: '#fff',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}
                >
                  🇮🇳 {ev.country}
                </span>
              </div>

              {/* Event Name & Date */}
              <div>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 4px 0', fontWeight: 800 }}>
                  {ev.name}
                </h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} color="#7C75FF" />
                  <span>{ev.date}</span>
                </div>
              </div>

              {/* Quick Action: Prepare Campaign */}
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{ev.category}</span>
                <button
                  onClick={() => {
                    alert(`Preparing seasonal creative batch for ${ev.name}...`);
                    if (onNavigateTab) onNavigateTab('studio');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#00E676',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  Queue Creatives <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. YOUR SCHEDULE SECTION ───────────────────────────────── */}
      <div
        className="glow-card"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.7) 0%, rgba(10, 10, 16, 0.95) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="#00E676" />
              <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                Your schedule
              </h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', margin: '4px 0 0 0' }}>
              Schedule a task or add an upcoming event
            </p>
          </div>

          <button
            onClick={() => setShowAddTaskModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              padding: '7px 16px',
              borderRadius: '100px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={13} /> Add Task
          </button>
        </div>

        {/* Schedule List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {schedules.map((task) => {
            const isRunning = runningTaskId === task.id;
            const isActive = task.status === 'active';

            return (
              <div
                key={task.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.08)' : '1px dashed rgba(255, 255, 255, 0.06)',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                  opacity: isActive ? 1 : 0.6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: isActive ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Clock size={17} color={isActive ? '#00E676' : 'var(--text-muted)'} />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '15px', color: '#fff', margin: '0 0 3px 0', fontWeight: 700 }}>
                      {task.name}
                    </h4>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{task.frequency}</span>
                      <span>•</span>
                      <span style={{ color: '#FFB300', fontWeight: 600 }}>{task.nextRun}</span>
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleTriggerTaskNow(task.id)}
                    disabled={isRunning}
                    style={{
                      background: 'rgba(0, 230, 118, 0.15)',
                      border: '1px solid rgba(0, 230, 118, 0.3)',
                      color: '#00E676',
                      padding: '6px 14px',
                      borderRadius: '100px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: isRunning ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Play size={11} /> {isRunning ? 'Running...' : 'Run Now'}
                  </button>

                  <button
                    onClick={() => handleToggleTaskStatus(task.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: '100px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {isActive ? 'Pause' : 'Resume'}
                  </button>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      padding: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. RECOMMENDED 1-CLICK SCHEDULERS ───────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#7C75FF" />
          <h2 style={{ fontSize: '20px', color: '#fff', margin: 0, fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            Quick-Schedule Automation Templates
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="glow-card"
              style={{
                background: 'linear-gradient(135deg, rgba(20, 20, 32, 0.6) 0%, rgba(10, 10, 16, 0.9) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>{tmpl.icon}</div>
                <h3 style={{ fontSize: '16px', color: '#fff', margin: '0 0 6px 0', fontWeight: 800 }}>
                  {tmpl.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  {tmpl.description}
                </p>
              </div>

              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tmpl.suggestedFrequency}</span>
                <button
                  onClick={() => handleAddFromTemplate(tmpl)}
                  style={{
                    background: 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
                    color: '#000000',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '7px 18px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,230,118,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={13} /> Schedule
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ADD UPCOMING EVENT MODAL ───────────────────────────────── */}
      <AnimatePresence>
        {showAddEventModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                background: '#0a0a12',
                border: '1px solid rgba(255, 179, 0, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Flame size={20} color="#FFB300" />
                  <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Add Upcoming Event
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddEvent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Event / Sale Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Independence Day Sale, Black Friday"
                    value={newEventName}
                    onChange={e => setNewEventName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Event Date
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aug 15, 2026"
                      value={newEventDate}
                      onChange={e => setNewEventDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '13.5px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                      Countdown Tag
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. in 21 days"
                      value={newEventDaysLeft}
                      onChange={e => setNewEventDaysLeft(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '13.5px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddEventModal(false)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <GlowButton variant="glow" type="submit" style={{ padding: '9px 24px', fontSize: '13px' }}>
                    Save Event ✓
                  </GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── ADD TASK MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddTaskModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              padding: '20px'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                background: '#0a0a12',
                border: '1px solid rgba(0, 230, 118, 0.35)',
                borderRadius: '24px',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.8)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={20} color="#00E676" />
                  <h3 style={{ fontSize: '19px', color: '#fff', margin: 0, fontWeight: 800 }}>
                    Schedule a Task
                  </h3>
                </div>
                <button
                  onClick={() => setShowAddTaskModal(false)}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Task Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Daily UGC Creative Batch"
                    value={newTaskName}
                    onChange={e => setNewTaskName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                    Frequency / Interval
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mon, Thu at 9:00 AM"
                    value={newTaskFrequency}
                    onChange={e => setNewTaskFrequency(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13.5px',
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddTaskModal(false)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <GlowButton variant="glow" type="submit" style={{ padding: '9px 24px', fontSize: '13px' }}>
                    Add Task ✓
                  </GlowButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
