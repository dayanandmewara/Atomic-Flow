/**
 * AtomicFlow Unified Application Logic - V3 Google-Style & Office-Optimized
 * Custom re-engineered for extreme Google-style simplicity, chronological routines aligned 
 * with the user's 9:00 AM - 6:30 PM office hours, and a dedicated, high-end sleep time logger.
 */

// =========================================================================
// 1. DATABASE MANAGER LAYER
// =========================================================================
const DB_PREFIX = 'atomicflow_';

class DatabaseManager {
    constructor() {
        this.habits = this._load('habits') || [];
        this.logs = this._load('logs') || {};
        this.blueprints = this._load('blueprints') || {
            identities: [
                { id: '1', title: 'A clean, self-respecting person', proof: 'Keep a clean hygiene routine' },
                { id: '2', title: 'An organized, mindful system designer', proof: 'Maintain arranged and tidy environment' }
            ],
            stacks: []
        };
        this.settings = this._load('settings') || {
            theme: 'dark', // Google dark theme default
            sheetsUrl: '',
            userName: 'Achiever',
            autoSync: false,
            xp: 0
        };
        this.tasks = this._load('tasks') || [];

        // V4: Ensure theme is migrated to dark mode once
        if (!this.settings.themeMigratedToDark) {
            this.settings.theme = 'dark';
            this.settings.themeMigratedToDark = true;
            this._save('settings', this.settings);
        }

        // V5: Force patch to seed home-only routines and remove old office routines
        if (this.habits.length === 0 || this.habits.some(h => h.id === 'h_sleep') || this.habits.some(h => h.id === 'h_cleaning') || !this.habits.some(h => h.id === 'h_hygiene')) {
            this._seedSampleData();
        }
    }

    _save(key, data) {
        localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
        
        // Auto Sync to Google Sheets if configured
        if (this.settings.sheetsUrl && this.settings.autoSync && key !== 'settings') {
            this.pushToGoogleSheets().catch(err => console.error("Auto-sync failed:", err));
        }
    }

    _load(key) {
        const data = localStorage.getItem(DB_PREFIX + key);
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error(`Error loading key: ${key}`, e);
            return null;
        }
    }

    getHabits() {
        return this.habits.filter(h => h.active !== false);
    }

    saveHabit(habit) {
        if (habit.id) {
            const index = this.habits.findIndex(h => h.id === habit.id);
            if (index !== -1) {
                this.habits[index] = { ...this.habits[index], ...habit, updatedAt: Date.now() };
            }
        } else {
            habit.id = 'h_' + Date.now();
            habit.createdAt = Date.now();
            habit.updatedAt = Date.now();
            habit.active = true;
            if (!habit.timeOfDay) habit.timeOfDay = 'morning';
            this.habits.push(habit);
        }
        this._save('habits', this.habits);
        return habit;
    }

    deleteHabit(id) {
        const index = this.habits.findIndex(h => h.id === id);
        if (index !== -1) {
            this.habits[index].active = false;
            this.habits[index].updatedAt = Date.now();
            this._save('habits', this.habits);
        }
    }

    getTasks() {
        return this.tasks.filter(t => t.active !== false);
    }

    saveTask(task) {
        if (task.id) {
            const index = this.tasks.findIndex(t => t.id === task.id);
            if (index !== -1) {
                this.tasks[index] = { ...this.tasks[index], ...task, updatedAt: Date.now() };
            }
        } else {
            task.id = 't_' + Date.now();
            task.createdAt = Date.now();
            task.updatedAt = Date.now();
            task.active = true;
            task.completed = false;
            if (!task.date) task.date = new Date().toISOString().split('T')[0];
            this.tasks.push(task);
        }
        this._save('tasks', this.tasks);
        return task;
    }

    deleteTask(id) {
        const index = this.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            this.tasks[index].active = false;
            this.tasks[index].updatedAt = Date.now();
            this._save('tasks', this.tasks);
        }
    }

    getLogForDate(dateStr) {
        if (!this.logs[dateStr]) {
            return {
                date: dateStr,
                completions: {},
                mood: 0,
                energy: 0,
                journalNotes: '',
                wins: [],
                improvement: '',
                // V3 Sleep logging parameters
                sleepBedtime: '',
                sleepWakeup: '',
                sleepQuality: 0
            };
        }
        return this.logs[dateStr];
    }

    saveLogForDate(dateStr, logData) {
        this.logs[dateStr] = {
            ...this.getLogForDate(dateStr),
            ...logData,
            date: dateStr,
            updatedAt: Date.now()
        };
        this._save('logs', this.logs);
        return this.logs[dateStr];
    }

    toggleHabitCompletion(dateStr, habitId, isTwoMinute = false) {
        const log = this.getLogForDate(dateStr);
        let xpGained = 0;
        let isChecking = true;

        if (log.completions[habitId] && log.completions[habitId].completed) {
            delete log.completions[habitId];
            isChecking = false;
            xpGained = isTwoMinute ? -5 : -10;
        } else {
            log.completions[habitId] = {
                completed: true,
                isTwoMinute: isTwoMinute,
                completedAt: Date.now()
            };
            xpGained = isTwoMinute ? 5 : 10;
        }
        
        this.saveLogForDate(dateStr, log);
        this.addXp(xpGained);
        return { log, xpGained, isChecking };
    }

    addXp(amount) {
        this.settings.xp = Math.max(0, (this.settings.xp || 0) + amount);
        this._save('settings', this.settings);
        
        const appShell = window.globalAppInstance;
        if (appShell) {
            appShell.updateSidebarStats();
        }
    }

    getBlueprints() {
        return this.blueprints;
    }

    saveBlueprints(blueprints) {
        this.blueprints = { ...this.blueprints, ...blueprints };
        this._save('blueprints', this.blueprints);
    }

    getSettings() {
        return this.settings;
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this._save('settings', this.settings);
    }

    _seedSampleData() {
        // Aligned specifically to user's home routines (Morning and Evening)
        const sampleHabits = [
            {
                id: 'h_hygiene',
                name: 'Personal Hygiene Refresh',
                category: 'health',
                timeOfDay: 'morning', // Before office hours
                identity: 'A clean, self-respecting, and refreshed person',
                cue: 'Place clean towel & washbag visibly on the bathroom counter.',
                reward: 'Enjoy the refreshing, clean smell of soap and feeling fresh.',
                twoMinuteVersion: 'Brush teeth & wash face for 30 seconds.',
                stackTrigger: 'After I step out of bed in the morning',
                active: true,
                createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
                updatedAt: Date.now()
            },
            {
                id: 'h_arranging',
                name: 'Room Reset & Declutter',
                category: 'mind',
                timeOfDay: 'evening', // After office hours
                identity: 'A structured, mindful, and neat designer',
                cue: 'Keep a small declutter basket near my bedroom doorway.',
                reward: 'Relax looking at a perfectly reset, calm bedroom environment.',
                twoMinuteVersion: 'Place exactly 3 items back into their designated drawers.',
                stackTrigger: 'After I arrive home from the office',
                active: true,
                createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
                updatedAt: Date.now()
            }
        ];

        this.habits = sampleHabits;
        this._save('habits', this.habits);

        const today = new Date();
        this.logs = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const completions = {};
            if (Math.random() > 0.3) {
                completions['h_hygiene'] = { completed: true, isTwoMinute: Math.random() > 0.7, completedAt: Date.now() };
            }
            if (Math.random() > 0.3) {
                completions['h_arranging'] = { completed: true, isTwoMinute: Math.random() > 0.6, completedAt: Date.now() };
            }

            this.logs[dateStr] = {
                date: dateStr,
                completions,
                mood: Math.floor(Math.random() * 3) + 3,
                energy: Math.floor(Math.random() * 3) + 3,
                journalNotes: `Focused on core hygiene and reset room arrangement after returning from office. Sleeping early yields better days!`,
                wins: ['🎯 Met Habits', '😴 Slept 8 Hrs'],
                improvement: 'Keep phone outside bedroom before bedtime',
                // Seed sleep times (e.g. 10:30 PM to 6:30 AM = 8 hours)
                sleepBedtime: '22:30',
                sleepWakeup: '06:30',
                sleepQuality: 3,
                updatedAt: Date.now()
            };
        }
        this._save('logs', this.logs);
        this.settings.xp = 220;
        this.settings.theme = 'dark'; // Force dark theme for clean Google-style dark mode by default
        this._save('settings', this.settings);
    }

    async testSheetsConnection(url) {
        const testUrl = `${url}?action=test`;
        try {
            const res = await fetch(testUrl);
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const data = await res.json();
            return data.status === 'ok';
        } catch (e) {
            console.error("Connection failed:", e);
            throw e;
        }
    }

    async pushToGoogleSheets() {
        const url = this.settings.sheetsUrl;
        if (!url) return false;

        const payload = {
            action: 'push',
            habits: this.habits,
            logs: this.logs,
            blueprints: this.blueprints,
            tasks: this.tasks,
            timestamp: Date.now()
        };

        try {
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return true;
        } catch (e) {
            console.error("Failed to push data:", e);
            throw e;
        }
    }

    async pullFromGoogleSheets() {
        const url = this.settings.sheetsUrl;
        if (!url) return false;

        const pullUrl = `${url}?action=pull`;
        try {
            const res = await fetch(pullUrl);
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const data = await res.json();
            
            if (data.habits) {
                this.habits = data.habits;
                this._save('habits', this.habits);
            }
            if (data.logs) {
                this.logs = data.logs;
                this._save('logs', this.logs);
            }
            if (data.blueprints) {
                this.blueprints = data.blueprints;
                this._save('blueprints', this.blueprints);
            }
            if (data.tasks) {
                this.tasks = data.tasks;
                this._save('tasks', this.tasks);
            }
            return true;
        } catch (e) {
            console.error("Failed to pull data:", e);
            throw e;
        }
    }
}

const db = new DatabaseManager();

// =========================================================================
// 2. ATOMIC HABITS MATH LAYER
// =========================================================================
const AtomicManager = {
    calculateStreak(habitId) {
        const habits = db.getHabits();
        const logs = db.logs;
        const habit = habits.find(h => h.id === habitId);
        
        if (!habit) return { current: 0, longest: 0 };

        const dates = Object.keys(logs).sort();
        if (dates.length === 0) return { current: 0, longest: 0 };

        let longestStreak = 0;
        let tempStreak = 0;

        for (const dateStr of dates) {
            const log = logs[dateStr];
            const isCompleted = log.completions && log.completions[habitId] && log.completions[habitId].completed;
            if (isCompleted) {
                tempStreak++;
                if (tempStreak > longestStreak) longestStreak = tempStreak;
            } else {
                tempStreak = 0;
            }
        }

        const todayStr = new Date().toISOString().split('T')[0];
        let currentStreak = 0;
        let checkDate = new Date();
        let streakBroken = false;
        
        while (!streakBroken) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const log = logs[dateStr];
            const isCompleted = log && log.completions && log.completions[habitId] && log.completions[habitId].completed;

            if (isCompleted) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (dateStr === todayStr) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    const yestStr = checkDate.toISOString().split('T')[0];
                    const yestLog = logs[yestStr];
                    const yestCompleted = yestLog && yestLog.completions && yestLog.completions[habitId] && yestLog.completions[habitId].completed;
                    
                    if (yestCompleted) {
                        checkDate.setDate(checkDate.getDate() - 1);
                    } else {
                        streakBroken = true;
                    }
                } else {
                    streakBroken = true;
                }
            }
        }

        return { current: currentStreak, longest: longestStreak };
    },

    getNeverMissTwiceWarnings() {
        const habits = db.getHabits();
        const logs = db.logs;
        const todayStr = new Date().toISOString().split('T')[0];
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const warnings = [];

        for (const habit of habits) {
            const yesterdayLog = logs[yesterdayStr];
            const todayLog = logs[todayStr];

            const missedYesterday = !yesterdayLog || !yesterdayLog.completions || !yesterdayLog.completions[habit.id] || !yesterdayLog.completions[habit.id].completed;
            const pendingToday = !todayLog || !todayLog.completions || !todayLog.completions[habit.id] || !todayLog.completions[habit.id].completed;
            const wasActiveYesterday = habit.createdAt < (yesterday.getTime() + 24 * 60 * 60 * 1000);

            if (missedYesterday && pendingToday && wasActiveYesterday) {
                warnings.push(habit);
            }
        }
        return warnings;
    },

    getGlobalStats() {
        const habits = db.getHabits();
        const logs = db.logs;
        const dates = Object.keys(logs);
        
        if (habits.length === 0 && dates.length === 0) {
            return { consistencyScore: 0, totalCheckoffs: 0, twoMinRuleCount: 0, longestStreakGlobal: 0 };
        }

        let totalPossible = 0;
        let totalCompletions = 0;
        let twoMinRuleCount = 0;

        dates.forEach(d => {
            const log = logs[d];
            const logTime = new Date(d).getTime() + (24 * 60 * 60 * 1000);
            const activeHabitsOnDate = habits.filter(h => h.createdAt <= logTime);
            
            totalPossible += activeHabitsOnDate.length;
            
            if (log.completions) {
                Object.keys(log.completions).forEach(hId => {
                    const habitActive = habits.some(h => h.id === hId);
                    if (habitActive && log.completions[hId].completed) {
                        totalCompletions++;
                        if (log.completions[hId].isTwoMinute) twoMinRuleCount++;
                    }
                });
            }
        });

        let longestStreakGlobal = 0;
        habits.forEach(h => {
            const streak = this.calculateStreak(h.id);
            if (streak.longest > longestStreakGlobal) longestStreakGlobal = streak.longest;
        });

        const consistencyScore = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;

        return { consistencyScore, totalCheckoffs: totalCompletions, twoMinRuleCount, longestStreakGlobal };
    },

    getXpCalculations(xpPoints) {
        let level = 1;
        let title = "Habit Novice";
        let minXp = 0;
        let maxXp = 100;

        if (xpPoints >= 100 && xpPoints < 300) {
            level = 2;
            title = "System Builder";
            minXp = 100;
            maxXp = 300;
        } else if (xpPoints >= 300 && xpPoints < 600) {
            level = 3;
            title = "Atomic Achiever";
            minXp = 300;
            maxXp = 600;
        } else if (xpPoints >= 600 && xpPoints < 1000) {
            level = 4;
            title = "Identity Master";
            minXp = 600;
            maxXp = 1000;
        } else if (xpPoints >= 1000) {
            level = 5;
            title = "Master of Systems 👑";
            minXp = 1000;
            maxXp = 2500;
        }

        const range = maxXp - minXp;
        const progress = xpPoints - minXp;
        const percentage = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));

        return { level, title, percentage, nextXp: maxXp, currentXp: xpPoints };
    },

    // V3: Dynamic Sleep Duration Math
    calculateSleepDuration(bedtime, wakeup) {
        if (!bedtime || !wakeup) return 0;
        let [bedHour, bedMin] = bedtime.split(':').map(Number);
        let [wakeHour, wakeMin] = wakeup.split(':').map(Number);
        
        let bedDate = new Date(2020, 0, 1, bedHour, bedMin);
        let wakeDate = new Date(2020, 0, 1, wakeHour, wakeMin);
        
        if (wakeDate <= bedDate) {
            // Wake up is the next day
            wakeDate.setDate(wakeDate.getDate() + 1);
        }
        
        let diffMs = wakeDate - bedDate;
        let diffHrs = diffMs / (1000 * 60 * 60);
        return Math.round(diffHrs * 10) / 10;
    }
};

