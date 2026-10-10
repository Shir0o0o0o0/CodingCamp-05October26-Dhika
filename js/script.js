/**
 * ============================================================
 * LIFE TASK DASHBOARD — script.js
 * Vanilla JavaScript | No frameworks | LocalStorage persistence
 *
 * Struktur:
 *  1. Constants & Config
 *  2. LocalStorage Helpers
 *  3. Toast Notification System
 *  4. Theme Manager (CF-1)
 *  5. Clock & Greeting (FR-1)
 *  6. Username Manager (CF-2)
 *  7. Focus Timer / Pomodoro (FR-2)
 *  8. Task Manager (FR-3 + CF-3)
 *  9. Quick Links Manager (FR-4)
 * 10. App Initializer
 * ============================================================
 */

'use strict';

/* ============================================================
   1. CONSTANTS & CONFIG
   ============================================================ */

/** LocalStorage key names (FR-5) */
const STORAGE_KEYS = {
  TASKS:      'lifeDashboard.tasks',
  LINKS:      'lifeDashboard.quickLinks',
  USERNAME:   'lifeDashboard.username',
  THEME:      'lifeDashboard.theme',
  TIMER_MINS: 'lifeDashboard.timerMinutes',
};

/** Default quick links shown on first run */
const DEFAULT_LINKS = [
  { id: 'link-1', name: 'Google',    url: 'https://www.google.com',    favicon: '🔍' },
  { id: 'link-2', name: 'YouTube',   url: 'https://www.youtube.com',   favicon: '▶️' },
  { id: 'link-3', name: 'GitHub',    url: 'https://www.github.com',    favicon: '🐙' },
  { id: 'link-4', name: 'Wikipedia', url: 'https://www.wikipedia.org', favicon: '📖' },
];

/** Timer ring circumference: 2 * π * r (r = 52) */
const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.73

/** Toast auto-dismiss duration in ms */
const TOAST_DURATION = 3000;

/** Maximum username length */
const USERNAME_MAX_LENGTH = 30;

/** Days and months in Indonesian */
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/* ============================================================
   2. LOCALSTORAGE HELPERS (FR-5)
   ============================================================ */

/**
 * Reads and parses a value from LocalStorage.
 * Returns `defaultValue` if key is missing or data is corrupt.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function storageGet(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    // Corrupt data — return safe default
    return defaultValue;
  }
}

/**
 * Serialises and saves a value to LocalStorage.
 * @param {string} key
 * @param {*} value
 */
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[Dashboard] LocalStorage write failed:', err);
  }
}

/**
 * Generates a simple unique ID using timestamp + random suffix.
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ============================================================
   3. TOAST NOTIFICATION SYSTEM
   ============================================================ */

/**
 * Displays a temporary toast notification.
 * @param {string} message  - The message to show.
 * @param {'success'|'error'|'info'|'warning'} type
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  // Use textContent for the message to prevent XSS
  const iconSpan = document.createElement('span');
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = icons[type] ?? 'ℹ️';

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  // Auto-remove after duration
  const removeToast = () => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Fallback removal if animation doesn't fire
    setTimeout(() => toast.remove(), 500);
  };

  setTimeout(removeToast, TOAST_DURATION);
}

/* ============================================================
   4. THEME MANAGER (CF-1)
   ============================================================ */

const ThemeManager = (() => {
  const THEMES = { LIGHT: 'theme-light', DARK: 'theme-dark' };
  let currentTheme = THEMES.LIGHT;

  /** Applies a theme to <body> and updates the toggle button icon. */
  function applyTheme(theme) {
    currentTheme = theme;
    document.body.classList.remove(THEMES.LIGHT, THEMES.DARK);
    document.body.classList.add(theme);

    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.textContent = theme === THEMES.DARK ? '☀️' : '🌙';
    }

    storageSet(STORAGE_KEYS.THEME, theme);
  }

  /** Toggles between light and dark. */
  function toggle() {
    const next = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    applyTheme(next);
    showToast(
      next === THEMES.DARK ? 'Tema gelap diaktifkan' : 'Tema terang diaktifkan',
      'info'
    );
  }

  /** Loads and applies saved theme preference. */
  function init() {
    const saved = storageGet(STORAGE_KEYS.THEME, THEMES.LIGHT);
    const validTheme = Object.values(THEMES).includes(saved) ? saved : THEMES.LIGHT;
    applyTheme(validTheme);

    document.getElementById('btn-theme-toggle')
      ?.addEventListener('click', toggle);
  }

  return { init };
})();

