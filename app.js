"use strict";

const STORAGE_KEY = "day-by-day.habits.v1";
const form = document.querySelector("#habit-form");
const nameInput = document.querySelector("#habit-name");
const habitList = document.querySelector("#habit-list");
const errorMessage = document.querySelector("#error-message");
const announcement = document.querySelector("#announcement");
const theme = window.habitTheme;
const themeToggle = document.querySelector("#theme-toggle");
const themeError = document.querySelector("#theme-error");
let habits = [];
let displayedDate = "";

function updateThemeControl() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeError.textContent = theme.error;
  themeError.hidden = !theme.error;
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(theme.storageKey, next);
    theme.preference = next;
    theme.error = "";
    theme.apply();
    announcement.textContent = `${next === "dark" ? "Dark" : "Light"} mode enabled and saved.`;
  } catch (error) {
    console.error("Could not save theme preference:", error);
    theme.error = "Your theme choice could not be saved. Enable browser storage or free some space and try again.";
  }
  updateThemeControl();
});

theme.system.addEventListener("change", () => {
  if (theme.preference === null) {
    theme.apply();
    updateThemeControl();
  }
});
updateThemeControl();

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return localDateKey(date) === value;
}

function currentStreak(completions, today = new Date()) {
  const completed = new Set(completions);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let streak = 0;
  while (completed.has(localDateKey(cursor))) {
    streak += 1;
    // Calendar arithmetic keeps consecutive dates correct across DST changes.
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function lastSevenDays(today) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    date.setDate(date.getDate() - 6 + index);
    return date;
  });
}

function createWeeklyView(completions, today) {
  const week = document.createElement("ul");
  week.className = "weekly-view";
  week.setAttribute("aria-label", "Last 7 days, ending today");
  for (const date of lastSevenDays(today)) {
    const key = localDateKey(date);
    const completed = completions.includes(key);
    const label = `${date.toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    })}: ${completed ? "completed" : "not completed"}`;
    const day = document.createElement("li");
    day.className = `week-day${completed ? " is-completed" : ""}`;
    day.title = label;
    const weekday = document.createElement("span");
    weekday.className = "week-label";
    weekday.setAttribute("aria-hidden", "true");
    weekday.textContent = key === localDateKey(today) ? "Today" :
      date.toLocaleDateString(undefined, { weekday: "short" });
    const box = document.createElement("time");
    box.className = "week-box";
    box.dateTime = key;
    const number = document.createElement("span");
    number.setAttribute("aria-hidden", "true");
    number.textContent = String(date.getDate());
    const description = document.createElement("span");
    description.className = "sr-only";
    description.textContent = label;
    box.append(number, description);
    day.append(weekday, box);
    week.append(day);
  }
  return week;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function loadHabits() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      errorMessage.hidden = true;
      return;
    }
    const data = JSON.parse(stored);
    if (!data || data.version !== 1 || !Array.isArray(data.habits)) {
      throw new Error("Unrecognized habit data.");
    }
    const ids = new Set();
    for (const habit of data.habits) {
      if (!habit || typeof habit.id !== "string" || !habit.id || ids.has(habit.id) ||
          typeof habit.name !== "string" || !habit.name.trim() || habit.name.length > 80 ||
          !Array.isArray(habit.completions) || !habit.completions.every(isValidDateKey)) {
        throw new Error("Invalid habit data.");
      }
      ids.add(habit.id);
    }
    habits = data.habits;
    errorMessage.hidden = true;
  } catch (error) {
    console.error("Could not load habits:", error);
    showError("Your saved habits could not be loaded. Check that browser storage is available. Adding a habit will replace unreadable saved data.");
  }
}

function saveHabits(nextHabits) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, habits: nextHabits }));
    habits = nextHabits;
    errorMessage.hidden = true;
    render();
    return true;
  } catch (error) {
    console.error("Could not save habits:", error);
    showError("Your change could not be saved. Browser storage may be full or disabled. Please free some space or enable local storage and try again.");
    return false;
  }
}

function toggleHabit(id) {
  const today = localDateKey(new Date());
  const habit = habits.find((item) => item.id === id);
  if (!habit) return;
  const wasDone = habit.completions.includes(today);
  const nextHabits = habits.map((item) => item.id !== id ? item : {
    ...item,
    completions: wasDone
      ? item.completions.filter((date) => date !== today)
      : [...item.completions, today],
  });
  if (saveHabits(nextHabits)) {
    announcement.textContent = `${habit.name} ${wasDone ? "unmarked" : "completed"} for today.`;
    const buttons = habitList.querySelectorAll(".toggle-button");
    buttons[habits.findIndex((item) => item.id === id)].focus();
  }
}

function render() {
  const now = new Date();
  displayedDate = localDateKey(now);
  document.querySelector("#today").textContent = now.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const doneCount = habits.filter((habit) => habit.completions.includes(displayedDate)).length;
  document.querySelector("#progress").textContent = `${doneCount} of ${habits.length} done today`;
  document.querySelector("#progress-fill").style.width = `${habits.length ? doneCount / habits.length * 100 : 0}%`;
  document.querySelector("#empty-state").hidden = habits.length > 0;
  habitList.replaceChildren();

  for (const habit of habits) {
    const done = habit.completions.includes(displayedDate);
    const streak = currentStreak(habit.completions, now);
    const card = document.createElement("article");
    card.className = `habit-card${done ? " is-done" : ""}`;
    const symbol = document.createElement("span");
    symbol.className = "habit-symbol";
    symbol.textContent = "↗";
    symbol.setAttribute("aria-hidden", "true");
    const details = document.createElement("div");
    details.className = "habit-details";
    const title = document.createElement("h3");
    title.textContent = habit.name;
    const streakText = document.createElement("p");
    streakText.className = "streak";
    streakText.title = "Consecutive completed days ending today. Complete today to continue your streak.";
    const streakValue = document.createElement("strong");
    streakValue.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
    streakText.append(streakValue, " current streak");
    details.append(title, streakText, createWeeklyView(habit.completions, now));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toggle-button";
    button.setAttribute("aria-pressed", String(done));
    button.setAttribute("aria-label", `${done ? "Undo today's completion for" : "Mark done today:"} ${habit.name}`);
    const check = document.createElement("span");
    check.className = "check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = done ? "✓" : "";
    button.append(check, done ? "Done today" : "Mark done");
    button.addEventListener("click", () => toggleHabit(habit.id));
    card.append(symbol, details, button);
    habitList.append(card);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.setCustomValidity("Please enter a habit name.");
    nameInput.reportValidity();
    return;
  }
  if (saveHabits([...habits, { id: crypto.randomUUID(), name, completions: [] }])) {
    nameInput.value = "";
    nameInput.focus();
    announcement.textContent = `${name} added.`;
  }
});

nameInput.addEventListener("input", () => nameInput.setCustomValidity(""));

function refreshDate() {
  if (displayedDate !== localDateKey(new Date())) render();
}

window.addEventListener("focus", refreshDate);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshDate();
});
window.addEventListener("storage", (event) => {
  if (event.key === theme.storageKey || event.key === null) {
    theme.load();
    updateThemeControl();
  }
  if (event.key === STORAGE_KEY || event.key === null) {
    habits = [];
    loadHabits();
    render();
  }
});
setInterval(refreshDate, 1000);
loadHabits();
render();