// =========================================================================
// 3. DASHBOARD VIEW COMPONENT (V3 CHRONOLOGICAL + GOOGLE SLEEP LOGGER)
// =========================================================================
const Dashboard = {
    selectedDate: new Date().toISOString().split('T')[0],
    activeFilter: 'all',
    activeTimeFilter: 'all', // 'all', 'morning', 'evening'
    activeTwoMinuteHabits: {},

    render(container) {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.activeFilter = 'all';
        
        // Smart Auto-Detect Time of Day: Morning before 12:00 PM, Evening after 5:00 PM
        const hour = new Date().getHours();
        if (hour < 12) {
            this.activeTimeFilter = 'morning';
        } else if (hour >= 17) {
            this.activeTimeFilter = 'evening';
        } else {
            this.activeTimeFilter = 'all';
        }
        
        this.container = container;
        this.updateView();
    },

    updateView() {
        const habits = db.getHabits();
        const blueprints = db.getBlueprints();
        const log = db.getLogForDate(this.selectedDate);
        
        // V4: Category + Time of Day dual-filter system
        const filteredHabits = habits.filter(h => {
            const matchesCategory = this.activeFilter === 'all' || h.category === this.activeFilter;
            const matchesTime = this.activeTimeFilter === 'all' || h.timeOfDay === this.activeTimeFilter;
            return matchesCategory && matchesTime;
        });

        const warnings = AtomicManager.getNeverMissTwiceWarnings();
        const stats = this._getDayStats(log, habits);

        let warningBannerHtml = '';
        if (warnings.length > 0 && this.selectedDate === new Date().toISOString().split('T')[0]) {
            warningBannerHtml = `
                <div class="warning-banner" style="margin-bottom: 1.5rem;">
                    <i data-lucide="alert-triangle" style="stroke-width: 2.5px;"></i>
                    <span><strong>Never Miss Twice Reminder:</strong> You missed yesterday's routines. Let's make 1% progress today!</span>
                </div>
            `;
        }

        const winsText = Array.isArray(log.wins) ? log.wins.join('\n') : (log.wins || '');
        const hardText = log.hard || '';
        const anxietyText = log.anxiety || '';
        const freeText = log.journalNotes || log.free || '';

        // Render clean decluttered Google-style dashboard layout
        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                ${warningBannerHtml}
                
                <div class="view-grid">
                    <!-- Left: Identity-Grouped Checklist -->
                    <div style="grid-column: span 8; display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Date & Category filter panel -->
                        <div class="glass-card" style="padding: 0.75rem 1.25rem; border-radius: var(--radius-md);">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                                <div style="display: flex; gap: 0.25rem;">
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'all' ? 'active-filter' : ''}" data-filter="all" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: 16px; border: none; font-weight: 500;">All</button>
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'health' ? 'active-filter' : ''}" data-filter="health" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: 16px; border: none; font-weight: 500;">🧼 Hygiene & Health</button>
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'mind' ? 'active-filter' : ''}" data-filter="mind" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; border-radius: 16px; border: none; font-weight: 500;">🧹 Room & Cleanliness</button>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.25rem;">
                                    <button class="btn btn-secondary" id="btn-prev-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i></button>
                                    <input type="date" id="dashboard-date-picker" class="form-control" value="${this.selectedDate}" style="padding: 0.3rem 0.5rem; font-size: 0.85rem; width: 130px; border-radius: 16px; height: auto; text-align: center; border: 1px solid var(--border-color);">
                                    <button class="btn btn-secondary" id="btn-next-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i></button>
                                </div>
                            </div>
                        </div>

                        <!-- Main Checklist Card (Decluttered & Correlated with Blueprints) -->
                        <div class="glass-card" style="padding: 1.5rem 1.5rem; border-radius: var(--radius-md);">
                            <div class="card-header-flex" style="margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                                <div>
                                    <h3 class="card-title" style="font-size: 1.15rem; font-weight: 500;"><i data-lucide="check-circle" style="color: var(--primary); width: 20px; height: 20px;"></i> Daily Systems Checklist</h3>
                                    <p class="card-subtitle" style="font-size: 0.8rem;">Daily routines grouped by identity (home time only).</p>
                                </div>

                                <!-- V4 Segmented Time of Day Filter -->
                                <div class="time-filter-segmented" style="display: inline-flex; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 20px; padding: 2px; height: fit-content; align-self: center;">
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'all' ? 'active-segment' : ''}" data-time="all" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">✨ All</button>
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'morning' ? 'active-segment' : ''}" data-time="morning" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">🌅 Morning</button>
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'evening' ? 'active-segment' : ''}" data-time="evening" style="padding: 0.25rem 0.75rem; font-size: 0.75rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">🌙 Evening</button>
                                </div>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                ${this._renderGroupedHabits(filteredHabits, log, blueprints.identities)}
                            </div>
                        </div>

                        <!-- Daily Focus Tasks Card (Phase 11) -->
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); margin-top: 1.5rem;">
                            <div class="card-header-flex" style="margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div>
                                    <h3 class="card-title" style="font-size: 1.1rem; font-weight: 500; display: flex; align-items: center; gap: 6px;">
                                        <i data-lucide="check-square" style="color: var(--primary); width: 18px; height: 18px;"></i> Daily Focus Tasks
                                    </h3>
                                    <p class="card-subtitle" style="font-size: 0.78rem;">One-off focus tasks to accomplish today alongside your recurring habits.</p>
                                </div>
                                <span style="font-size: 0.72rem; font-weight: 700; background: var(--sidebar-active-bg); color: var(--primary); padding: 2px 8px; border-radius: 8px;" id="tasks-count-badge">
                                    0 Tasks Done
                                </span>
                            </div>

                            <!-- Task input form -->
                            <form id="new-task-form" style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem;">
                                <input type="text" id="task-input-text" class="form-control" placeholder="Add a simple daily task (e.g. Wash clothes, buy soap)..." style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" required>
                                <button type="submit" class="btn btn-primary" style="padding: 0.5rem 1rem; border-radius: 12px; font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <i data-lucide="plus" style="width: 14px; height: 14px;"></i> Add
                                </button>
                            </form>

                            <!-- Task items list -->
                            <div id="tasks-list-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
                                ${this._renderTasksListMarkup(this.selectedDate)}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Sleep Logger & Completion stats & Reflections Preview -->
                    <div style="grid-column: span 4; display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Completion card -->
                        <div class="glass-card text-center" style="display: flex; flex-direction: column; align-items: center; padding: 1.5rem; border-radius: var(--radius-md);">
                            <h4 style="font-size: 0.95rem; font-weight: 500; margin-bottom: 1rem; color: var(--text-primary);">Routines Completed</h4>
                            
                            <div class="progress-ring-container" style="width: 100px; height: 100px; margin-bottom: 1rem;">
                                <svg width="100" height="100">
                                    <circle stroke="var(--border-color)" stroke-width="6" fill="transparent" r="42" cx="50" cy="50"/>
                                    <circle class="progress-ring-circle" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" fill="transparent" r="42" cx="50" cy="50" 
                                        stroke-dasharray="263.8" stroke-dashoffset="${263.8 - (263.8 * stats.pct) / 100}"/>
                                </svg>
                                <div class="progress-percentage" style="font-size: 1.25rem; font-weight: 700;">${stats.pct}%</div>
                            </div>

                            <div style="display: flex; width: 100%; border-top: 1px solid var(--border-color); padding-top: 0.75rem; font-size: 0.85rem;">
                                <div style="flex: 1; text-align: center;">
                                    <div style="font-weight: 700; color: var(--color-success);">${stats.done}</div>
                                    <div style="color: var(--text-secondary); font-size: 0.75rem;">Met</div>
                                </div>
                                <div style="flex: 1; text-align: center; border-left: 1px solid var(--border-color);">
                                    <div style="font-weight: 700; color: var(--text-muted);">${stats.pending}</div>
                                    <div style="color: var(--text-secondary); font-size: 0.75rem;">Left</div>
                                </div>
                            </div>
                        </div>

                        <!-- Dedicated Bedtime Logger Card -->
                        <div class="glass-card" style="padding: 1.25rem 1.5rem; border-radius: var(--radius-md);">
                            <h4 style="font-size: 1rem; font-weight: 500; display: flex; align-items: center; gap: 6px; margin-bottom: 0.75rem; color: var(--text-primary);">
                                <i data-lucide="moon" style="color: var(--primary); width: 18px; height: 18px;"></i> Bedtime & Sleep Logger
                            </h4>
                            <div id="sleep-card-content-root">
                                ${this._renderSleepLoggerCard(log)}
                            </div>
                        </div>

                        <!-- Correlated Daily Reflection Summary Card -->
                        ${(log.mood > 0 || winsText || hardText || anxietyText || freeText) ? `
                        <div class="glass-card" style="padding: 1.25rem 1.5rem; border-radius: var(--radius-md);">
                            <h4 style="font-size: 1rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; color: var(--text-primary);">
                                <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="book-open" style="color: var(--primary); width: 18px; height: 18px;"></i> Day Reflection Log</span>
                                <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; background: var(--sidebar-active-bg); padding: 2px 8px; border-radius: 8px;">Saved</span>
                            </h4>
                            <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.55rem;">
                                <div style="display: flex; gap: 1rem; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px; margin-bottom: 2px;">
                                    <div>Mood: <strong style="font-size: 1rem;">${["😔", "😐", "🙂", "😊", "😄"][log.mood - 1] || 'None'}</strong></div>
                                    <div style="border-left: 1px solid var(--border-color); padding-left: 10px;">Energy: <strong>${log.energy || 3} / 5</strong></div>
                                </div>
                                ${winsText ? `<div><strong>Today's Win 🏆:</strong> <span style="color: var(--text-secondary);">${winsText}</span></div>` : ''}
                                ${hardText ? `<div><strong>What was Hard 💪:</strong> <span style="color: var(--text-secondary);">${hardText}</span></div>` : ''}
                                ${anxietyText ? `<div><strong>Anxiety Parking Lot 🅿️:</strong> <span style="color: var(--text-secondary);">${anxietyText}</span></div>` : ''}
                                ${freeText ? `<div style="border-top: 1px dashed var(--border-color); padding-top: 6px; font-style: italic; color: var(--text-muted);">"${freeText.length > 100 ? freeText.substring(0, 100) + '...' : freeText}"</div>` : ''}
                                
                                <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
                                    <a href="#journal" class="btn btn-secondary" style="font-size: 0.72rem; padding: 3px 8px; border-radius: 8px; font-weight: 600; text-decoration: none; border: 1px solid var(--border-color); color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px;">
                                        <i data-lucide="edit-3" style="width: 10px; height: 10px;"></i> Revisit & Edit
                                    </a>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
    },

    // V3: Google-style Sleep Logger card template renderer
    _renderSleepLoggerCard(log) {
        const bedtime = log.sleepBedtime || '';
        const wakeup = log.sleepWakeup || '';
        const quality = log.sleepQuality || 0;

        if (bedtime && wakeup) {
            // Already logged! Show Google Tasks-style completed view
            const duration = AtomicManager.calculateSleepDuration(bedtime, wakeup);
            
            const qualityLabels = ["Restless 😢", "Okay 😐", "Refreshed 😄"];
            const isHealthy = duration >= 7 && duration <= 9;
            const healthColor = isHealthy ? 'var(--color-success)' : 'var(--color-warning)';
            
            // Format military time to beautiful AM/PM format
            const formatTime = (t) => {
                let [h, m] = t.split(':').map(Number);
                let ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12;
                h = h ? h : 12; // 0 becomes 12
                m = m < 10 ? '0' + m : m;
                return `${h}:${m} ${ampm}`;
            };

            return `
                <div class="animate-fade-in" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0.25rem 0;">
                    <div style="display: flex; align-items: center; gap: 10px; background: rgba(30, 142, 62, 0.05); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(30, 142, 62, 0.15);">
                        <i data-lucide="check-circle-2" style="color: var(--color-success); width: 22px; height: 22px; flex-shrink: 0;"></i>
                        <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">
                            Logged Bedtime: <strong>${formatTime(bedtime)}</strong> &rarr; <strong>${formatTime(wakeup)}</strong>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 0.75rem; font-size: 0.8rem; margin-top: 0.25rem;">
                        <div style="flex: 1; background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); text-align: center;">
                            <span style="display: block; font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Duration</span>
                            <span style="font-size: 1.1rem; font-weight: 700; color: ${healthColor};">${duration} hrs</span>
                            <span style="display: block; font-size: 0.65rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                                ${isHealthy ? 'Healthy Sleep 💚' : 'Outside Target ⚠️'}
                            </span>
                        </div>
                        <div style="flex: 1; background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); text-align: center;">
                            <span style="display: block; font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Quality</span>
                            <span style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">${qualityLabels[quality - 1] || 'Okay 😐'}</span>
                            <span style="display: block; font-size: 0.65rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">Subjective score</span>
                        </div>
                    </div>
                    
                    <button class="btn btn-secondary" id="btn-edit-sleep" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 12px; margin-top: 0.5rem; width: fit-content; align-self: flex-end;"><i data-lucide="edit-3" style="width: 12px; height: 12px;"></i> Adjust Logs</button>
                </div>
            `;
        } else {
            // Not logged yet! Show Google Keep-Style input form
            return `
                <form id="sleep-logger-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Bedtime</label>
                            <input type="time" id="sleep-bedtime-input" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" value="22:30" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Wake Up</label>
                            <input type="time" id="sleep-wakeup-input" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" value="06:30" required>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Rest Quality</label>
                        <select id="sleep-quality-select" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                            <option value="3" selected>😄 Fully Refreshed & Energized</option>
                            <option value="2">😐 Rested (Okay Sleep)</option>
                            <option value="1">😢 Restless (Tired / Interrupted)</option>
                        </select>
                    </div>

                    <button type="submit" class="btn btn-primary" style="padding: 0.45rem 1rem; font-size: 0.8rem; border-radius: 12px; font-weight: 600; margin-top: 0.25rem;"><i data-lucide="moon"></i> Save Log & +20 XP</button>
                </form>
            `;
        }
    },

    _renderGroupedHabits(habits, log, identities) {
        if (habits.length === 0) {
            return `
                <div class="text-center" style="padding: 2.5rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); background: var(--bg-primary);">
                    <i data-lucide="sparkles" style="width: 32px; height: 32px; color: var(--text-muted); margin-bottom: 8px;"></i>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">No routines scheduled. Go to the <a href="#blueprint" style="color: var(--primary); font-weight: 600; text-decoration: none;">Blueprints tab</a> to forge your first identity-driven habits!</p>
                </div>
            `;
        }

        const grouped = {};
        identities.forEach(idObj => {
            grouped[idObj.title] = [];
        });
        const general = [];

        habits.forEach(h => {
            if (h.identity && grouped[h.identity] !== undefined) {
                grouped[h.identity].push(h);
            } else {
                general.push(h);
            }
        });

        let html = '';

        // Render each active identity group
        identities.forEach(idObj => {
            const groupHabits = grouped[idObj.title];
            if (groupHabits.length > 0) {
                html += `
                    <div style="background: var(--bg-primary); padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); border-left: 4px solid var(--primary); margin-bottom: 0.75rem;">
                        <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="fingerprint" style="width: 14px; height: 14px; color: var(--primary);"></i> Identity Pillar: "${idObj.title}"
                        </h4>
                        <p style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 0.75rem; font-style: italic;">Daily Proof: ${idObj.proof}</p>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${this._renderHabitListMarkup(groupHabits, log)}
                        </div>
                    </div>
                `;
            }
        });

        // Render general habits group
        if (general.length > 0) {
            html += `
                <div style="background: var(--bg-primary); padding: 1rem 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); border-left: 4px solid var(--color-info); margin-bottom: 0.75rem;">
                    <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="layers" style="width: 14px; height: 14px; color: var(--color-info);"></i> 🌱 Core Daily Routines
                    </h4>
                    <p style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 0.75rem; font-style: italic;">Supporting home habits</p>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${this._renderHabitListMarkup(general, log)}
                    </div>
                </div>
            `;
        }

        return html;
    },

    _renderHabitListMarkup(groupHabits, log) {
        return groupHabits.map((habit) => {
            const completion = log.completions && log.completions[habit.id];
            const isCompleted = !!(completion && completion.completed);
            const isTwoMinuteSelected = completion ? completion.isTwoMinute : !!this.activeTwoMinuteHabits[habit.id];
            const streak = AtomicManager.calculateStreak(habit.id);
            const isHot = streak.current >= 5;
            
            // Render beautiful clean habit cards with time of day tags
            const timeTag = habit.timeOfDay === 'morning' ? '🌅 Morning' : '🌙 Evening';
            
            return `
                <div class="habit-card ${isCompleted ? 'completed' : ''} animate-fade-in" data-id="${habit.id}" style="padding: 0.85rem 1rem; border-radius: var(--radius-md); position: relative;">
                    <label class="checkbox-wrapper" style="width: 28px; height: 28px; margin-bottom: 0;">
                        <input type="checkbox" class="habit-check" ${isCompleted ? 'checked' : ''}>
                        <span class="checkmark" style="width: 28px; height: 28px;"><i data-lucide="check" style="font-size: 0.95rem;"></i></span>
                    </label>

                    <div class="habit-details">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="habit-name" style="font-size: 0.95rem; font-weight: 500;">${habit.name}</span>
                            <span class="habit-category cat-${habit.category}" style="font-size: 0.65rem; padding: 1px 6px;">${habit.category}</span>
                            <span style="font-size: 0.65rem; padding: 1px 6px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-secondary);">${timeTag}</span>
                        </div>
                        <p class="habit-desc" style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                            ${isTwoMinuteSelected 
                                ? `<strong style="color: var(--primary);">⚡ 2-Min Version Active:</strong> ${habit.twoMinuteVersion || 'Quick start.'}`
                                : (habit.stackTrigger ? `After I <strong>${habit.stackTrigger}</strong>, I will complete this.` : 'Repetitions build identity.')
                            }
                        </p>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
                        ${habit.twoMinuteVersion && !isCompleted ? `
                            <button class="btn btn-secondary btn-twomin-trigger ${isTwoMinuteSelected ? 'active' : ''}" style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: transparent; border-color: var(--border-color); color: var(--text-secondary);" title="Low energy alternative">
                                ⚡ ${isTwoMinuteSelected ? 'Normal' : '2-Min'}
                            </button>
                        ` : ''}

                        <div class="streak-badge ${isHot ? 'hot' : ''}" style="font-size: 0.75rem; padding: 0.2rem 0.4rem;" title="${streak.current} day streak">
                            <i data-lucide="flame" style="width: 12px; height: 12px;"></i>
                            <span>${streak.current}</span>
                        </div>
                        
                        <button class="btn btn-secondary btn-drawer-toggle" style="padding: 2px 4px; border: none; background: transparent;">
                            <i data-lucide="chevron-down" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>

                    <div class="habit-drawer hidden">
                        <div style="grid-column: span 1;">
                            <div class="drawer-section-title">1st Law: Make it Obvious</div>
                            <div class="drawer-bubble" style="margin-bottom: 0.5rem; font-size: 0.8rem; padding: 0.5rem;">
                                <strong>Cue Design:</strong> ${habit.cue || 'Not set.'}
                            </div>
                            <div class="drawer-bubble" style="font-size: 0.8rem; padding: 0.5rem;">
                                <strong>Habit Stack:</strong> After I <em>${habit.stackTrigger || '[X]'}</em>, I will <em>${habit.name}</em>.
                            </div>
                        </div>
                        <div style="grid-column: span 1;">
                            <div class="drawer-section-title">4th Law: Make it Satisfying</div>
                            <div class="drawer-bubble" style="margin-bottom: 0.5rem; font-size: 0.8rem; padding: 0.5rem;">
                                <strong>Instant Reward:</strong> ${habit.reward || 'Not set.'}
                            </div>
                            <div class="drawer-bubble" style="border-color: rgba(184, 240, 100, 0.2); background: rgba(184, 240, 100, 0.01); font-size: 0.8rem; padding: 0.5rem;">
                                <strong>Core Identity:</strong> Proving I am <em>"${habit.identity || 'better today'}"</em>.
                            </div>
                        </div>
                        
                        <div style="grid-column: span 2; display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                            <button class="btn btn-secondary btn-delete-habit" style="padding: 0.25rem 0.5rem; font-size: 0.7rem; border-color: rgba(239,68,68,0.15); color: #ef4444;"><i data-lucide="trash-2" style="width: 10px; height: 10px;"></i> Delete Habit</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    _renderSleepLoggerCard(log) {
        const bedtime = log.sleepBedtime || '';
        const wakeup = log.sleepWakeup || '';
        const quality = log.sleepQuality || 0;

        if (bedtime && wakeup) {
            const duration = AtomicManager.calculateSleepDuration(bedtime, wakeup);
            
            const qualityLabels = ["Restless 😢", "Okay 😐", "Refreshed 😄"];
            const isHealthy = duration >= 7 && duration <= 9;
            const healthColor = isHealthy ? 'var(--color-success)' : 'var(--color-warning)';
            
            const formatTime = (t) => {
                let [h, m] = t.split(':').map(Number);
                let ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12;
                h = h ? h : 12;
                m = m < 10 ? '0' + m : m;
                return `${h}:${m} ${ampm}`;
            };

            return `
                <div class="animate-fade-in" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 0.25rem 0;">
                    <div style="display: flex; align-items: center; gap: 10px; background: rgba(184, 240, 100, 0.05); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid rgba(184, 240, 100, 0.15);">
                        <i data-lucide="check-circle-2" style="color: var(--color-success); width: 22px; height: 22px; flex-shrink: 0;"></i>
                        <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">
                            Logged Bedtime: <strong>${formatTime(bedtime)}</strong> &rarr; <strong>${formatTime(wakeup)}</strong>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 0.75rem; font-size: 0.8rem; margin-top: 0.25rem;">
                        <div style="flex: 1; background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); text-align: center;">
                            <span style="display: block; font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Duration</span>
                            <span style="font-size: 1.1rem; font-weight: 700; color: ${healthColor};">${duration} hrs</span>
                            <span style="display: block; font-size: 0.65rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
                                ${isHealthy ? 'Healthy Sleep 💚' : 'Outside Target ⚠️'}
                            </span>
                        </div>
                        <div style="flex: 1; background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); text-align: center;">
                            <span style="display: block; font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Quality</span>
                            <span style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">${qualityLabels[quality - 1] || 'Okay 😐'}</span>
                            <span style="display: block; font-size: 0.65rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">Subjective score</span>
                        </div>
                    </div>
                    
                    <button class="btn btn-secondary" id="btn-edit-sleep" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 12px; margin-top: 0.5rem; width: fit-content; align-self: flex-end;"><i data-lucide="edit-3" style="width: 12px; height: 12px;"></i> Adjust Logs</button>
                </div>
            `;
        } else {
            return `
                <form id="sleep-logger-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Bedtime</label>
                            <input type="time" id="sleep-bedtime-input" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" value="22:30" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Wake Up</label>
                            <input type="time" id="sleep-wakeup-input" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" value="06:30" required>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Rest Quality</label>
                        <select id="sleep-quality-select" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;">
                            <option value="3" selected>😄 Fully Refreshed & Energized</option>
                            <option value="2">😐 Rested (Okay Sleep)</option>
                            <option value="1">😢 Restless (Tired / Interrupted)</option>
                        </select>
                    </div>

                    <button type="submit" class="btn btn-primary" style="padding: 0.45rem 1rem; font-size: 0.8rem; border-radius: 12px; font-weight: 600; margin-top: 0.25rem;"><i data-lucide="moon"></i> Save Log & +20 XP</button>
                </form>
            `;
        }
    },

    _getDayStats(log, habits) {
        if (habits.length === 0) return { pct: 0, done: 0, pending: 0 };
        const done = Object.keys(log.completions || {}).filter(hId => {
            return habits.some(h => h.id === hId) && log.completions[hId].completed;
        }).length;
        const pending = habits.length - done;
        const pct = Math.round((done / habits.length) * 100);
        return { pct, done, pending };
    },

    _renderTasksListMarkup(dateStr) {
        const tasks = db.getTasks().filter(t => {
            if (!t.completed) {
                // Carry forward: show active uncompleted tasks created on or before selected date
                return t.date <= dateStr;
            } else {
                // Keep completed tasks only on the day they were achieved
                return t.date === dateStr;
            }
        });

        if (tasks.length === 0) {
            return `
                <div style="text-align: center; padding: 1.5rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: 8px; font-size: 0.8rem; font-style: italic;">
                    No focus tasks active for this day.
                </div>
            `;
        }

        // Count completed
        const completed = tasks.filter(t => t.completed).length;
        
        // Update badge dynamically
        setTimeout(() => {
            const badge = this.container.querySelector('#tasks-count-badge');
            if (badge) {
                badge.innerText = `${completed} / ${tasks.length} Done`;
            }
        }, 0);

        return tasks.map(task => `
            <div class="animate-fade-in task-item-row" data-id="${task.id}" style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem 0.75rem; transition: background 0.2s, opacity 0.5s, transform 0.5s;">
                <label class="checkbox-wrapper" style="width: 20px; height: 20px; margin-bottom: 0; flex-shrink: 0;">
                    <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}>
                    <span class="checkmark" style="width: 20px; height: 20px; border-radius: 4px; border-width: 1px;"><i data-lucide="check" style="width: 10px; height: 10px;"></i></span>
                </label>
                
                <span class="task-text" style="flex: 1; font-size: 0.85rem; margin-left: 0.75rem; color: ${task.completed ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${task.completed ? 'line-through' : 'none'}; transition: color 0.2s;">
                    ${task.text}
                </span>

                <div style="display: flex; align-items: center; gap: 8px;">
                    ${task.completed ? `
                        <span style="font-size: 0.65rem; font-weight: 700; color: var(--color-success); background: rgba(30,142,62,0.05); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(30,142,62,0.15);">
                            +5 XP 🔥
                        </span>
                    ` : ''}
                    <button class="btn-delete-task" style="background: transparent; border: none; cursor: pointer; color: var(--text-muted); padding: 2px;"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
                </div>
            </div>
        `).join('');
    },

    _refreshTasksList() {
        const container = this.container.querySelector('#tasks-list-container');
        if (container) {
            container.innerHTML = this._renderTasksListMarkup(this.selectedDate);
            lucide.createIcons();
            this._setupTaskItemListeners();
        }
    },

    _setupTaskItemListeners() {
        const taskRows = this.container.querySelectorAll('.task-item-row');
        taskRows.forEach(row => {
            const taskId = row.getAttribute('data-id');
            const check = row.querySelector('.task-check');
            const deleteBtn = row.querySelector('.btn-delete-task');
            
            if (check) {
                check.addEventListener('change', (e) => {
                    const tasks = db.getTasks();
                    const task = tasks.find(t => t.id === taskId);
                    if (task) {
                        task.completed = e.target.checked;
                        db.saveTask(task);
                        
                        if (task.completed) {
                            db.addXp(5);
                            this._playConfetti();
                            
                            // Visual slide out and fade
                            row.style.opacity = '0.5';
                            row.style.transform = 'translateX(10px)';
                            row.style.pointerEvents = 'none';
                            
                            // Auto delete completed task after satisfying 1 second delay
                            setTimeout(() => {
                                db.deleteTask(taskId);
                                this._refreshTasksList();
                                this._updateSidebarProgress();
                            }, 1000);
                        } else {
                            this._refreshTasksList();
                            this._updateSidebarProgress();
                        }
                    }
                });
            }

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    db.deleteTask(taskId);
                    this._refreshTasksList();
                    this._updateSidebarProgress();
                });
            }
        });
    },

    _setupListeners() {
        const tabs = this.container.querySelectorAll('.filter-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active-filter'));
                tab.classList.add('active-filter');
                this.activeFilter = tab.getAttribute('data-filter');
                this.updateView();
            });
        });

        const timeBtns = this.container.querySelectorAll('.time-filter-btn');
        timeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                timeBtns.forEach(b => b.classList.remove('active-segment'));
                btn.classList.add('active-segment');
                this.activeTimeFilter = btn.getAttribute('data-time');
                this.updateView();
            });
        });

        const picker = this.container.querySelector('#dashboard-date-picker');
        picker.addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            this.updateView();
        });

        this.container.querySelector('#btn-prev-day').addEventListener('click', () => {
            const current = new Date(this.selectedDate);
            current.setDate(current.getDate() - 1);
            this.selectedDate = current.toISOString().split('T')[0];
            this.updateView();
        });

        this.container.querySelector('#btn-next-day').addEventListener('click', () => {
            const current = new Date(this.selectedDate);
            current.setDate(current.getDate() + 1);
            this.selectedDate = current.toISOString().split('T')[0];
            this.updateView();
        });

        const cards = this.container.querySelectorAll('.habit-card');
        cards.forEach(card => {
            const toggle = card.querySelector('.btn-drawer-toggle');
            const details = card.querySelector('.habit-details');
            const drawer = card.querySelector('.habit-drawer');
            
            const handleToggle = (e) => {
                if (e.target.closest('.checkbox-wrapper') || e.target.closest('.btn-twomin-trigger') || e.target.closest('.btn-delete-habit')) return;
                const isHidden = drawer.classList.contains('hidden');
                
                this.container.querySelectorAll('.habit-drawer').forEach(d => d.classList.add('hidden'));
                this.container.querySelectorAll('.btn-drawer-toggle i').forEach(i => i.setAttribute('data-lucide', 'chevron-down'));
                
                if (isHidden) {
                    drawer.classList.remove('hidden');
                    toggle.querySelector('i').setAttribute('data-lucide', 'chevron-up');
                } else {
                    drawer.classList.add('hidden');
                    toggle.querySelector('i').setAttribute('data-lucide', 'chevron-down');
                }
                lucide.createIcons();
            };

            toggle.addEventListener('click', handleToggle);
            details.addEventListener('click', handleToggle);
        });

        cards.forEach(card => {
            const deleteBtn = card.querySelector('.btn-delete-habit');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    const hId = card.getAttribute('data-id');
                    if (confirm("Are you sure you want to delete this habit? All history logs will still be preserved.")) {
                        db.deleteHabit(hId);
                        this.updateView();
                        this._updateSidebarProgress();
                    }
                });
            }
        });

        cards.forEach(card => {
            const tmBtn = card.querySelector('.btn-twomin-trigger');
            if (tmBtn) {
                tmBtn.addEventListener('click', () => {
                    const habitId = card.getAttribute('data-id');
                    const habit = db.getHabits().find(h => h.id === habitId);
                    const desc = card.querySelector('.habit-desc');
                    
                    const wasActive = !!this.activeTwoMinuteHabits[habitId];
                    if (wasActive) {
                        delete this.activeTwoMinuteHabits[habitId];
                        tmBtn.classList.remove('active');
                        tmBtn.innerText = "⚡ 2-Min";
                        desc.innerHTML = habit.stackTrigger ? `After I <strong>${habit.stackTrigger}</strong>, I will complete this.` : 'Repetitions build identity.';
                    } else {
                        this.activeTwoMinuteHabits[habitId] = true;
                        tmBtn.classList.add('active');
                        tmBtn.innerText = "⚡ Normal";
                        desc.innerHTML = `<strong style="color: var(--primary);">⚡ 2-Min Version Active:</strong> ${habit.twoMinuteVersion}`;
                    }
                });
            }
        });

        cards.forEach(card => {
            const check = card.querySelector('.habit-check');
            check.addEventListener('change', (e) => {
                const habitId = card.getAttribute('data-id');
                const isTwoMinute = !!this.activeTwoMinuteHabits[habitId];

                if (e.target.checked) {
                    card.classList.add('completed');
                    card.classList.add('animate-pop');
                    this._playConfetti();
                } else {
                    card.classList.remove('completed');
                }

                const { xpGained, isChecking } = db.toggleHabitCompletion(this.selectedDate, habitId, isTwoMinute);
                this._floatXpNotification(card, xpGained, isChecking);

                setTimeout(() => {
                    this.updateView();
                    this._updateSidebarProgress();
                }, 400);
            });
        });

        const sleepForm = this.container.querySelector('#sleep-logger-form');
        if (sleepForm) {
            sleepForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const bedtime = this.container.querySelector('#sleep-bedtime-input').value;
                const wakeup = this.container.querySelector('#sleep-wakeup-input').value;
                const quality = parseInt(this.container.querySelector('#sleep-quality-select').value);

                const currentLog = db.getLogForDate(this.selectedDate);
                currentLog.sleepBedtime = bedtime;
                currentLog.sleepWakeup = wakeup;
                currentLog.sleepQuality = quality;

                db.saveLogForDate(this.selectedDate, currentLog);
                
                db.addXp(20);
                this._playConfetti();
                
                this.updateView();
            });
        }

        const editSleepBtn = this.container.querySelector('#btn-edit-sleep');
        if (editSleepBtn) {
            editSleepBtn.addEventListener('click', () => {
                const currentLog = db.getLogForDate(this.selectedDate);
                const oldBed = currentLog.sleepBedtime;
                const oldWake = currentLog.sleepWakeup;
                const oldQual = currentLog.sleepQuality;

                currentLog.sleepBedtime = '';
                currentLog.sleepWakeup = '';
                db.saveLogForDate(this.selectedDate, currentLog);
                this.updateView();

                setTimeout(() => {
                    const bedInput = this.container.querySelector('#sleep-bedtime-input');
                    const wakeInput = this.container.querySelector('#sleep-wakeup-input');
                    const qualSelect = this.container.querySelector('#sleep-quality-select');
                    
                    if (bedInput) bedInput.value = oldBed;
                    if (wakeInput) wakeInput.value = oldWake;
                    if (qualSelect) qualSelect.value = oldQual;
                }, 50);
            });
        }

        // Daily Focus Tasks Listeners (Phase 11)
        const taskForm = this.container.querySelector('#new-task-form');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = this.container.querySelector('#task-input-text');
                const text = input.value.trim();
                if (text) {
                    db.saveTask({
                        text: text,
                        date: this.selectedDate
                    });
                    input.value = '';
                    this._refreshTasksList();
                }
            });
        }

        this._setupTaskItemListeners();
    },

    _floatXpNotification(card, amount, isChecking) {
        if (amount === 0) return;
        
        const floatSpan = document.createElement('span');
        floatSpan.innerText = isChecking ? `+${amount} XP 🔥` : `${amount} XP ❄️`;
        floatSpan.style.position = 'absolute';
        floatSpan.style.top = '10px';
        floatSpan.style.right = '40px';
        floatSpan.style.fontSize = '0.85rem';
        floatSpan.style.fontWeight = '800';
        floatSpan.style.color = isChecking ? 'var(--color-success)' : 'var(--color-danger)';
        floatSpan.style.zIndex = '1000';
        floatSpan.style.pointerEvents = 'none';
        floatSpan.style.transition = 'all 0.6s ease';
        
        card.appendChild(floatSpan);
        
        setTimeout(() => {
            floatSpan.style.transform = 'translateY(-20px)';
            floatSpan.style.opacity = '0';
        }, 50);
        
        setTimeout(() => {
            floatSpan.remove();
        }, 600);
    },

    _updateSidebarProgress() {
        const shell = window.globalAppInstance;
        if (shell) {
            shell.updateSidebarStats();
        }
    },

    _playConfetti() {
        if (window.confetti) {
            window.confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.75, x: 0.5 },
                colors: ['#b8f064', '#8fd43a', '#f5b942', '#f06464']
            });
        }
    }
};

// =========================================================================
// 4. JOURNAL VIEW COMPONENT (V3 MICRO-WINS & PIVOTS)
// =========================================================================
const Journal = {
    selectedDate: new Date().toISOString().split('T')[0],
    activeMood: 0,
    activeEnergy: 3,

    render(container) {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.container = container;
        this.loadDateLog();
    },

    loadDateLog() {
        const log = db.getLogForDate(this.selectedDate);
        this.activeMood = log.mood || 0;
        this.activeEnergy = log.energy || 3;
        this.updateView(log);
    },

    autoSaveCurrent() {
        if (!this.container) return;
        const winsInput = this.container.querySelector('#j-wins');
        const hardInput = this.container.querySelector('#j-hard');
        const anxietyInput = this.container.querySelector('#j-anxiety');
        const tomorrowInput = this.container.querySelector('#j-tomorrow');
        const freeInput = this.container.querySelector('#reflections-textarea');

        if (!winsInput || !hardInput || !anxietyInput || !tomorrowInput || !freeInput) return;

        const winsVal = winsInput.value.trim();
        const hardVal = hardInput.value.trim();
        const anxietyVal = anxietyInput.value.trim();
        const tomorrowVal = tomorrowInput.value.trim();
        const freeVal = freeInput.value.trim();

        const currentLog = db.getLogForDate(this.selectedDate);
        const currentWinsText = Array.isArray(currentLog.wins) ? currentLog.wins.join('\n') : (currentLog.wins || '');
        const currentHardText = currentLog.hard || '';
        const currentAnxietyText = currentLog.anxiety || '';
        const currentTomorrowText = currentLog.tomorrow || currentLog.improvement || '';
        const currentFreeText = currentLog.journalNotes || currentLog.free || '';

        const isWinsChanged = winsVal !== currentWinsText;
        const isHardChanged = hardVal !== currentHardText;
        const isAnxietyChanged = anxietyVal !== currentAnxietyText;
        const isTomorrowChanged = tomorrowVal !== currentTomorrowText;
        const isFreeChanged = freeVal !== currentFreeText;
        const isMoodChanged = this.activeMood !== (currentLog.mood || 0);
        const isEnergyChanged = this.activeEnergy !== (currentLog.energy || 3);

        if (isWinsChanged || isHardChanged || isAnxietyChanged || isTomorrowChanged || isFreeChanged || isMoodChanged || isEnergyChanged) {
            const logData = {
                mood: this.activeMood,
                energy: this.activeEnergy || 3,
                wins: winsVal ? winsVal.split('\n').map(w => w.trim()).filter(Boolean) : [],
                hard: hardVal,
                anxiety: anxietyVal,
                tomorrow: tomorrowVal,
                improvement: tomorrowVal,
                free: freeVal,
                journalNotes: freeVal
            };
            db.saveLogForDate(this.selectedDate, logData);
        }
    },

    updateView(log) {
        // V5 Enhanced Journal: Retrieve active habits and calculate compliance list
        const habits = db.getHabits();
        const completions = log.completions || {};
        let completedCount = 0;
        let totalCount = habits.length;

        const habitSummaryHtml = habits.map(h => {
            const isDone = completions[h.id] && completions[h.id].completed;
            if (isDone) completedCount++;
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.82rem; padding: 6px 0; border-bottom: 1px dashed var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 8px; color: ${isDone ? 'var(--text-primary)' : 'var(--text-secondary)'};">
                        <i data-lucide="${isDone ? 'check-circle-2' : 'circle'}" style="width: 14px; height: 14px; color: ${isDone ? 'var(--color-success)' : 'var(--text-muted)'};"></i>
                        <span style="${isDone ? '' : 'color: var(--text-muted);'}">${h.name}</span>
                    </div>
                    <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 500;">
                        ${isDone ? '<span style="color: var(--color-success); font-weight: 600;">+10 XP</span>' : 'Pending'}
                    </span>
                </div>
            `;
        }).join('') || `<div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; font-style: italic; padding: 0.5rem 0;">No active habits set for this day.</div>`;

        const winsText = Array.isArray(log.wins) ? log.wins.join('\n') : (log.wins || '');
        const hardText = log.hard || '';
        const anxietyText = log.anxiety || '';
        const tomorrowText = log.tomorrow || log.improvement || '';
        const freeText = log.journalNotes || log.free || '';

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                <div class="view-grid">
                    <!-- Left: Mood & Energy Tracker -->
                    <div style="grid-column: span 5; display: flex; flex-direction: column; gap: 1.5rem;">
                        
                        <!-- Date selector with chevrons -->
                        <div class="glass-card" style="padding: 1.25rem; border-radius: var(--radius-md);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label style="font-weight: 500; font-size: 0.9rem; color: var(--text-primary);">Log Entry Date</label>
                                <div style="display: flex; align-items: center; gap: 0.25rem;">
                                    <button class="btn btn-secondary" id="btn-prev-journal-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i></button>
                                    <input type="date" id="journal-date-picker" class="form-control" value="${this.selectedDate}" style="width: 130px; border-radius: 16px; padding: 0.3rem 0.5rem; font-size: 0.85rem; height: auto; text-align: center; border: 1px solid var(--border-color);">
                                    <button class="btn btn-secondary" id="btn-next-journal-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i></button>
                                </div>
                            </div>
                        </div>

                        <!-- Mood Card -->
                        <div class="glass-card" style="border-radius: var(--radius-md); padding: 1.25rem;">
                            <h3 class="card-title" style="margin-bottom: 1rem; font-weight: 500; font-size: 0.95rem;">
                                <i data-lucide="smile" style="color: var(--primary); width: 18px; height: 18px;"></i> How are you feeling right now?
                            </h3>
                            <div class="mood-picker" id="mood-row">
                                <button class="mood-btn ${this.activeMood === 1 ? 'sel' : ''}" data-mood="1">😔</button>
                                <button class="mood-btn ${this.activeMood === 2 ? 'sel' : ''}" data-mood="2">😐</button>
                                <button class="mood-btn ${this.activeMood === 3 ? 'sel' : ''}" data-mood="3">🙂</button>
                                <button class="mood-btn ${this.activeMood === 4 ? 'sel' : ''}" data-mood="4">😊</button>
                                <button class="mood-btn ${this.activeMood === 5 ? 'sel' : ''}" data-mood="5">😄</button>
                            </div>
                        </div>

                        <!-- Energy Card -->
                        <div class="glass-card" style="border-radius: var(--radius-md); padding: 1.25rem;">
                            <h3 class="card-title" style="margin-bottom: 1rem; font-weight: 500; font-size: 0.95rem;">
                                <i data-lucide="zap" style="color: var(--color-warning); width: 18px; height: 18px;"></i> Energy level today
                            </h3>
                            <div class="energy-picker" id="nrg-row">
                                <button class="energy-btn ${this.activeEnergy === 1 ? 'sel' : ''}" data-energy="1">1</button>
                                <button class="energy-btn ${this.activeEnergy === 2 ? 'sel' : ''}" data-energy="2">2</button>
                                <button class="energy-btn ${this.activeEnergy === 3 ? 'sel' : ''}" data-energy="3">3</button>
                                <button class="energy-btn ${this.activeEnergy === 4 ? 'sel' : ''}" data-energy="4">4</button>
                                <button class="energy-btn ${this.activeEnergy === 5 ? 'sel' : ''}" data-energy="5">5</button>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-top: 6px; padding: 0 4px;">
                                <span>1 (Exhausted)</span>
                                <span>3 (Balanced)</span>
                                <span>5 (Peak)</span>
                            </div>
                        </div>

                        <!-- Today's Habit Compliance Panel -->
                        <div class="glass-card" style="border-radius: var(--radius-md); padding: 1.25rem;">
                            <h3 class="card-title" style="margin-bottom: 0.75rem; font-weight: 500; font-size: 0.95rem; display: flex; justify-content: space-between; align-items: center;">
                                <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="check-square" style="color: var(--primary); width: 18px; height: 18px;"></i> Routine Compliance</span>
                                <span style="font-size: 0.75rem; font-weight: 700; background: var(--sidebar-active-bg); color: var(--primary); padding: 2px 8px; border-radius: 12px;">${completedCount} / ${totalCount} Done</span>
                            </h3>
                            <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 1rem;">Routines checked off on this day. Consistently keeping to systems yields better energy and mood!</p>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                ${habitSummaryHtml}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Reflections -->
                    <div style="grid-column: span 7; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.5rem 1.75rem; border-radius: var(--radius-md);">
                            <div class="card-header-flex" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.25rem;">
                                <div>
                                    <h3 class="card-title" style="font-weight: 500; font-size: 1.15rem;"><i data-lucide="book-open" style="color: var(--primary); width: 20px; height: 20px;"></i> Daily Reflection</h3>
                                    <p class="card-subtitle" style="font-size: 0.8rem;">Keep an atomic record of wins. XP awarded on save!</p>
                                </div>
                                <button class="btn btn-primary" id="btn-save-journal" style="padding: 0.5rem 1.25rem; font-size: 0.82rem; border-radius: 16px;">
                                    <i data-lucide="save" style="width: 14px; height: 14px;"></i> Save Log
                                </button>
                            </div>

                            <div class="form-group" style="margin-bottom: 1.25rem;">
                                <label style="font-size: 0.8rem;">Today's win 🏆</label>
                                <textarea class="form-control" id="j-wins" placeholder="What went well? Any habit that felt automatic?" style="border-radius: 8px; padding: 0.65rem 0.75rem; font-size: 0.85rem; width: 100%; min-height: 80px; resize: vertical;">${winsText}</textarea>
                            </div>

                            <div class="form-group" style="margin-bottom: 1.25rem;">
                                <label style="font-size: 0.8rem;">What was hard 💪</label>
                                <textarea class="form-control" id="j-hard" placeholder="Any friction, struggle, or habit you skipped?" style="border-radius: 8px; padding: 0.65rem 0.75rem; font-size: 0.85rem; width: 100%; min-height: 80px; resize: vertical;">${hardText}</textarea>
                            </div>

                            <div class="form-group" style="margin-bottom: 1.25rem;">
                                <label style="font-size: 0.8rem;">Anxiety parking lot 🅿️</label>
                                <textarea class="form-control" id="j-anxiety" placeholder="Park thoughts here — things to look up tomorrow, not tonight…" style="border-radius: 8px; padding: 0.65rem 0.75rem; font-size: 0.85rem; width: 100%; min-height: 80px; resize: vertical;">${anxietyText}</textarea>
                            </div>

                            <div class="form-group" style="margin-bottom: 1.25rem;">
                                <label style="font-size: 0.8rem;">Intention for tomorrow 🌅</label>
                                <textarea class="form-control" id="j-tomorrow" placeholder="One thing to focus on or do differently…" style="border-radius: 8px; padding: 0.65rem 0.75rem; font-size: 0.85rem; width: 100%; min-height: 80px; resize: vertical;">${tomorrowText}</textarea>
                            </div>

                            <div style="border-top: 1px dashed var(--border-color); margin: 1.5rem 0;"></div>

                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="font-size: 0.8rem;">Free writing 📝</label>
                                <textarea id="reflections-textarea" class="form-control" style="border-radius: 8px; padding: 0.65rem 0.75rem; font-size: 0.85rem; width: 100%; min-height: 120px; resize: vertical;" placeholder="Thoughts, feelings, gratitude, observations, anything…">${freeText}</textarea>
                            </div>

                            <div class="info-box">
                                <strong>Anxiety parking lot</strong> — when an urge to doomscroll or research something hits in the evening, write it here instead. Deal with it tomorrow during daylight hours.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toast Success Popup -->
            <div id="save-toast" class="glass-card animate-slide-up" style="position: fixed; bottom: 2rem; right: 2rem; background: var(--grad-success); color: #ffffff; padding: 0.75rem 1.5rem; border-radius: var(--radius-sm); box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3); z-index: 10000; border: none; display: none;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                    <i data-lucide="check-circle" style="width: 20px; height: 20px;"></i>
                    <span id="toast-message-span">Reflection Log Saved! +20 XP 🔥</span>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
    },

    _setupListeners() {
        const picker = this.container.querySelector('#journal-date-picker');
        picker.addEventListener('change', (e) => {
            this.autoSaveCurrent();
            this.selectedDate = e.target.value;
            this.loadDateLog();
        });

        // Chevron date controls
        this.container.querySelector('#btn-prev-journal-day').addEventListener('click', () => {
            this.autoSaveCurrent();
            const current = new Date(this.selectedDate);
            current.setDate(current.getDate() - 1);
            this.selectedDate = current.toISOString().split('T')[0];
            this.loadDateLog();
        });

        this.container.querySelector('#btn-next-journal-day').addEventListener('click', () => {
            this.autoSaveCurrent();
            const current = new Date(this.selectedDate);
            current.setDate(current.getDate() + 1);
            this.selectedDate = current.toISOString().split('T')[0];
            this.loadDateLog();
        });

        const moodButtons = this.container.querySelectorAll('#mood-row .mood-btn');
        moodButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                moodButtons.forEach(b => b.classList.remove('sel'));
                btn.classList.add('sel');
                this.activeMood = parseInt(btn.getAttribute('data-mood'));
            });
        });

        const energyButtons = this.container.querySelectorAll('#nrg-row .energy-btn');
        energyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                energyButtons.forEach(b => b.classList.remove('sel'));
                btn.classList.add('sel');
                this.activeEnergy = parseInt(btn.getAttribute('data-energy'));
            });
        });

        this.container.querySelector('#btn-save-journal').addEventListener('click', () => {
            const isFirstSave = !db.logs[this.selectedDate] || db.logs[this.selectedDate].mood === 0;
            
            const winsVal = this.container.querySelector('#j-wins').value.trim();
            const hardVal = this.container.querySelector('#j-hard').value.trim();
            const anxietyVal = this.container.querySelector('#j-anxiety').value.trim();
            const tomorrowVal = this.container.querySelector('#j-tomorrow').value.trim();
            const freeVal = this.container.querySelector('#reflections-textarea').value.trim();

            const logData = {
                mood: this.activeMood,
                energy: this.activeEnergy || 3,
                wins: winsVal ? [winsVal] : [],
                hard: hardVal,
                anxiety: anxietyVal,
                tomorrow: tomorrowVal,
                improvement: tomorrowVal, // compatibility
                free: freeVal,
                journalNotes: freeVal // compatibility
            };

            db.saveLogForDate(this.selectedDate, logData);
            
            let gainedText = "Reflection Log Saved!";
            if (isFirstSave) {
                db.addXp(20);
                gainedText = "Reflection Log Saved! +20 XP 🔥";
            }
            this._showToast(gainedText);
            
            // Re-render to reflect new summary/compliance states
            this.loadDateLog();
        });
    },

    _showToast(msg) {
        const toast = this.container.querySelector('#save-toast');
        const span = this.container.querySelector('#toast-message-span');
        if (toast && span) {
            span.innerText = msg;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }
};