/* ============================================================
   5. CLOCK & GREETING (FR-1)
   ============================================================ */

const ClockManager = (() => {
  let clockInterval = null;

  /**
   * Returns an Indonesian greeting based on current hour.
   * @param {number} hour - 0–23
   * @returns {string}
   */
  function getGreeting(hour) {
    if (hour >= 4  && hour < 11) return 'Selamat Pagi';
    if (hour >= 11 && hour < 15) return 'Selamat Siang';
    if (hour >= 15 && hour < 19) return 'Selamat Sore';
    return 'Selamat Malam';
  }

  /**
   * Pads a number to 2 digits.
   * @param {number} n
   * @returns {string}
   */
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** Renders the current time and date to the DOM. */
  function render() {
    const now   = new Date();
    const hours = now.getHours();
    const mins  = now.getMinutes();
    const secs  = now.getSeconds();

    // Clock
    const clockEl = document.getElementById('clock-time');
    if (clockEl) {
      clockEl.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
    }

    // Greeting
    const greetingEl = document.getElementById('greeting-message');
    if (greetingEl) {
      const username = storageGet(STORAGE_KEYS.USERNAME, '');
      const greeting = getGreeting(hours);
      greetingEl.textContent = username
        ? `${greeting}, ${username}! 👋`
        : `${greeting}! 👋`;
    }

    // Date
    const dateEl = document.getElementById('greeting-date');
    if (dateEl) {
      const day   = HARI[now.getDay()];
      const date  = now.getDate();
      const month = BULAN[now.getMonth()];
      const year  = now.getFullYear();
      dateEl.textContent = `${day}, ${date} ${month} ${year}`;
    }
  }

  /** Starts the clock interval. */
  function init() {
    render();
    // Run exactly on the second boundary to stay in sync
    const msUntilNextSecond = 1000 - (Date.now() % 1000);
    setTimeout(() => {
      render();
      clockInterval = setInterval(render, 1000);
    }, msUntilNextSecond);
  }

  return { init, render };
})();

/* ============================================================
   6. USERNAME MANAGER (CF-2)
   ============================================================ */

const UsernameManager = (() => {
  /** Opens the username modal, pre-filling the current name. */
  function openModal() {
    const modal    = document.getElementById('modal-username');
    const input    = document.getElementById('input-username');
    const errorEl  = document.getElementById('username-error');

    if (!modal || !input) return;

    const saved = storageGet(STORAGE_KEYS.USERNAME, '');
    input.value = saved;

    // Clear previous errors
    clearInputError(input, errorEl);

    modal.classList.remove('hidden');
    input.focus();
  }

  /** Closes the username modal. */
  function closeModal() {
    const modal = document.getElementById('modal-username');
    modal?.classList.add('hidden');
  }

  /**
   * Validates and saves the username.
   * Rules: not empty, max USERNAME_MAX_LENGTH chars, no only-whitespace.
   */
  function save() {
    const input   = document.getElementById('input-username');
    const errorEl = document.getElementById('username-error');
    if (!input) return;

    const value = input.value.trim();

    if (!value) {
      showInputError(input, errorEl, 'Nama tidak boleh kosong.');
      return;
    }
    if (value.length > USERNAME_MAX_LENGTH) {
      showInputError(input, errorEl, `Nama maksimal ${USERNAME_MAX_LENGTH} karakter.`);
      return;
    }

    storageSet(STORAGE_KEYS.USERNAME, value);
    ClockManager.render(); // Refresh greeting immediately
    closeModal();
    showToast(`Halo, ${value}! Nama disimpan.`, 'success');
  }

  function init() {
    document.getElementById('btn-edit-name')
      ?.addEventListener('click', openModal);

    document.getElementById('btn-save-name')
      ?.addEventListener('click', save);

    document.getElementById('btn-cancel-name')
      ?.addEventListener('click', closeModal);

    // Save on Enter key in input
    document.getElementById('input-username')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') closeModal();
      });

    // Close on overlay click
    document.getElementById('modal-username')
      ?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
      });
  }

  return { init };
})();

