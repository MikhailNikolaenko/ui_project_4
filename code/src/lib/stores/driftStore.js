import { writable } from "svelte/store";
import { browser } from "$app/environment";

// ---------- HELPERS ----------

function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- LOAD ----------

const initial = browser
  ? JSON.parse(localStorage.getItem("drift") || "{}")
  : {};

// ---------- STORE ----------

function createDriftStore() {
  const { subscribe, update } = writable({
    minutesToday: initial.minutesToday || 0,
    coins: initial.coins || 0,
    history: initial.history || [],
    daily: initial.daily || {},

    activityTypes: initial.activityTypes || {
      doom: ["TikTok", "Instagram", "YouTube", "Twitter", "Reddit"],
      good: ["Read", "Gym", "Code", "Journal", "Music"]
    }
  });

  if (browser) {
    subscribe((v) => {
      localStorage.setItem("drift", JSON.stringify(v));
    });
  }

  return {
    subscribe,

    // Custom activity
    addActivityType: (type, name) =>
      update((s) => ({
        ...s,
        activityTypes: {
          ...s.activityTypes,
          [type]: [...s.activityTypes[type], name]
        }
      })),

    // Doom logging
    addMinutes: (minutes, activity) =>
      update((s) => {
        const date = todayKey();
        const day = s.daily[date] || { doom: 0, good: 0 };

        s.history.push({
          id: uid(),
          timestamp: Date.now(),
          dateKey: date,
          activity,
          category: "doom",
          minutes,
          coinsDelta: 0,
          source: "button"
        });

        return {
          ...s,
          minutesToday: s.minutesToday + minutes,
          daily: {
            ...s.daily,
            [date]: { doom: day.doom + minutes, good: day.good }
          }
        };
      }),

    // Good logging
    replaceWithMinutes: (activity, minutes, coinsGained) =>
      update((s) => {
        const date = todayKey();
        const day = s.daily[date] || { doom: 0, good: 0 };

        s.history.push({
          id: uid(),
          timestamp: Date.now(),
          dateKey: date,
          activity,
          category: "good",
          minutes,
          coinsDelta: coinsGained,
          source: "drag"
        });

        return {
          ...s,
          minutesToday: Math.max(s.minutesToday - minutes, 0),
          coins: s.coins + coinsGained,
          daily: {
            ...s.daily,
            [date]: { doom: day.doom, good: day.good + minutes }
          }
        };
      }),

    // Reset all data
    resetAll: () =>
      update((s) => ({
        ...s,
        minutesToday: 0,
        coins: 0,
        history: [],
        daily: {}
      })),

      removeActivityType(type, name) {
        update(state => {
          return {
            ...state,
            activityTypes: {
              ...state.activityTypes,
              [type]: state.activityTypes[type].filter(n => n !== name)
            }
          };
        });
      }
      ,

    // Simulate a month of data
    simulateMonth: () =>
      update((s) => {
        const doomApps =
          s.activityTypes?.doom?.length
            ? s.activityTypes.doom
            : ["Simulated Doom"];

        const goodActs =
          s.activityTypes?.good?.length
            ? s.activityTypes.good
            : ["Simulated Good"];


        const newDaily = {};
        const newHistory = [];
        let newCoins = 0;

        for (let offset = -29; offset <= 0; offset++) {
          const dateKey = todayKey(offset);

          let doomTotal = 0;
          let goodTotal = 0;

          const doomSessions = Math.floor(Math.random() * 4) + 1;
          for (let i = 0; i < doomSessions; i++) {
            const minutes = (Math.floor(Math.random() * 8) + 1) * 5;
            const activity =
              doomApps[Math.floor(Math.random() * doomApps.length)];

            doomTotal += minutes;

            newHistory.push({
              id: uid(),
              timestamp: Date.now(),
              dateKey,
              activity,
              category: "doom",
              minutes,
              coinsDelta: 0,
              source: "sim"
            });
          }

          const goodSessions = Math.floor(Math.random() * 3);
          for (let i = 0; i < goodSessions; i++) {
            const minutes = (Math.floor(Math.random() * 10) + 1) * 5;
            const activity =
              goodActs[Math.floor(Math.random() * goodActs.length)];
            const coinsDelta = Math.max(1, Math.round(Math.log2(minutes)));

            goodTotal += minutes;
            newCoins += coinsDelta;

            newHistory.push({
              id: uid(),
              timestamp: Date.now(),
              dateKey,
              activity,
              category: "good",
              minutes,
              coinsDelta,
              source: "sim"
            });
          }

          newDaily[dateKey] = { doom: doomTotal, good: goodTotal };
        }

        const todayKeyStr = todayKey();
        const todayDay = newDaily[todayKeyStr] || { doom: 0, good: 0 };
        const minutesToday = Math.max(todayDay.doom - todayDay.good, 0);

        return {
          ...s,
          daily: newDaily,
          history: newHistory,
          coins: newCoins,
          minutesToday
        };
      })
  };
}



export const drift = createDriftStore();