// =========================================================================
// 5. BLUEPRINT VIEW COMPONENT
// =========================================================================
const Blueprint = {
    render(container) {
        this.container = container;
        this.updateView();
    },

    updateView() {
        const blueprints = db.getBlueprints();

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                <div class="glass-card" style="margin-bottom: 2rem; background: var(--grad-glow); border-color: rgba(26, 115, 232, 0.05); border-radius: var(--radius-md);">
                    <h3 style="font-size: 1.25rem; font-weight: 500; color: var(--primary); display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="award"></i> The Atomic Blueprint Worksheet
                    </h3>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-top: 0.5rem;">
                        Real, lasting change doesn't come from focusing on goals. It comes from adopting your ultimate *Identity*. Use these worksheets to build a robust system of stacks and proofs.
                    </p>
                </div>

                <div class="view-grid">
                    <!-- Left: Identity pillars -->
                    <div style="grid-column: span 6; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md);">
                            <h3 class="card-title" style="margin-bottom: 0.5rem; font-weight: 500;">
                                <i data-lucide="fingerprint" style="color: var(--primary);"></i> 1. Core Identity Pillars
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1.5rem; font-size: 0.8rem;">Define your ultimate self and build daily proof systems.</p>

                            <form id="identity-form" style="display: flex; flex-direction: column; gap: 1rem; background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                                <div class="form-group">
                                    <label style="font-size: 0.8rem;">I want to become the type of person who is a...</label>
                                    <input type="text" id="identity-title-input" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" placeholder="e.g. Prolific writer, healthy athlete" required>
                                </div>
                                <div class="form-group">
                                    <label style="font-size: 0.8rem;">Daily action that proves this identity:</label>
                                    <input type="text" id="identity-action-input" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" placeholder="e.g. Writing 100 words, exercising for 10 min" required>
                                </div>
                                <button type="submit" class="btn btn-primary" style="align-self: flex-end; padding: 0.45rem 1.1rem; font-size: 0.8rem; border-radius: 12px;"><i data-lucide="plus"></i> Add Pillar</button>
                            </form>

                            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-secondary);">Your Identity Pillars</h4>
                            <div id="identities-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${this._renderIdentitiesList(blueprints.identities)}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Habit stacking -->
                    <div style="grid-column: span 6; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md);">
                            <h3 class="card-title" style="margin-bottom: 0.5rem; font-weight: 500;">
                                <i data-lucide="layers" style="color: var(--color-warning);"></i> 2. Habit Stacking Architect
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1.5rem; font-size: 0.8rem;">Link a new habit to an existing, fully established trigger cue.</p>

                            <form id="stack-form" style="display: flex; flex-direction: column; gap: 1rem; background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-size: 0.85rem; font-weight: 600;">After I</span>
                                    <input type="text" id="stack-trigger" class="form-control" style="flex: 1; min-width: 120px; padding: 0.4rem 0.6rem; font-size: 0.82rem;" placeholder="pour my morning coffee" required>
                                    <span style="font-size: 0.85rem; font-weight: 600;">, I will...</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <input type="text" id="stack-new-habit" class="form-control" style="flex: 1; min-width: 120px; padding: 0.4rem 0.6rem; font-size: 0.82rem;" placeholder="meditate for 5 minutes" required>
                                    <span style="font-size: 0.85rem; font-weight: 600;">in/at</span>
                                    <input type="text" id="stack-location" class="form-control" style="flex: 0.6; min-width: 90px; padding: 0.4rem 0.6rem; font-size: 0.82rem;" placeholder="living room chair" required>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; gap: 8px;">
                                    <label class="checkbox-wrapper" style="width: auto; height: auto; display: flex; align-items: center; gap: 8px; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">
                                        <input type="checkbox" id="stack-auto-add-dashboard" checked>
                                        <span class="checkmark" style="width: 18px; height: 18px; border-radius: 4px; border-width: 1px;"><i data-lucide="check" style="width: 10px; height: 10px;"></i></span>
                                        <span>Add as active habit to dashboard</span>
                                    </label>
                                    <button type="submit" class="btn btn-primary" style="padding: 0.45rem 1.1rem; font-size: 0.8rem; border-radius: 12px;"><i data-lucide="plus"></i> Add Stack</button>
                                </div>
                            </form>

                            <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-secondary);">Your Configured Stacks</h4>
                            <div id="stacks-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${this._renderStacksList(blueprints.stacks)}
                            </div>
                        </div>
                    </div>

                    <!-- Forge & Link a New Habit card (Phase 9) -->
                    <div class="glass-card" style="grid-column: span 12; margin-top: 1.5rem; padding: 1.5rem; border-radius: var(--radius-md);">
                        <h3 class="card-title" style="margin-bottom: 0.5rem; font-weight: 500;">
                            <i data-lucide="sparkles" style="color: var(--primary);"></i> 3. Forge & Link a New Habit
                        </h3>
                        <p class="card-subtitle" style="margin-bottom: 1.25rem; font-size: 0.8rem;">Forge a habits routine specifically aligned with your home environment, and bind it to an Identity Pillar.</p>

                        <!-- Visual Preset Section -->
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.5rem;">
                            <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 0.75rem;">⚡ Quick Hygiene & Room Tidiness Presets:</span>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button class="btn btn-secondary btn-preset" type="button" data-preset="shower" style="font-size: 0.78rem; padding: 0.4rem 0.8rem; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px;">
                                    🧼 Morning Shower & Teeth
                                </button>
                                <button class="btn btn-secondary btn-preset" type="button" data-preset="kitchen" style="font-size: 0.78rem; padding: 0.4rem 0.8rem; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px;">
                                    🧹 2-Minute Kitchen Tidy
                                </button>
                                <button class="btn btn-secondary btn-preset" type="button" data-preset="bed" style="font-size: 0.78rem; padding: 0.4rem 0.8rem; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px;">
                                    🛏️ Bedroom Bed Setup
                                </button>
                                <button class="btn btn-secondary btn-preset" type="button" data-preset="declutter" style="font-size: 0.78rem; padding: 0.4rem 0.8rem; border-radius: 12px; display: inline-flex; align-items: center; gap: 6px;">
                                    📦 Declutter & Arrange Room
                                </button>
                            </div>
                        </div>

                        <!-- Habit Forging Form -->
                        <form id="new-habit-form" style="display: flex; flex-direction: column; gap: 1.25rem; background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
                                <!-- Column 1: Core Habit Identity & Time -->
                                <div style="display: flex; flex-direction: column; gap: 1rem;">
                                    <div class="form-group">
                                        <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="activity" style="width: 14px; height: 14px; color: var(--primary);"></i> Habit Name
                                        </label>
                                        <input type="text" id="new-habit-name" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" placeholder="e.g. Read 5 pages, Drink water" required>
                                    </div>

                                    <div class="form-group">
                                        <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="fingerprint" style="width: 14px; height: 14px; color: var(--primary);"></i> Link to Identity Pillar
                                        </label>
                                        <select id="new-habit-identity" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" required>
                                            ${blueprints.identities.map(id => `<option value="${id.title}">${id.title}</option>`).join('') || '<option value="">(Create an Identity Pillar first!)</option>'}
                                        </select>
                                    </div>

                                    <div style="display: flex; gap: 1rem;">
                                        <div class="form-group" style="flex: 1;">
                                            <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                                <i data-lucide="tag" style="width: 14px; height: 14px; color: var(--primary);"></i> Category
                                            </label>
                                            <select id="new-habit-category" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;">
                                                <option value="health">🧼 Hygiene & Health</option>
                                                <option value="mind">🧹 Room & Cleanliness</option>
                                                <option value="career">💼 Career & Learning</option>
                                                <option value="other">🌱 General</option>
                                            </select>
                                        </div>

                                        <div class="form-group" style="flex: 1;">
                                            <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                                <i data-lucide="clock" style="width: 14px; height: 14px; color: var(--primary);"></i> Home Timing
                                            </label>
                                            <select id="new-habit-time" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;">
                                                <option value="morning">🌅 Morning (Before Office)</option>
                                                <option value="evening">🌙 Evening (After Office)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- Column 2: Obvious Cue, Habit Stack, & 2-Minute Ease -->
                                <div style="display: flex; flex-direction: column; gap: 1rem;">
                                    <div class="form-group">
                                        <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="layers" style="width: 14px; height: 14px; color: var(--color-warning);"></i> Habit Stack Trigger (1st Law)
                                        </label>
                                        <input type="text" id="new-habit-trigger" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" placeholder="e.g. After I step out of bed in the morning" required>
                                    </div>

                                    <div class="form-group">
                                        <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="eye" style="width: 14px; height: 14px; color: var(--color-info);"></i> Obvious Cue (1st Law)
                                        </label>
                                        <input type="text" id="new-habit-cue" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" placeholder="e.g. Clean towel prepared on counter" required>
                                    </div>

                                    <div class="form-group">
                                        <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="zap" style="width: 14px; height: 14px; color: var(--color-success);"></i> 2-Minute Version (3rd Law - Make it Easy)
                                        </label>
                                        <input type="text" id="new-habit-twomin" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" placeholder="e.g. Brush teeth and wash face for 30s" required>
                                    </div>

                                    <div class="form-group">
                                        <label style="font-size: 0.8rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="gift" style="width: 14px; height: 14px; color: var(--primary);"></i> Immediate Reward (4th Law)
                                        </label>
                                        <input type="text" id="new-habit-reward" class="form-control" style="font-size: 0.85rem; padding: 0.5rem 0.75rem;" placeholder="e.g. Feeling completely fresh and clean" required>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" class="btn btn-primary" style="align-self: flex-end; padding: 0.6rem 1.5rem; font-size: 0.85rem; border-radius: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                                <i data-lucide="plus-circle" style="width: 16px; height: 16px;"></i> Forge & Activate Habit
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
    },

    _renderIdentitiesList(identities) {
        if (!identities || identities.length === 0) {
            return `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-size: 0.85rem;">
                    Define your first Identity statement above!
                </div>
            `;
        }
        return identities.map((idObj, idx) => `
            <div class="animate-fade-in" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-left: 3px solid var(--primary); padding: 0.75rem 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">"${idObj.title}"</span>
                    <span style="font-size: 0.78rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                        <i data-lucide="star" style="width: 12px; height: 12px; fill: var(--color-warning); stroke: var(--color-warning);"></i> 
                        Daily Proof: ${idObj.proof || 'Action not set'}
                    </span>
                </div>
                <button class="btn-delete-identity" data-index="${idx}" style="background: transparent; border: none; cursor: pointer; color: var(--text-muted);"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
            </div>
        `).join('');
    },

    _renderStacksList(stacks) {
        if (!stacks || stacks.length === 0) {
            return `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-size: 0.85rem;">
                    Construct your first Habit Stack trigger!
                </div>
            `;
        }
        return stacks.map((stack, idx) => `
            <div class="animate-fade-in" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-left: 3px solid var(--color-warning); padding: 0.75rem 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem;">
                    <div style="line-height: 1.4;">
                        After I <strong style="color: var(--primary);">${stack.trigger}</strong>, 
                        I will <strong style="color: var(--color-success);">${stack.habit}</strong> 
                        at <strong style="color: var(--color-warning);">${stack.location}</strong>.
                    </div>
                </div>
                <button class="btn-delete-stack" data-index="${idx}" style="background: transparent; border: none; cursor: pointer; color: var(--text-muted); flex-shrink: 0;"><i data-lucide="trash-2" style="width: 16px; height: 16px;"></i></button>
            </div>
        `).join('');
    },

    _setupListeners() {
        const idForm = this.container.querySelector('#identity-form');
        idForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const blueprints = db.getBlueprints();
            const newIdentity = {
                id: 'id_' + Date.now(),
                title: this.container.querySelector('#identity-title-input').value,
                proof: this.container.querySelector('#identity-action-input').value
            };

            blueprints.identities = blueprints.identities || [];
            blueprints.identities.push(newIdentity);
            db.saveBlueprints(blueprints);

            idForm.reset();
            this.updateView();
        });

        const deleteIdBtns = this.container.querySelectorAll('.btn-delete-identity');
        deleteIdBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                const blueprints = db.getBlueprints();
                blueprints.identities.splice(idx, 1);
                db.saveBlueprints(blueprints);
                this.updateView();
            });
        });

        const stackForm = this.container.querySelector('#stack-form');
        stackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const blueprints = db.getBlueprints();
            
            const trigger = this.container.querySelector('#stack-trigger').value;
            const habitName = this.container.querySelector('#stack-new-habit').value;
            const location = this.container.querySelector('#stack-location').value;
            const autoAdd = this.container.querySelector('#stack-auto-add-dashboard').checked;

            const newStack = { trigger, habit: habitName, location };
            blueprints.stacks = blueprints.stacks || [];
            blueprints.stacks.push(newStack);
            db.saveBlueprints(blueprints);

            if (autoAdd) {
                const createdHabit = {
                    name: habitName,
                    category: 'mind',
                    timeOfDay: 'afternoon',
                    identity: blueprints.identities.length > 0 ? blueprints.identities[0].title : '',
                    stackTrigger: trigger,
                    cue: `Located in: ${location}`,
                    twoMinuteVersion: `Start doing ${habitName.split(' ')[0]} for 1 minute.`,
                    reward: 'Fulfill identity check.'
                };
                db.saveHabit(createdHabit);
            }

            stackForm.reset();
            this.updateView();
        });

        const deleteStackBtns = this.container.querySelectorAll('.btn-delete-stack');
        deleteStackBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                const blueprints = db.getBlueprints();
                blueprints.stacks.splice(idx, 1);
                db.saveBlueprints(blueprints);
                this.updateView();
            });
        });

        // Forge Habit Form Submit (Phase 9)
        const newForm = this.container.querySelector('#new-habit-form');
        if (newForm) {
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const createdHabit = {
                    name: this.container.querySelector('#new-habit-name').value.trim(),
                    category: this.container.querySelector('#new-habit-category').value,
                    timeOfDay: this.container.querySelector('#new-habit-time').value,
                    identity: this.container.querySelector('#new-habit-identity').value,
                    twoMinuteVersion: this.container.querySelector('#new-habit-twomin').value.trim(),
                    stackTrigger: this.container.querySelector('#new-habit-trigger').value.trim(),
                    cue: this.container.querySelector('#new-habit-cue').value.trim(),
                    reward: this.container.querySelector('#new-habit-reward').value.trim()
                };
                db.saveHabit(createdHabit);
                newForm.reset();
                this.updateView();
                
                if (window.globalAppInstance) {
                    window.globalAppInstance.updateSidebarStats();
                }
            });

            // Preset Buttons wiring
            const presetButtons = this.container.querySelectorAll('.btn-preset');
            presetButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const presetType = btn.getAttribute('data-preset');
                    const blueprints = db.getBlueprints();
                    let name = "", category = "health", time = "morning", identityIndex = 0, twomin = "", trigger = "", cue = "", reward = "";

                    if (presetType === 'shower') {
                        name = "Morning Shower & Teeth";
                        category = "health";
                        time = "morning";
                        twomin = "Brush teeth and wash face for 30 seconds";
                        trigger = "After I step out of bed in the morning";
                        cue = "Clean towel and soap prepared on bathroom counter";
                        reward = "Enjoy the refreshing, clean smell of soap";
                        const idx = blueprints.identities.findIndex(id => id.title.toLowerCase().includes('clean') || id.title.toLowerCase().includes('hygiene') || id.title.toLowerCase().includes('health'));
                        if (idx !== -1) identityIndex = idx;
                    } else if (presetType === 'kitchen') {
                        name = "Kitchen Tidy";
                        category = "mind";
                        time = "evening";
                        twomin = "Place 3 dishes into the dishwasher";
                        trigger = "After I finish eating dinner";
                        cue = "Kitchen sink empty of large obstacles";
                        reward = "Walking into a clean kitchen tomorrow morning";
                        const idx = blueprints.identities.findIndex(id => id.title.toLowerCase().includes('organized') || id.title.toLowerCase().includes('mindful') || id.title.toLowerCase().includes('neat') || id.title.toLowerCase().includes('system') || id.title.toLowerCase().includes('cleanliness'));
                        if (idx !== -1) identityIndex = idx;
                    } else if (presetType === 'bed') {
                        name = "Bedroom Bed Setup";
                        category = "mind";
                        time = "morning";
                        twomin = "Pull up sheets and arrange pillows";
                        trigger = "After I stand up from bed";
                        cue = "Pillows positioned at bed head";
                        reward = "Enjoying an organized bedroom space";
                        const idx = blueprints.identities.findIndex(id => id.title.toLowerCase().includes('organized') || id.title.toLowerCase().includes('mindful') || id.title.toLowerCase().includes('neat') || id.title.toLowerCase().includes('system') || id.title.toLowerCase().includes('cleanliness'));
                        if (idx !== -1) identityIndex = idx;
                    } else if (presetType === 'declutter') {
                        name = "Declutter & Arrange Room";
                        category = "mind";
                        time = "evening";
                        twomin = "Put away 3 items in bedroom";
                        trigger = "After I arrive home from the office";
                        cue = "Bedroom floor clear of stray clothes";
                        reward = "Calm and peaceful bedroom environment before sleeping";
                        const idx = blueprints.identities.findIndex(id => id.title.toLowerCase().includes('organized') || id.title.toLowerCase().includes('mindful') || id.title.toLowerCase().includes('neat') || id.title.toLowerCase().includes('system') || id.title.toLowerCase().includes('cleanliness'));
                        if (idx !== -1) identityIndex = idx;
                    }

                    this.container.querySelector('#new-habit-name').value = name;
                    this.container.querySelector('#new-habit-category').value = category;
                    this.container.querySelector('#new-habit-time').value = time;
                    this.container.querySelector('#new-habit-twomin').value = twomin;
                    this.container.querySelector('#new-habit-trigger').value = trigger;
                    this.container.querySelector('#new-habit-cue').value = cue;
                    this.container.querySelector('#new-habit-reward').value = reward;

                    if (blueprints.identities.length > 0) {
                        const sel = this.container.querySelector('#new-habit-identity');
                        if (sel && sel.options[identityIndex]) {
                            sel.selectedIndex = identityIndex;
                        }
                    }
                });
            });
        }
    }
};