/* ============================================================
   7. FOCUS TIMER / POMODORO (FR-2)
   ============================================================ */

const TimerManager = (() => {
  /** Timer state */
  let totalSeconds   = 25 * 60; // default 25 minutes
  let remainingMs    = totalSeconds * 1000;
  let startTimestamp = null;   // epoch ms when last Start was pressed
  let rafId          = null;   // requestAnimationFrame handle
  let isRunning      = false;
  let isPaused       = false;

  // DOM refs (cached after init)
  let elDisplay, elRingProgress, elBadge, elBtnStart, elBtnPause, elBtnReset, elLabel;

  /**
   * Formats milliseconds to "MM:SS".
   * @param {number} ms
   * @returns {string}
   */
  function formatTime(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Updates the SVG ring progress based on remaining time.
   * @param {number} ms - Remaining milliseconds
   */
  function updateRing(ms) {
    const fraction = Math.max(0, Math.min(1, ms / (totalSeconds * 1000)));
    const offset   = RING_CIRCUMFERENCE * (1 - fraction);
    if (elRingProgress) {
      elRingProgress.style.strokeDashoffset = offset.toFixed(2);
    }
  }

  /** Updates all timer UI elements from current state. */
  function renderTimer(ms) {
    if (elDisplay) elDisplay.textContent = formatTime(ms);
    updateRing(ms);
  }

  /** Sets the visual badge and body class for timer state. */
  function setTimerState(state) {
    // 'idle' | 'running' | 'paused' | 'done'
    const labels = { idle: 'Siap', running: 'Berjalan', paused: 'Dijeda', done: 'Selesai!' };
    const classes = {
      idle:    'badge-idle',
      running: 'badge-running',
      paused:  'badge-paused',
      done:    'badge-done',
    };

    if (elBadge) {
      elBadge.textContent = labels[state] ?? state;
      elBadge.className   = `badge ${classes[state] ?? 'badge-idle'}`;
    }

    document.body.classList.toggle('timer-running', state === 'running');
  }

  /**
   * The animation loop. Uses timestamp-based calculation so the timer
   * stays accurate even when the tab is backgrounded.
   */
  function tick() {
    if (!isRunning) return;

    const elapsed   = Date.now() - startTimestamp;
    const currentMs = remainingMs - elapsed;

    if (currentMs <= 0) {
      // Timer finished
      renderTimer(0);
      isRunning = false;
      isPaused  = false;
      remainingMs = 0;
      cancelAnimationFrame(rafId);
      rafId = null;

      setTimerState('done');
      updateButtons();
      onTimerFinished();
      return;
    }

    renderTimer(currentMs);
    rafId = requestAnimationFrame(tick);
  }

  /** Handles timer completion: notification + toast. */
  function onTimerFinished() {
    showToast('🎉 Sesi fokus selesai! Saatnya istirahat.', 'success');

    // Request browser notification permission only when needed
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        sendBrowserNotification();
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') sendBrowserNotification();
        });
      }
    }
  }

  /** Sends a browser notification for timer completion. */
  function sendBrowserNotification() {
    try {
      new Notification('Life Task Dashboard', {
        body: '🍅 Sesi fokus selesai! Saatnya istirahat.',
        icon: '',
      });
    } catch {
      // Ignore notification errors silently
    }
  }

  /** Updates Start/Pause/Reset button states. */
  function updateButtons() {
    if (elBtnStart) {
      elBtnStart.disabled  = isRunning;
      elBtnStart.textContent = isRunning ? '▶ Berjalan...' : '▶ Mulai';
    }
    if (elBtnPause) {
      // Button is enabled when running (to pause) OR when paused (to resume)
      elBtnPause.disabled    = !isRunning && !isPaused;
      elBtnPause.textContent = isPaused ? '▶ Lanjutkan' : '⏸ Jeda';
    }
    if (elBtnReset) {
      elBtnReset.disabled = false;
    }
  }

  /** Starts or resumes the timer. */
  function start() {
    if (isRunning) return; // Prevent double-start

    // If paused, remainingMs already has the reduced value
    startTimestamp = Date.now();
    isRunning      = true;
    isPaused       = false;

    setTimerState('running');
    updateButtons();

    // Cancel any leftover RAF
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  /** Pauses the timer. */
  function pause() {
    if (!isRunning) return;

    // Capture how much time is left
    const elapsed   = Date.now() - startTimestamp;
    remainingMs     = Math.max(0, remainingMs - elapsed);
    startTimestamp  = null;
    isRunning       = false;
    isPaused        = true;

    cancelAnimationFrame(rafId);
    rafId = null;

    renderTimer(remainingMs);
    setTimerState('paused');
    updateButtons();
  }

  /** Resets the timer to the initial duration. */
  function reset() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    isRunning      = false;
    isPaused       = false;
    startTimestamp = null;
    remainingMs    = totalSeconds * 1000;

    renderTimer(remainingMs);
    setTimerState('idle');
    updateButtons();
  }

  /**
   * Sets a new duration in minutes.
   * @param {number} minutes
   */
  function setDuration(minutes) {
    const mins = parseInt(minutes, 10);
    if (isNaN(mins) || mins < 1) return;

    // Stop current run
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    totalSeconds   = mins * 60;
    remainingMs    = totalSeconds * 1000;
    isRunning      = false;
    isPaused       = false;
    startTimestamp = null;

    storageSet(STORAGE_KEYS.TIMER_MINS, mins);

    renderTimer(remainingMs);
    setTimerState('idle');
    updateButtons();

    // Update label
    if (elLabel) {
      elLabel.textContent = mins <= 10 ? 'Istirahat' : 'Fokus';
    }
  }

  function init() {
    // Cache DOM elements
    elDisplay     = document.getElementById('timer-display');
    elRingProgress = document.getElementById('ring-progress');
    elBadge       = document.getElementById('timer-status-badge');
    elBtnStart    = document.getElementById('btn-timer-start');
    elBtnPause    = document.getElementById('btn-timer-pause');
    elBtnReset    = document.getElementById('btn-timer-reset');
    elLabel       = document.getElementById('timer-label');

    // Set ring circumference
    if (elRingProgress) {
      elRingProgress.style.strokeDasharray = RING_CIRCUMFERENCE.toFixed(2);
    }

    // Restore saved duration
    const savedMins = storageGet(STORAGE_KEYS.TIMER_MINS, 25);
    const validMins = (Number.isInteger(savedMins) && savedMins >= 1) ? savedMins : 25;
    totalSeconds = validMins * 60;
    remainingMs  = totalSeconds * 1000;

    // Mark saved preset as active
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', parseInt(btn.dataset.minutes, 10) === validMins);
    });

    renderTimer(remainingMs);
    setTimerState('idle');
    updateButtons();

    // Button event listeners
    elBtnStart?.addEventListener('click', start);
    elBtnPause?.addEventListener('click', () => {
      if (isRunning) {
        pause();
      } else if (isPaused) {
        start(); // Resume
      }
    });
    elBtnReset?.addEventListener('click', reset);

    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mins = parseInt(btn.dataset.minutes, 10);
        setDuration(mins);

        document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  return { init };
})();

/* ============================================================
   8. TASK MANAGER (FR-3 + CF-3)
   ============================================================ */

const TaskManager = (() => {
  /** In-memory task array (mirrors LocalStorage). */
  let tasks = [];

  /** ID of the task currently being edited (null if none). */
  let editingTaskId = null;

  // ---- Data helpers ----------------------------------------

  /** Loads tasks from LocalStorage into memory. */
  function loadTasks() {
    const saved = storageGet(STORAGE_KEYS.TASKS, []);
    tasks = Array.isArray(saved) ? saved.filter(isValidTask) : [];
  }

  /** Persists the in-memory task list to LocalStorage. */
  function saveTasks() {
    storageSet(STORAGE_KEYS.TASKS, tasks);
  }

  /**
   * Basic shape validation for a task object.
   * @param {*} t
   * @returns {boolean}
   */
  function isValidTask(t) {
    return (
      t &&
      typeof t === 'object' &&
      typeof t.id        === 'string' &&
      typeof t.title     === 'string' &&
      typeof t.completed === 'boolean'
    );
  }

  // ---- Duplicate detection (CF-3) --------------------------

  /**
   * Normalises a title for duplicate comparison:
   * - Lowercase
   * - Collapse all internal whitespace to a single space
   * - Trim leading/trailing whitespace
   * @param {string} title
   * @returns {string}
   */
  function normalise(title) {
    return title.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Checks whether a title already exists in the task list.
   * When editing, the current task is excluded from the check.
   * @param {string} title
   * @param {string|null} excludeId - Task ID to exclude (for edits)
   * @returns {boolean}
   */
  function isDuplicate(title, excludeId = null) {
    const norm = normalise(title);
    return tasks.some((t) => t.id !== excludeId && normalise(t.title) === norm);
  }

  // ---- CRUD operations -------------------------------------

  /**
   * Adds a new task.
   * @param {string} rawTitle
   * @returns {boolean} Whether the task was added.
   */
  function addTask(rawTitle) {
    const title = rawTitle.trim();
    if (!title) return false;

    if (isDuplicate(title)) {
      showToast('Tugas dengan judul ini sudah ada!', 'warning');
      return false;
    }

    const task = {
      id:        generateId(),
      title,
      completed: false,
      createdAt: Date.now(),
    };

    tasks.unshift(task); // Add to top of list
    saveTasks();
    renderTaskList();
    showToast('Tugas berhasil ditambahkan!', 'success');
    return true;
  }

  /**
   * Toggles the completed status of a task.
   * @param {string} id
   */
  function toggleTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    saveTasks();
    renderTaskList();
  }

  /**
   * Deletes a task by ID.
   * @param {string} id
   */
  function deleteTask(id) {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const taskTitle = tasks[idx].title;
    tasks.splice(idx, 1);
    saveTasks();
    renderTaskList();
    showToast(`Tugas "${taskTitle}" dihapus.`, 'info');
  }

  /**
   * Opens the edit modal pre-filled with the task's current title.
   * @param {string} id
   */
  function openEditModal(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    editingTaskId = id;

    const input   = document.getElementById('input-edit-task');
    const errorEl = document.getElementById('edit-task-error');
    const modal   = document.getElementById('modal-edit-task');

    if (!input || !modal) return;

    input.value = task.title;
    clearInputError(input, errorEl);

    modal.classList.remove('hidden');
    input.focus();
    // Select all text for quick replacement
    input.select();
  }

  /** Closes the edit modal. */
  function closeEditModal() {
    document.getElementById('modal-edit-task')?.classList.add('hidden');
    editingTaskId = null;
  }

  /** Saves the edited task title. */
  function saveEditTask() {
    if (!editingTaskId) return;

    const input   = document.getElementById('input-edit-task');
    const errorEl = document.getElementById('edit-task-error');
    if (!input) return;

    const newTitle = input.value.trim();

    if (!newTitle) {
      showInputError(input, errorEl, 'Judul tugas tidak boleh kosong.');
      return;
    }
    if (newTitle.length > 100) {
      showInputError(input, errorEl, 'Judul tugas maksimal 100 karakter.');
      return;
    }

    // CF-3: exclude the task being edited from duplicate check
    if (isDuplicate(newTitle, editingTaskId)) {
      showInputError(input, errorEl, 'Tugas dengan judul ini sudah ada!');
      return;
    }

    const task = tasks.find((t) => t.id === editingTaskId);
    if (task) {
      task.title = newTitle;
      saveTasks();
      renderTaskList();
      showToast('Tugas berhasil diperbarui!', 'success');
    }

    closeEditModal();
  }

  // ---- Rendering -------------------------------------------

  /**
   * Formats a timestamp into a short relative/absolute label.
   * @param {number} ts - epoch ms
   * @returns {string}
   */
  function formatTaskDate(ts) {
    if (!ts) return '';
    const now   = Date.now();
    const diff  = now - ts;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (mins < 1)   return 'Baru saja';
    if (mins < 60)  return `${mins} mnt lalu`;
    if (hours < 24) return `${hours} jam lalu`;

    const d = new Date(ts);
    return `${d.getDate()} ${BULAN[d.getMonth()]}`;
  }

  /**
   * Builds a single task <li> element safely (no innerHTML for user data).
   * @param {Object} task
   * @returns {HTMLElement}
   */
  function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type      = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked   = task.completed;
    checkbox.setAttribute('aria-label', `Tandai "${task.title}" sebagai ${task.completed ? 'belum selesai' : 'selesai'}`);
    checkbox.addEventListener('change', () => toggleTask(task.id));

    // Title
    const titleSpan = document.createElement('span');
    titleSpan.className   = 'task-title';
    titleSpan.textContent = task.title; // Safe: textContent, not innerHTML

    // Meta (date)
    const metaSpan = document.createElement('span');
    metaSpan.className   = 'task-meta';
    metaSpan.textContent = formatTaskDate(task.createdAt);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-task-action btn-task-edit';
    editBtn.setAttribute('aria-label', `Edit tugas "${task.title}"`);
    editBtn.textContent = '✏️';
    editBtn.addEventListener('click', () => openEditModal(task.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-task-action btn-task-delete';
    deleteBtn.setAttribute('aria-label', `Hapus tugas "${task.title}"`);
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(titleSpan);
    li.appendChild(metaSpan);
    li.appendChild(actions);

    return li;
  }

  /** Re-renders the full task list and updates the counter. */
  function renderTaskList() {
    const list     = document.getElementById('task-list');
    const emptyEl  = document.getElementById('task-empty');
    const counterEl = document.getElementById('task-counter');

    if (!list) return;

    // Clear current items
    list.textContent = '';

    const activeTasks = tasks.filter((t) => !t.completed);
    const doneTasks   = tasks.filter((t) => t.completed);

    // Render active first, then completed
    [...activeTasks, ...doneTasks].forEach((task) => {
      list.appendChild(createTaskElement(task));
    });

    // Empty state
    const isEmpty = tasks.length === 0;
    emptyEl?.classList.toggle('hidden', !isEmpty);
    list.classList.toggle('hidden', isEmpty);

    // Counter: show only active (incomplete) tasks
    if (counterEl) {
      const count = activeTasks.length;
      counterEl.textContent = `${count} ${count === 1 ? 'tugas' : 'tugas'}`;
    }
  }

  function init() {
    loadTasks();
    renderTaskList();

    // Add task form submission
    document.getElementById('form-add-task')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();

        const input   = document.getElementById('input-task');
        const errorEl = document.getElementById('task-error');
        if (!input) return;

        const rawTitle = input.value;
        const title    = rawTitle.trim();

        // Validation
        if (!title) {
          showInputError(input, errorEl, 'Judul tugas tidak boleh kosong.');
          return;
        }
        if (title.length > 100) {
          showInputError(input, errorEl, 'Judul tugas maksimal 100 karakter.');
          return;
        }

        // CF-3: duplicate check (show in-form error, also toasted)
        if (isDuplicate(title)) {
          showInputError(input, errorEl, 'Tugas dengan judul ini sudah ada!');
          return;
        }

        clearInputError(input, errorEl);
        const added = addTask(rawTitle);
        if (added) {
          input.value = '';
          input.focus();
        }
      });

    // Clear error on typing
    document.getElementById('input-task')
      ?.addEventListener('input', () => {
        const input   = document.getElementById('input-task');
        const errorEl = document.getElementById('task-error');
        clearInputError(input, errorEl);
      });

    // Edit modal buttons
    document.getElementById('btn-save-edit-task')
      ?.addEventListener('click', saveEditTask);

    document.getElementById('btn-cancel-edit-task')
      ?.addEventListener('click', closeEditModal);

    document.getElementById('input-edit-task')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  saveEditTask();
        if (e.key === 'Escape') closeEditModal();
      });

    document.getElementById('modal-edit-task')
      ?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditModal();
      });
  }

  return { init };
})();