// =========================================================================
// 6. ANALYTICS VIEW COMPONENT
// =========================================================================
const Analytics = {
    chartInstance1: null,
    chartInstance2: null,

    render(container) {
        this.container = container;
        this.updateView();
    },

    updateView() {
        const stats = AtomicManager.getGlobalStats();
        const habits = db.getHabits();
        const logs = db.logs;
        const blueprints = db.getBlueprints();

        // 1. SLEEP & WELLBEING CATALYST MATH
        let totalSleepHours = 0;
        let sleepCount = 0;
        let sleepQualitySum = 0;
        let goodSleepCompletions = 0;
        let goodSleepPossible = 0;
        let lowSleepCompletions = 0;
        let lowSleepPossible = 0;

        Object.keys(logs).forEach(dateStr => {
            const log = logs[dateStr];
            if (log.sleepBedtime && log.sleepWakeup) {
                const duration = AtomicManager.calculateSleepDuration(log.sleepBedtime, log.sleepWakeup);
                totalSleepHours += duration;
                sleepCount++;
                sleepQualitySum += (log.sleepQuality || 2);
                
                const isGoodSleep = duration >= 7.0 || (log.sleepQuality && log.sleepQuality >= 3);
                const completionsCount = log.completions 
                    ? Object.keys(log.completions).filter(hId => habits.some(h => h.id === hId) && log.completions[hId].completed).length 
                    : 0;
                
                const logTime = new Date(dateStr).getTime() + (24 * 60 * 60 * 1000);
                const activeHabitsOnDate = habits.filter(h => h.createdAt <= logTime);
                
                if (isGoodSleep) {
                    goodSleepCompletions += completionsCount;
                    goodSleepPossible += activeHabitsOnDate.length;
                } else {
                    lowSleepCompletions += completionsCount;
                    lowSleepPossible += activeHabitsOnDate.length;
                }
            }
        });

        const avgSleepHours = sleepCount > 0 ? Math.round((totalSleepHours / sleepCount) * 10) / 10 : 0;
        const avgSleepQuality = sleepCount > 0 ? Math.round((sleepQualitySum / sleepCount) * 10) / 10 : 0;
        
        const goodSleepRate = goodSleepPossible > 0 ? Math.round((goodSleepCompletions / goodSleepPossible) * 100) : 0;
        const lowSleepRate = lowSleepPossible > 0 ? Math.round((lowSleepCompletions / lowSleepPossible) * 100) : 0;

        // 2. IDENTITY PILLARS PERFORMANCE MATH
        const identityStats = blueprints.identities.map(idObj => {
            let possible = 0;
            let completed = 0;
            const idHabits = habits.filter(h => h.identity === idObj.title);
            
            Object.keys(logs).forEach(dateStr => {
                const logDate = new Date(dateStr).getTime() + (24 * 60 * 60 * 1000);
                const activeIdHabits = idHabits.filter(h => h.createdAt <= logDate);
                
                possible += activeIdHabits.length;
                
                if (logs[dateStr].completions) {
                    activeIdHabits.forEach(h => {
                        if (logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                            completed++;
                        }
                    });
                }
            });
            
            const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
            return {
                title: idObj.title,
                proof: idObj.proof,
                rate,
                completed,
                possible
            };
        });

        // 3. TIME-OF-DAY ROUTINE BREAKDOWN
        let morningPossible = 0;
        let morningCompleted = 0;
        let eveningPossible = 0;
        let eveningCompleted = 0;

        Object.keys(logs).forEach(dateStr => {
            const logDate = new Date(dateStr).getTime() + (24 * 60 * 60 * 1000);
            const activeMorning = habits.filter(h => h.timeOfDay === 'morning' && h.createdAt <= logDate);
            const activeEvening = habits.filter(h => h.timeOfDay === 'evening' && h.createdAt <= logDate);
            
            morningPossible += activeMorning.length;
            eveningPossible += activeEvening.length;
            
            if (logs[dateStr].completions) {
                activeMorning.forEach(h => {
                    if (logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                        morningCompleted++;
                    }
                });
                activeEvening.forEach(h => {
                    if (logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                        eveningCompleted++;
                    }
                });
            }
        });

        const morningRate = morningPossible > 0 ? Math.round((morningCompleted / morningPossible) * 100) : 0;
        const eveningRate = eveningPossible > 0 ? Math.round((eveningCompleted / eveningPossible) * 100) : 0;

        // 4. INDIVIDUAL HABIT PERFORMANCE MATH
        const habitStats = habits.map(h => {
            let possible = 0;
            let completed = 0;
            let twoMinCount = 0;
            
            Object.keys(logs).forEach(dateStr => {
                const logDate = new Date(dateStr).getTime() + (24 * 60 * 60 * 1000);
                if (h.createdAt <= logDate) {
                    possible++;
                    if (logs[dateStr].completions && logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                        completed++;
                        if (logs[dateStr].completions[h.id].isTwoMinute) {
                            twoMinCount++;
                        }
                    }
                }
            });
            
            const rate = possible > 0 ? Math.round((completed / possible) * 100) : 0;
            const streak = AtomicManager.calculateStreak(h.id);
            
            return {
                habit: h,
                possible,
                completed,
                twoMinCount,
                rate,
                streak: streak.current,
                longestStreak: streak.longest
            };
        });

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                <div class="view-grid" style="margin-bottom: 2rem;">
                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md);">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: var(--sidebar-active-bg); display: flex; align-items: center; justify-content: center; color: var(--primary); border: 1px solid var(--border-color);">
                            <i data-lucide="percent" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Global Consistency</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px;">${stats.consistencyScore}%</h3>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md);">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(30, 142, 62, 0.08); display: flex; align-items: center; justify-content: center; color: var(--color-success); border: 1px solid rgba(30, 142, 62, 0.15);">
                            <i data-lucide="check-circle-2" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Total Habits Met</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px;">${stats.totalCheckoffs}</h3>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md);">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(227, 116, 0, 0.08); display: flex; align-items: center; justify-content: center; color: var(--color-warning); border: 1px solid rgba(227, 116, 0, 0.15);">
                            <i data-lucide="flame" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Longest Streak</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px;">${stats.longestStreakGlobal} <span style="font-size: 0.78rem; font-weight: 500; color: var(--text-secondary);">days</span></h3>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md);">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: var(--sidebar-active-bg); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                            <i data-lucide="clock" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">2-Min Micro Wins</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px;">${stats.twoMinRuleCount}</h3>
                        </div>
                    </div>
                </div>

                <div class="glass-card" style="margin-bottom: 2rem; padding: 1.25rem 1.5rem; border-radius: var(--radius-md);">
                    <div class="card-header-flex" style="margin-bottom: 1.25rem;">
                        <div>
                            <h3 class="card-title" style="font-weight: 500;"><i data-lucide="grid" style="color: var(--primary);"></i> 1% Better Daily Contribution Heatmap</h3>
                            <p class="card-subtitle" style="font-size: 0.8rem;">Visual intensity of habit repetitions achieved over the past 20 weeks.</p>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center; font-size: 0.72rem; color: var(--text-secondary);">
                            <span>Less</span>
                            <div style="width: 10px; height: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #d8b4fe; border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #c084fc; border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #a855f7; border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #1a73e8; border-radius: 2px;"></div>
                            <span>More</span>
                        </div>
                    </div>
                    
                    <div class="heatmap-container">
                        <div class="heatmap-grid" id="heatmap-cells-grid">
                            ${this._renderHeatmapCells()}
                        </div>
                    </div>
                </div>

                <div class="view-grid" style="margin-bottom: 2rem;">
                    <div class="glass-card" style="grid-column: span 8; border-radius: var(--radius-md);">
                        <h3 class="card-title" style="margin-bottom: 1.25rem; font-weight: 500;">
                            <i data-lucide="trending-up" style="color: var(--primary);"></i> Habits & Wellbeing Correlation
                        </h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="correlationChart"></canvas>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 4; border-radius: var(--radius-md);">
                        <h3 class="card-title" style="margin-bottom: 1.25rem; font-weight: 500;">
                            <i data-lucide="pie-chart" style="color: var(--color-success);"></i> Category Breakdown
                        </h3>
                        <div style="position: relative; height: 300px; width: 100%; display: flex; align-items: center; justify-content: center;">
                            <canvas id="categoryChart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="view-grid" style="margin-bottom: 2rem;">
                    <!-- Sleep & Wellbeing Correlation Card -->
                    <div class="glass-card" style="grid-column: span 6; border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                        <h3 class="card-title" style="font-weight: 500; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="moon" style="color: var(--primary);"></i> Sleep & Wellbeing Catalyst
                        </h3>
                        <p class="card-subtitle" style="font-size: 0.8rem; margin-bottom: 0.5rem;">See how sleep baseline directly shapes your energy levels and habit completion rates.</p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; text-align: center;">
                                <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Avg Sleep Duration</span>
                                <h4 style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--primary);">${avgSleepHours} hrs</h4>
                                <span style="font-size: 0.65rem; color: var(--text-secondary);">Target: 7.0 - 9.0 hrs</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); padding: 0.75rem; border-radius: 8px; text-align: center;">
                                <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Sleep Quality Score</span>
                                <h4 style="font-size: 1.5rem; font-weight: 700; margin-top: 4px; color: var(--color-success);">${avgSleepQuality} / 3.0</h4>
                                <span style="font-size: 0.65rem; color: var(--text-secondary);">Subjective average</span>
                            </div>
                        </div>

                        <div style="background: rgba(184, 240, 100, 0.03); border: 1px dashed rgba(184, 240, 100, 0.15); padding: 1rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.5; color: var(--text-secondary);">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">
                                <span>Habit rate on <strong>Good Sleep</strong> days (&ge;7h):</span>
                                <strong style="color: var(--color-success);">${goodSleepRate}%</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                                <span>Habit rate on <strong>Low Sleep</strong> days (<7h):</span>
                                <strong style="color: var(--color-warning);">${lowSleepRate}%</strong>
                            </div>
                            <div style="font-style: italic; color: var(--text-primary); font-size: 0.75rem;">
                                <strong>💡 James Clear Insight:</strong> 
                                ${goodSleepRate > lowSleepRate 
                                    ? `Your sleep quality is a clear catalyst for your home routines! You are ${goodSleepRate - lowSleepRate}% more consistent when resting 7+ hours. Make early sleep an obvious cue tonight.` 
                                    : "Keep sleep duration consistent! A stable recovery routine is the foundation for low-friction morning habits. Focus on maintaining a clean sleep window."}
                            </div>
                        </div>
                    </div>

                    <!-- Identity Pillars & Time-of-Day Performance Card -->
                    <div class="glass-card" style="grid-column: span 6; border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
                        <h3 class="card-title" style="font-weight: 500; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="fingerprint" style="color: var(--color-warning);"></i> Identity Pillars & Timing Analysis
                        </h3>
                        <p class="card-subtitle" style="font-size: 0.8rem; margin-bottom: 0.25rem;">Percentage of proofs fulfilled for your Identity and success by home timing.</p>

                        <!-- Identity Pillars visual progress -->
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Identity Verification Scores:</span>
                            ${identityStats.map(id => `
                                <div>
                                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 4px; color: var(--text-primary);">
                                        <span>"${id.title}"</span>
                                        <span style="color: var(--primary);">${id.rate}% (${id.completed}/${id.possible})</span>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${id.rate}%; height: 100%; background: linear-gradient(90deg, var(--primary), #b8f064); border-radius: 4px;"></div>
                                    </div>
                                </div>
                            `).join('') || '<div style="font-size:0.75rem; color:var(--text-muted);">Create Identity Pillars to view compliance scores.</div>'}
                        </div>

                        <!-- Time of day visual progress -->
                        <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; margin-top: auto;">
                            <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Routine Performance by Home Timing:</span>
                            <div style="display: flex; gap: 1rem; align-items: center;">
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
                                        <span>🌅 Morning</span>
                                        <strong>${morningRate}%</strong>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${morningRate}%; height: 100%; background: #f5b942; border-radius: 4px;"></div>
                                    </div>
                                </div>
                                <div style="flex: 1;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
                                        <span>🌙 Evening</span>
                                        <strong>${eveningRate}%</strong>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${eveningRate}%; height: 100%; background: #a855f7; border-radius: 4px;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Individual Habit Analysis Row -->
                <div class="glass-card" style="margin-bottom: 2rem; padding: 1.5rem; border-radius: var(--radius-md);">
                    <h3 class="card-title" style="margin-bottom: 0.5rem; font-weight: 500; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="activity" style="color: var(--primary);"></i> 4. Individual Habit Performance Statistics
                    </h3>
                    <p class="card-subtitle" style="margin-bottom: 1.5rem; font-size: 0.8rem;">Track and review the full execution analysis and streak statistics for each specific home habit.</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        ${habitStats.map(hs => {
                            const timingTag = hs.habit.timeOfDay === 'morning' ? '🌅 Morning' : '🌙 Evening';
                            const streakBadgeColor = hs.streak >= 5 ? 'background: rgba(239, 68, 68, 0.1); color: #ef4444; border-color: rgba(239,68,68,0.2);' : 'background: rgba(255, 255, 255, 0.02); color: var(--text-secondary); border-color: var(--border-color);';
                            
                            return `
                                <div class="animate-fade-in" style="background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; display: grid; grid-template-columns: minmax(200px, 2fr) 2fr minmax(180px, 1.2fr); gap: 1.5rem; align-items: center;">
                                    
                                    <!-- Column 1: Habit Details -->
                                    <div style="display: flex; flex-direction: column; gap: 6px;">
                                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                            <span style="font-size: 0.92rem; font-weight: 600; color: var(--text-primary);">${hs.habit.name}</span>
                                            <span class="habit-category cat-${hs.habit.category}" style="font-size: 0.65rem; padding: 1px 6px;">${hs.habit.category}</span>
                                            <span style="font-size: 0.65rem; padding: 1px 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-muted); font-weight: 500;">${timingTag}</span>
                                        </div>
                                        <span style="font-size: 0.72rem; color: var(--text-secondary); font-style: italic;">Linked: "${hs.habit.identity || 'better today'}"</span>
                                    </div>

                                    <!-- Column 2: Completion Progress Bar -->
                                    <div style="display: flex; flex-direction: column; gap: 4px;">
                                        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600;">
                                            <span style="color: var(--text-muted);">Overall Consistency:</span>
                                            <span style="color: var(--primary);">${hs.rate}% (${hs.completed} / ${hs.possible} days)</span>
                                        </div>
                                        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                            <div style="width: ${hs.rate}%; height: 100%; background: linear-gradient(90deg, var(--primary), #b8f064); border-radius: 4px;"></div>
                                        </div>
                                    </div>

                                    <!-- Column 3: Streaks & 2-Min Rules Saved -->
                                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap;">
                                        ${hs.twoMinCount > 0 ? `
                                            <div style="background: rgba(26, 115, 232, 0.08); color: var(--primary); border: 1px solid rgba(26, 115, 232, 0.15); font-size: 0.7rem; font-weight: 700; padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Streak saves using low energy alternatives">
                                                <i data-lucide="zap" style="width: 10px; height: 10px; fill: var(--primary);"></i> ${hs.twoMinCount} Saved
                                            </div>
                                        ` : ''}
                                        
                                        <div style="font-size: 0.72rem; font-weight: 700; border: 1px solid; padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; ${streakBadgeColor}">
                                            <i data-lucide="flame" style="width: 12px; height: 12px; fill: currentColor;"></i> ${hs.streak}d Current
                                        </div>
                                        
                                        <div style="background: rgba(184, 240, 100, 0.08); color: var(--color-success); border: 1px solid rgba(184, 240, 100, 0.15); font-size: 0.72rem; font-weight: 700; padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">
                                            <i data-lucide="award" style="width: 12px; height: 12px;"></i> ${hs.longestStreak}d Max
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('') || '<div style="text-align: center; padding: 2rem; color: var(--text-muted); border: 1px dashed var(--border-color); border-radius: 12px;">Create and track habits to see individual details here.</div>'}
                    </div>
                </div>
            </div>
        `;

        lucide.createIcons();
        setTimeout(() => {
            this._renderCharts();
        }, 100);
    },

    _renderHeatmapCells() {
        const today = new Date();
        const numWeeks = 20;
        const totalDays = numWeeks * 7;
        
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - totalDays + 1);
        
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);

        let html = '';
        const habits = db.getHabits();
        
        for (let i = 0; i < totalDays + dayOfWeek; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            const dateStr = currentDate.toISOString().split('T')[0];
            
            const log = db.logs[dateStr];
            let level = 0;
            let count = 0;

            if (log && log.completions) {
                count = Object.keys(log.completions).filter(hId => {
                    return habits.some(h => h.id === hId) && log.completions[hId].completed;
                }).length;
            }

            if (count > 0) {
                if (count === 1) level = 1;
                else if (count === 2) level = 2;
                else if (count === 3) level = 3;
                else level = 4;
            }

            const formattedDate = currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const tooltipText = `${formattedDate}: ${count} habit${count === 1 ? '' : 's'} completed`;
            html += `<div class="heatmap-cell level-${level}" data-date="${dateStr}" data-tooltip="${tooltipText}"></div>`;
        }
        return html;
    },

    _renderCharts() {
        if (this.chartInstance1) this.chartInstance1.destroy();
        if (this.chartInstance2) this.chartInstance2.destroy();

        const habits = db.getHabits();
        const logs = db.logs;
        
        const dateLabels = [];
        const moodData = [];
        const completionPctData = [];

        const today = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            const labelStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            dateLabels.push(labelStr);

            const log = db.getLogForDate(dateStr);
            const mood = log.mood || 0;
            moodData.push(mood > 0 ? mood * 20 : null);

            const activeHabitsOnDate = habits.filter(h => h.createdAt <= (d.getTime() + 24 * 60 * 60 * 1000));
            const done = log.completions 
                ? Object.keys(log.completions).filter(hId => activeHabitsOnDate.some(h => h.id === hId) && log.completions[hId].completed).length 
                : 0;
            
            const pct = activeHabitsOnDate.length > 0 ? Math.round((done / activeHabitsOnDate.length) * 100) : 0;
            completionPctData.push(log.mood ? pct : null); 
        }

        const ctx1 = document.getElementById('correlationChart');
        if (ctx1 && window.Chart) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const textColor = isDark ? '#94a3b8' : '#475569';
            const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

            this.chartInstance1 = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: dateLabels,
                    datasets: [
                        {
                            label: 'Productivity Flow (%)',
                            data: completionPctData,
                            borderColor: '#1a73e8',
                            backgroundColor: 'rgba(26, 115, 232, 0.03)',
                            borderWidth: 2,
                            tension: 0.35,
                            fill: true,
                            spanGaps: true
                        },
                        {
                            label: 'Subjective Mood (%)',
                            data: moodData,
                            borderColor: '#e37400',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            tension: 0.35,
                            fill: false,
                            spanGaps: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: textColor, font: { family: 'Inter', weight: '600' } } }
                    },
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: { color: textColor, callback: (v) => v + '%' },
                            grid: { color: gridColor }
                        },
                        x: {
                            ticks: { color: textColor },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        const completionsByCat = { health: 0, mind: 0, career: 0, relations: 0 };
        Object.keys(logs).forEach(dateStr => {
            const log = logs[dateStr];
            if (log.completions) {
                Object.keys(log.completions).forEach(hId => {
                    const h = habits.find(habit => habit.id === hId);
                    if (h && log.completions[hId].completed) {
                        completionsByCat[h.category]++;
                    }
                });
            }
        });

        const ctx2 = document.getElementById('categoryChart');
        if (ctx2 && window.Chart) {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const textColor = isDark ? '#94a3b8' : '#475569';

            this.chartInstance2 = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Health', 'Mind'],
                    datasets: [{
                        data: [
                            completionsByCat.health,
                            completionsByCat.mind
                        ],
                        backgroundColor: ['#1e8e3e', '#1a73e8'],
                        borderWidth: isDark ? 2 : 1,
                        borderColor: isDark ? '#202124' : '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: textColor, font: { family: 'Inter', weight: '600' } }
                        }
                    },
                    cutout: '65%'
                }
            });
        }
    }
};