/* ============================================================
   9. QUICK LINKS MANAGER (FR-4)
   ============================================================ */

const LinksManager = (() => {
  /** In-memory links array. */
  let links = [];

  // ---- Data helpers ----------------------------------------

  function loadLinks() {
    const saved = storageGet(STORAGE_KEYS.LINKS, null);
    if (Array.isArray(saved) && saved.length > 0) {
      links = saved.filter(isValidLink);
    } else {
      // First run: seed with defaults
      links = [...DEFAULT_LINKS];
      saveLinks();
    }
  }

  function saveLinks() {
    storageSet(STORAGE_KEYS.LINKS, links);
  }

  /**
   * Basic shape validation for a link object.
   * @param {*} l
   * @returns {boolean}
   */
  function isValidLink(l) {
    return (
      l &&
      typeof l === 'object' &&
      typeof l.id   === 'string' &&
      typeof l.name === 'string' &&
      typeof l.url  === 'string'
    );
  }

  // ---- URL validation (FR-4) -------------------------------

  /**
   * Validates that a URL is well-formed and uses http:// or https://.
   * @param {string} rawUrl
   * @returns {{ valid: boolean, url: string, error: string }}
   */
  function validateUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return { valid: false, url: '', error: 'URL tidak boleh kosong.' };
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, url: '', error: 'URL harus menggunakan protokol http:// atau https://.' };
      }
      return { valid: true, url: parsed.href, error: '' };
    } catch {
      return { valid: false, url: '', error: 'Format URL tidak valid. Contoh: https://www.google.com' };
    }
  }

  // ---- Favicon / emoji helper ------------------------------

  /**
   * Returns an emoji based on the domain name, or a generic globe.
   * This keeps things lightweight without external requests.
   * @param {string} url
   * @returns {string}
   */
  function getEmoji(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('google'))     return '🔍';
      if (host.includes('youtube'))    return '▶️';
      if (host.includes('github'))     return '🐙';
      if (host.includes('twitter') || host.includes('x.com')) return '🐦';
      if (host.includes('facebook'))   return '👥';
      if (host.includes('instagram'))  return '📷';
      if (host.includes('linkedin'))   return '💼';
      if (host.includes('wikipedia'))  return '📖';
      if (host.includes('reddit'))     return '🤖';
      if (host.includes('npm'))        return '📦';
      if (host.includes('mdn') || host.includes('mozilla')) return '📘';
      if (host.includes('stackoverflow')) return '💬';
      if (host.includes('spotify'))    return '🎵';
      if (host.includes('notion'))     return '📝';
      if (host.includes('figma'))      return '🎨';
      if (host.includes('trello'))     return '📋';
      if (host.includes('slack'))      return '💬';
      if (host.includes('discord'))    return '🎮';
      if (host.includes('gmail') || host.includes('mail')) return '📧';
      if (host.includes('drive'))      return '☁️';
      if (host.includes('docs'))       return '📄';
      return '🌐';
    } catch {
      return '🌐';
    }
  }

  // ---- Form toggle -----------------------------------------

  function showAddForm() {
    const form = document.getElementById('form-add-link');
    form?.classList.remove('hidden');
    document.getElementById('input-link-name')?.focus();
  }

  function hideAddForm() {
    const form    = document.getElementById('form-add-link');
    const nameIn  = document.getElementById('input-link-name');
    const urlIn   = document.getElementById('input-link-url');
    const errorEl = document.getElementById('link-error');

    form?.classList.add('hidden');
    if (nameIn) nameIn.value = '';
    if (urlIn)  urlIn.value  = '';
    clearInputError(urlIn, errorEl);
  }

  // ---- CRUD ------------------------------------------------

  function saveNewLink() {
    const nameInput = document.getElementById('input-link-name');
    const urlInput  = document.getElementById('input-link-url');
    const errorEl   = document.getElementById('link-error');

    if (!nameInput || !urlInput) return;

    const name    = nameInput.value.trim();
    const rawUrl  = urlInput.value.trim();

    if (!name) {
      showInputError(urlInput, errorEl, 'Nama tautan tidak boleh kosong.');
      nameInput.focus();
      return;
    }

    const { valid, url, error } = validateUrl(rawUrl);
    if (!valid) {
      showInputError(urlInput, errorEl, error);
      urlInput.focus();
      return;
    }

    const link = {
      id:     generateId(),
      name,
      url,
      favicon: getEmoji(url),
    };

    links.push(link);
    saveLinks();
    renderLinks();
    hideAddForm();
    showToast(`Tautan "${name}" ditambahkan!`, 'success');
  }

  /**
   * Removes a link by ID.
   * @param {string} id
   * @param {Event} event - Original click event (to stop propagation)
   */
  function deleteLink(id, event) {
    event.preventDefault();
    event.stopPropagation();

    const idx = links.findIndex((l) => l.id === id);
    if (idx === -1) return;

    const name = links[idx].name;
    links.splice(idx, 1);
    saveLinks();
    renderLinks();
    showToast(`Tautan "${name}" dihapus.`, 'info');
  }

  // ---- Rendering -------------------------------------------

  /**
   * Builds a single link card element safely.
   * @param {Object} link
   * @returns {HTMLElement}
   */
  function createLinkElement(link) {
    const anchor = document.createElement('a');
    anchor.className = 'link-card';
    anchor.href      = link.url;
    anchor.target    = '_blank';
    anchor.rel       = 'noopener noreferrer'; // Security requirement (FR-4)
    anchor.setAttribute('aria-label', `Buka ${link.name}`);

    // Favicon / emoji
    const faviconSpan = document.createElement('span');
    faviconSpan.className   = 'link-card-favicon';
    faviconSpan.textContent = link.favicon || getEmoji(link.url);
    faviconSpan.setAttribute('aria-hidden', 'true');

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className   = 'link-card-name';
    nameSpan.textContent = link.name; // Safe: textContent

    // Delete button (stops propagation so the link doesn't open)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'link-card-delete';
    deleteBtn.setAttribute('aria-label', `Hapus tautan ${link.name}`);
    deleteBtn.textContent = '✕';
    deleteBtn.addEventListener('click', (e) => deleteLink(link.id, e));

    anchor.appendChild(faviconSpan);
    anchor.appendChild(nameSpan);
    anchor.appendChild(deleteBtn);

    return anchor;
  }

  /** Re-renders the full links grid. */
  function renderLinks() {
    const grid    = document.getElementById('links-grid');
    const emptyEl = document.getElementById('links-empty');

    if (!grid) return;

    grid.textContent = '';

    links.forEach((link) => {
      grid.appendChild(createLinkElement(link));
    });

    const isEmpty = links.length === 0;
    emptyEl?.classList.toggle('hidden', !isEmpty);
    grid.classList.toggle('hidden', isEmpty);
  }

  function init() {
    loadLinks();
    renderLinks();

    // Toggle form visibility
    document.getElementById('btn-add-link')
      ?.addEventListener('click', () => {
        const form = document.getElementById('form-add-link');
        if (form?.classList.contains('hidden')) {
          showAddForm();
        } else {
          hideAddForm();
        }
      });

    document.getElementById('btn-save-link')
      ?.addEventListener('click', saveNewLink);

    document.getElementById('btn-cancel-link')
      ?.addEventListener('click', hideAddForm);

    // Save on Enter in URL field
    document.getElementById('input-link-url')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  saveNewLink();
        if (e.key === 'Escape') hideAddForm();
      });

    document.getElementById('input-link-name')
      ?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          document.getElementById('input-link-url')?.focus();
        }
        if (e.key === 'Escape') hideAddForm();
      });

    // Clear error on URL input change
    document.getElementById('input-link-url')
      ?.addEventListener('input', () => {
        const urlInput = document.getElementById('input-link-url');
        const errorEl  = document.getElementById('link-error');
        clearInputError(urlInput, errorEl);
      });
  }

  return { init };
})();