// =========================================================================
// 7. SETTINGS VIEW COMPONENT
// =========================================================================
const Settings = {
    render(container) {
        this.container = container;
        this.updateView();
    },

    updateView() {
        const settings = db.getSettings();
        const appsScriptCode = `function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (action === 'test') {
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'pull') {
    var sheet = ss.getSheetByName("RAW_DATA");
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({})).setMimeType(ContentService.MimeType.JSON);
    var jsonStr = sheet.getRange("A1").getValue();
    return ContentService.createTextOutput(jsonStr).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawSheet = ss.getSheetByName("RAW_DATA") || ss.insertSheet("RAW_DATA");
  rawSheet.getRange("A1").setValue(JSON.stringify(data));
  
  var habitSheet = ss.getSheetByName("VIEW_HABITS") || ss.insertSheet("VIEW_HABITS");
  habitSheet.clear();
  habitSheet.appendRow(["Habit ID", "Name", "Category", "Cue", "Two-Minute Version", "Trigger Stack"]);
  if (data.habits) {
    data.habits.forEach(function(h) {
      if (h.active) {
        habitSheet.appendRow([h.id, h.name, h.category, h.cue || '', h.twoMinuteVersion || '', h.stackTrigger || '']);
      }
    });
  }
  
  var logsSheet = ss.getSheetByName("VIEW_DAILY_LOGS") || ss.insertSheet("VIEW_DAILY_LOGS");
  logsSheet.clear();
  logsSheet.appendRow(["Date", "Mood", "Energy", "Wins", "Tomorrow Pivot", "Journal Notes", "Bedtime", "Wake Up", "Sleep Hours"]);
  if (data.logs) {
    Object.keys(data.logs).sort().forEach(function(dateKey) {
      var log = data.logs[dateKey];
      var sleepHrs = 0;
      if (log.sleepBedtime && log.sleepWakeup) {
        // Sleep Duration calculation
        var bed = log.sleepBedtime.split(':').map(Number);
        var wake = log.sleepWakeup.split(':').map(Number);
        var bedD = new Date(2020, 0, 1, bed[0], bed[1]);
        var wakeD = new Date(2020, 0, 1, wake[0], wake[1]);
        if (wakeD <= bedD) wakeD.setDate(wakeD.getDate() + 1);
        sleepHrs = Math.round(((wakeD - bedD) / (1000 * 60 * 60)) * 10) / 10;
      }
      logsSheet.appendRow([
        dateKey, 
        log.mood || 0, 
        log.energy || 0, 
        (log.wins || []).join(" | "), 
        log.improvement || '', 
        log.journalNotes || '',
        log.sleepBedtime || '',
        log.sleepWakeup || '',
        sleepHrs
      ]);
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
}`;

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                <div class="view-grid">
                    <!-- Left: Profile -->
                    <div style="grid-column: span 5; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="border-radius: var(--radius-md);">
                            <h3 class="card-title" style="margin-bottom: 1.25rem; font-weight: 500;">
                                <i data-lucide="user" style="color: var(--primary);"></i> Personal Profile
                            </h3>
                            <div class="form-group">
                                <label>Your Display Name</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="text" id="username-input" class="form-control" value="${settings.userName}" style="flex: 1; border-radius: 8px;">
                                    <button class="btn btn-primary" id="btn-save-username" style="padding: 0.75rem 1.25rem; border-radius: 8px;">Save</button>
                                </div>
                            </div>
                        </div>

                        <div class="glass-card" style="border-radius: var(--radius-md);">
                            <h3 class="card-title" style="margin-bottom: 1.25rem; font-weight: 500;">
                                <i data-lucide="palette" style="color: var(--color-success);"></i> System Appearance
                            </h3>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.9rem; color: var(--text-secondary); font-weight: 500;">Theme Toggle</span>
                                <div class="theme-switch-btn">
                                    <button class="theme-btn ${settings.theme === 'light' ? 'active' : ''}" id="btn-theme-light" title="Light Theme"><i data-lucide="sun"></i></button>
                                    <button class="theme-btn ${settings.theme === 'dark' ? 'active' : ''}" id="btn-theme-dark" title="Dark Theme"><i data-lucide="moon"></i></button>
                                </div>
                            </div>
                        </div>

                        <div class="glass-card" style="border-radius: var(--radius-md);">
                            <h3 class="card-title" style="color: var(--color-danger); margin-bottom: 0.5rem; font-weight: 500;">
                                <i data-lucide="database"></i> Local Database Storage
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1.25rem;">Directly manage your local browser files.</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <button class="btn btn-secondary" id="btn-export-db" style="justify-content: flex-start; width: 100%; border-radius: 8px;"><i data-lucide="download"></i> Export Database (JSON)</button>
                                
                                <div style="display: flex; flex-direction: column; gap: 0.5rem; background: var(--bg-primary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Import Database String</label>
                                    <textarea id="import-json-string" class="form-control" style="font-size: 0.75rem; font-family: monospace; min-height: 50px; border-radius: 8px;" placeholder="Paste exported JSON string here..."></textarea>
                                    <button class="btn btn-primary" id="btn-import-db" style="font-size: 0.75rem; padding: 0.4rem 1rem; align-self: flex-end; border-radius: 8px;"><i data-lucide="upload-cloud"></i> Import JSON</button>
                                </div>

                                <button class="btn btn-danger" id="btn-reset-db" style="justify-content: flex-start; width: 100%; border-radius: 8px;"><i data-lucide="refresh-cw"></i> Reset Database</button>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Cloud Sync -->
                    <div style="grid-column: span 7; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.5rem 1.75rem; border-radius: var(--radius-md);">
                            <div class="card-header-flex" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                                <div>
                                    <h3 class="card-title" style="font-weight: 500;"><i data-lucide="share-2" style="color: var(--primary);"></i> Google Sheets Cloud Sync</h3>
                                    <p class="card-subtitle">Secure personal sync where you own 100% of the spreadsheet data.</p>
                                </div>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 1.25rem; background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label>Google Apps Script Web App URL</label>
                                    <input type="text" id="sheets-url-input" class="form-control" style="border-radius: 8px;" value="${settings.sheetsUrl || ''}" placeholder="https://script.google.com/macros/s/.../exec">
                                </div>

                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                                    <label class="checkbox-wrapper" style="width: auto; height: auto; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">
                                        <input type="checkbox" id="auto-sync-checkbox" ${settings.autoSync ? 'checked' : ''}>
                                        <span class="checkmark" style="width: 18px; height: 18px; border-radius: 4px; border-width: 1px;"><i data-lucide="check" style="width: 10px; height: 10px;"></i></span>
                                        <span>Auto-sync logs on checklist actions</span>
                                    </label>
                                    <span id="sync-conn-badge" class="badge" style="background: rgba(217, 48, 37, 0.1); color: #d93025; border: 1px solid rgba(217, 48, 37, 0.15); padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
                                        Disconnected
                                    </span>
                                </div>

                                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;">
                                    <button class="btn btn-secondary" id="btn-test-sync" style="font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 12px;"><i data-lucide="activity"></i> Test Link</button>
                                    <button class="btn btn-secondary" id="btn-pull-sync" style="font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 12px;"><i data-lucide="arrow-down-to-line"></i> Pull Cloud</button>
                                    <button class="btn btn-primary" id="btn-push-sync" style="font-size: 0.85rem; padding: 0.5rem 1rem; border-radius: 12px;"><i data-lucide="arrow-up-from-line"></i> Push Cloud</button>
                                </div>
                            </div>

                            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="help-circle" style="color: var(--primary);"></i> Setup Walkthrough (5 Minutes)
                            </h4>
                            
                            <div class="setup-guide">
                                <div class="step-card" style="border-radius: 8px;">
                                    <div class="step-num">1</div>
                                    <div class="step-body">
                                        <h5>Create a Google Spreadsheet</h5>
                                        <p>Go to Google Drive, create a blank Google Spreadsheet named <strong>"My Habits Log"</strong>.</p>
                                    </div>
                                </div>
                                <div class="step-card" style="border-radius: 8px;">
                                    <div class="step-num">2</div>
                                    <div class="step-body">
                                        <h5>Open Apps Script Editor</h5>
                                        <p>In your spreadsheet menu, click <strong>Extensions</strong> &rarr; <strong>Apps Script</strong>. Clear existing code.</p>
                                    </div>
                                </div>
                                <div class="step-card" style="flex-direction: column; gap: 0.5rem; border-radius: 8px;">
                                    <div style="display: flex; gap: 1rem;">
                                        <div class="step-num">3</div>
                                        <div class="step-body">
                                            <h5>Paste Sync Code</h5>
                                            <p>Copy the code below and paste it directly into the editor.</p>
                                        </div>
                                    </div>
                                    <div class="code-snippet-box">
                                        <button class="btn-copy" id="btn-copy-code"><i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy Code</button>
                                        <pre><code id="script-code-content">${appsScriptCode}</code></pre>
                                    </div>
                                </div>
                                <div class="step-card" style="border-radius: 8px;">
                                    <div class="step-num">4</div>
                                    <div class="step-body">
                                        <h5>Deploy Web App</h5>
                                        <p>Click <strong>Deploy</strong> &rarr; <strong>New deployment</strong>. Choose type: <strong>Web app</strong>. Execute as: "Me", access: "Anyone". Click Deploy.</p>
                                    </div>
                                </div>
                                <div class="step-card" style="border-radius: 8px;">
                                    <div class="step-num">5</div>
                                    <div class="step-body">
                                        <h5>Connect</h5>
                                        <p>Authorize script permissions, copy the generated Web App URL, paste it in the box above, and click <strong>Test Link</strong>!</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Generic Toast feedback -->
            <div id="settings-toast" class="glass-card animate-slide-up" style="position: fixed; bottom: 2rem; right: 2rem; background: var(--grad-primary); color: #ffffff; padding: 0.75rem 1.5rem; border-radius: var(--radius-sm); box-shadow: var(--glass-shadow); z-index: 10000; border: none; display: none;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                    <i data-lucide="check" style="width: 20px; height: 20px;"></i>
                    <span id="settings-toast-msg">Settings saved!</span>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
        this._checkActiveConnection();
    },

    _setupListeners() {
        this.container.querySelector('#btn-save-username').addEventListener('click', () => {
            const name = this.container.querySelector('#username-input').value.trim();
            if (name) {
                db.saveSettings({ userName: name });
                const welcomeTitle = document.querySelector('.welcome-msg h1');
                if (welcomeTitle) {
                    const hr = new Date().getHours();
                    let greet = 'Good morning';
                    if (hr >= 12 && hr < 17) greet = 'Good afternoon';
                    else if (hr >= 17) greet = 'Good evening';
                    welcomeTitle.innerHTML = `${greet}, <span class="text-gradient">${name}</span>!`;
                }
                this._showToast("Username updated!");
            }
        });

        this.container.querySelector('#btn-theme-light').addEventListener('click', () => {
            this._toggleTheme('light');
        });
        
        this.container.querySelector('#btn-theme-dark').addEventListener('click', () => {
            this._toggleTheme('dark');
        });

        this.container.querySelector('#btn-copy-code').addEventListener('click', () => {
            const code = this.container.querySelector('#script-code-content').innerText;
            navigator.clipboard.writeText(code).then(() => {
                this._showToast("Code copied!");
            });
        });

        this.container.querySelector('#btn-export-db').addEventListener('click', () => {
            const fullDb = { habits: db.habits, logs: db.logs, blueprints: db.blueprints, settings: db.settings };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullDb, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", `atomicflow_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
        });

        this.container.querySelector('#btn-import-db').addEventListener('click', () => {
            const jsonText = this.container.querySelector('#import-json-string').value.trim();
            if (!jsonText) return alert("Please paste database string.");

            try {
                const imported = JSON.parse(jsonText);
                if (imported.habits && imported.logs && imported.blueprints) {
                    db.habits = imported.habits;
                    db.logs = imported.logs;
                    db.blueprints = imported.blueprints;
                    
                    db._save('habits', db.habits);
                    db._save('logs', db.logs);
                    db._save('blueprints', db.blueprints);
                    
                    if (imported.settings) {
                        db.settings = imported.settings;
                        db._save('settings', db.settings);
                    }
                    alert("Import successful! Reloading...");
                    window.location.reload();
                } else {
                    alert("JSON format is incorrect.");
                }
            } catch (e) {
                alert("Invalid JSON: " + e.message);
            }
        });

        this.container.querySelector('#btn-reset-db').addEventListener('click', () => {
            if (confirm("permanently reset back to templates?")) {
                localStorage.clear();
                window.location.reload();
            }
        });

        this.container.querySelector('#btn-test-sync').addEventListener('click', async () => {
            const url = this.container.querySelector('#sheets-url-input').value.trim();
            if (!url) return alert("Enter URL.");

            const btn = this.container.querySelector('#btn-test-sync');
            btn.innerHTML = `<i data-lucide="loader" class="animate-pulse"></i> Connecting...`;
            lucide.createIcons();

            try {
                const ok = await db.testSheetsConnection(url);
                if (ok) {
                    db.saveSettings({ sheetsUrl: url });
                    this._updateConnectionBadge(true);
                    this._showToast("Connection Successful!");
                } else {
                    this._updateConnectionBadge(false);
                    alert("Invalid sheets script response.");
                }
            } catch (e) {
                this._updateConnectionBadge(false);
                alert("Connection failed! Make sure script is deployed for Anyone.");
            } finally {
                btn.innerHTML = `<i data-lucide="activity"></i> Test Link`;
                lucide.createIcons();
            }
        });

        this.container.querySelector('#btn-pull-sync').addEventListener('click', async () => {
            const settings = db.getSettings();
            if (!settings.sheetsUrl) return alert("Configure sync sheet first.");

            const btn = this.container.querySelector('#btn-pull-sync');
            btn.innerHTML = `<i data-lucide="loader"></i> Pulling...`;
            lucide.createIcons();

            try {
                const ok = await db.pullFromGoogleSheets();
                if (ok) {
                    alert("Cloud data synchronized! Reloading dashboard...");
                    window.location.reload();
                }
            } catch (e) {
                alert("Sync pull failed: " + e.message);
            } finally {
                btn.innerHTML = `<i data-lucide="arrow-down-to-line"></i> Pull Cloud`;
                lucide.createIcons();
            }
        });

        this.container.querySelector('#btn-push-sync').addEventListener('click', async () => {
            const settings = db.getSettings();
            if (!settings.sheetsUrl) return alert("Configure sync sheet first.");

            const btn = this.container.querySelector('#btn-push-sync');
            btn.innerHTML = `<i data-lucide="loader"></i> Pushing...`;
            lucide.createIcons();

            try {
                const ok = await db.pushToGoogleSheets();
                if (ok) this._showToast("Spreadsheet backup completed!");
            } catch (e) {
                alert("Sync push failed: " + e.message);
            } finally {
                btn.innerHTML = `<i data-lucide="arrow-up-from-line"></i> Push Cloud`;
                lucide.createIcons();
            }
        });

        this.container.querySelector('#auto-sync-checkbox').addEventListener('change', (e) => {
            db.saveSettings({ autoSync: e.target.checked });
            this._showToast("Auto-sync preferences saved.");
        });
    },

    _toggleTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        db.saveSettings({ theme });
        
        const btnLight = this.container.querySelector('#btn-theme-light');
        const btnDark = this.container.querySelector('#btn-theme-dark');
        
        if (theme === 'light') {
            btnLight.classList.add('active');
            btnDark.classList.remove('active');
        } else {
            btnLight.classList.remove('active');
            btnDark.classList.add('active');
        }
        this._showToast(`Switched to ${theme} theme.`);
    },

    async _checkActiveConnection() {
        const settings = db.getSettings();
        if (settings.sheetsUrl) {
            try {
                const ok = await db.testSheetsConnection(settings.sheetsUrl);
                this._updateConnectionBadge(ok);
            } catch (e) {
                this._updateConnectionBadge(false);
            }
        }
    },

    _updateConnectionBadge(connected) {
        const badge = this.container.querySelector('#sync-conn-badge');
        if (badge) {
            if (connected) {
                badge.innerText = "Connected";
                badge.style.background = "rgba(19, 115, 51, 0.1)";
                badge.style.color = "#137333";
                badge.style.borderColor = "rgba(19, 115, 51, 0.15)";
            } else {
                badge.innerText = "Disconnected";
                badge.style.background = "rgba(217, 48, 37, 0.1)";
                badge.style.color = "#d93025";
                badge.style.borderColor = "rgba(217, 48, 37, 0.15)";
            }
        }
    },

    _showToast(msg) {
        const toast = this.container.querySelector('#settings-toast');
        const span = this.container.querySelector('#settings-toast-msg');
        if (toast && span) {
            span.innerText = msg;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    }
};

// =========================================================================
// 8. ROUTER & GLOBAL COORDINATOR SHELL
// =========================================================================
class AppShell {
    constructor() {
        this.currentView = null;
        this.views = {
            dashboard: Dashboard,
            journal: Journal,
            blueprint: Blueprint,
            analytics: Analytics,
            settings: Settings
        };
    }

    async init() {
        window.globalAppInstance = this;
        this.applyTheme();
        this.bindGlobalListeners();
        this.renderGlobalUI();
        this.route();

        // Background auto-pull from Google Sheets on start to prevent overwriting Claude's changes
        const settings = db.getSettings();
        if (settings.sheetsUrl && settings.autoSync) {
            try {
                console.log("[AtomicFlow Sync] Running background cloud pull to sync with Claude...");
                const ok = await db.pullFromGoogleSheets();
                if (ok) {
                    console.log("[AtomicFlow Sync] Background pull successful! Re-rendering with fresh cloud data...");
                    this.renderGlobalUI();
                    this.route();
                }
            } catch (e) {
                console.error("[AtomicFlow Sync] Background startup pull failed:", e);
            }
        }
    }

    applyTheme() {
        const settings = db.getSettings();
        document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
    }

    bindGlobalListeners() {
        window.addEventListener('hashchange', () => this.route());

        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const view = link.getAttribute('data-view');
                window.location.hash = `#${view}`;
            });
        });
    }

    renderGlobalUI() {
        const settings = db.getSettings();
        
        const welcomeTitle = document.querySelector('.welcome-msg h1');
        if (welcomeTitle) {
            const hr = new Date().getHours();
            let greeting = 'Good morning';
            if (hr >= 12 && hr < 17) greeting = 'Good afternoon';
            else if (hr >= 17) greeting = 'Good evening';
            welcomeTitle.innerHTML = `${greeting}, <span class="text-gradient">${settings.userName || 'Achiever'}</span>!`;
        }

        const dateIndicator = document.querySelector('.date-indicator span');
        if (dateIndicator) {
            const today = new Date();
            dateIndicator.innerText = today.toLocaleDateString(undefined, { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
        }
        this.updateSidebarStats();
    }

    updateSidebarStats() {
        const habits = db.getHabits();
        const todayStr = new Date().toISOString().split('T')[0];
        const log = db.getLogForDate(todayStr);
        
        const done = Object.keys(log.completions || {}).filter(hId => {
            return habits.some(h => h.id === hId) && log.completions[hId].completed;
        }).length;
        
        const pct = habits.length > 0 ? Math.round((done / habits.length) * 100) : 0;
        
        const progressRing = document.querySelector('.progress-ring-circle');
        const textElement = document.querySelector('.progress-percentage');
        const sidebarSubtitle = document.querySelector('.progress-info p');
        
        if (progressRing && textElement) {
            const circumference = 113; // Circumference of radius 18 ring
            const offset = circumference - (circumference * pct) / 100;
            progressRing.style.strokeDashoffset = offset;
            textElement.innerText = `${pct}%`;
        }

        if (sidebarSubtitle) {
            sidebarSubtitle.innerText = `${done} of ${habits.length} routines met today`;
        }

        this.updateSidebarXpWidget();
    }

    updateSidebarXpWidget() {
        const xpPoints = db.settings.xp || 0;
        const xpCalc = AtomicManager.getXpCalculations(xpPoints);
        
        const levelBadge = document.getElementById('sidebar-level-badge');
        const xpBarInner = document.getElementById('sidebar-xp-bar');
        const xpText = document.getElementById('sidebar-xp-text');
        const titleText = document.getElementById('sidebar-title-text');
        
        if (levelBadge) levelBadge.innerText = `Lvl ${xpCalc.level}`;
        if (xpBarInner) xpBarInner.style.width = `${xpCalc.percentage}%`;
        if (xpText) xpText.innerText = `${xpCalc.currentXp} / ${xpCalc.nextXp} XP`;
        if (titleText) titleText.innerText = xpCalc.title;
    }

    route() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        const activeView = this.views[hash];

        if (!activeView) {
            window.location.hash = '#dashboard';
            return;
        }

        // Silent auto-save if switching away from the journal reflection page
        if (this.currentView === Journal) {
            Journal.autoSaveCurrent();
        }

        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            const viewName = link.getAttribute('data-view');
            if (viewName === hash) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        const contentContainer = document.getElementById('view-content-root');
        
        this.currentView = activeView;
        this.currentView.render(contentContainer);
        this.updateSidebarStats();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new AppShell();
    app.init();
});

// Register Service Worker for PWA (Offline Native Install Support)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered successfully!', reg.scope))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}