/* ============================================================
   SHARED FORM UTILITIES
   ============================================================ */

/**
 * Shows an inline error message below an input field.
 * @param {HTMLElement} inputEl
 * @param {HTMLElement} errorEl
 * @param {string}      message
 */
function showInputError(inputEl, errorEl, message) {
  if (inputEl) inputEl.classList.add('error');
  if (errorEl) {
    errorEl.textContent = message; // Safe: textContent
    errorEl.classList.remove('hidden');
  }
}

/**
 * Clears an inline error message.
 * @param {HTMLElement} inputEl
 * @param {HTMLElement} errorEl
 */
function clearInputError(inputEl, errorEl) {
  if (inputEl) inputEl.classList.remove('error');
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
}

/* ============================================================
   10. APP INITIALIZER
   ============================================================ */

/**
 * Bootstraps the entire dashboard.
 * Each manager initialises independently; order matters only for ClockManager
 * (must run after UsernameManager to reflect the saved name immediately).
 */
function initApp() {
  ThemeManager.init();    // CF-1: Apply saved theme first (prevents flash)
  UsernameManager.init(); // CF-2: Set up username editing
  ClockManager.init();    // FR-1: Start clock (reads username for greeting)
  TimerManager.init();    // FR-2: Pomodoro timer
  TaskManager.init();     // FR-3 + CF-3: Task list with duplicate prevention
  LinksManager.init();    // FR-4: Quick links
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
