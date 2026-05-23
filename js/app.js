/**
 * AtomicFlow Unified Application Logic
 * Consolidated into a single, standard JavaScript file to completely bypass 
 * browser CORS restrictions when running locally via the file:// protocol.
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
                { id: '1', title: 'A highly creative builder', proof: 'Write code or design something new' },
                { id: '2', title: 'An active, energetic athlete', proof: 'Do daily core training session' }
            ],
            stacks: []
        };
        this.settings = this._load('settings') || {
            theme: 'dark',
            sheetsUrl: 'https://script.google.com/macros/s/AKfycbzeYEMh3UeFalIBwo8Un9962yTOgOoTzuu9OedXUopaB346KNf8-XoZ1tmv6Xg5QiTb/exec',
            userName: 'Achiever',
            autoSync: true
        };

        // Proactively patch settings if they ran the app before but have no sheetsUrl set
        if (!this.settings.sheetsUrl) {
            this.settings.sheetsUrl = 'https://script.google.com/macros/s/AKfycbzeYEMh3UeFalIBwo8Un9962yTOgOoTzuu9OedXUopaB346KNf8-XoZ1tmv6Xg5QiTb/exec';
            this.settings.autoSync = true;
            this._save('settings', this.settings);
        }

        // Seed sample data if brand new user
        if (this.habits.length === 0 && Object.keys(this.logs).length === 0) {
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

    getLogForDate(dateStr) {
        if (!this.logs[dateStr]) {
            return {
                date: dateStr,
                completions: {},
                mood: 0,
                energy: 0,
                journalNotes: '',
                wins: [],
                improvement: ''
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
        if (log.completions[habitId] && log.completions[habitId].completed) {
            delete log.completions[habitId];
        } else {
            log.completions[habitId] = {
                completed: true,
                isTwoMinute: isTwoMinute,
                completedAt: Date.now()
            };
        }
        this.saveLogForDate(dateStr, log);
        return log;
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
        const sampleHabits = [
            {
                id: 'h_workout',
                name: 'Core Fitness Workout',
                category: 'health',
                identity: 'An active, energetic athlete',
                cue: 'Lay training clothes & shoes by the bed before sleeping.',
                reward: 'A refreshing shower and a high-protein breakfast smoothie.',
                twoMinuteVersion: 'Do 10 air squats & 5 pushups.',
                stackTrigger: 'After I finish my morning glass of water',
                active: true,
                createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
                updatedAt: Date.now()
            },
            {
                id: 'h_meditate',
                name: 'Mindfulness Breathing',
                category: 'mind',
                identity: 'A calm, centered, and peaceful person',
                cue: 'Place Yoga cushion in the center of the living room.',
                reward: 'Pour and enjoy a warm cup of herbal green tea.',
                twoMinuteVersion: 'Sit comfortably and close eyes for 3 deep breaths.',
                stackTrigger: 'After I sit on the couch in the morning',
                active: true,
                createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
                updatedAt: Date.now()
            },
            {
                id: 'h_read',
                name: 'Professional Skill Reading',
                category: 'career',
                identity: 'A highly creative builder',
                cue: 'Leave my textbook open on my workdesk before leaving for work.',
                reward: 'Log 1 new golden nugget of knowledge in my journal.',
                twoMinuteVersion: 'Read exactly 1 page.',
                stackTrigger: 'After I boot up my work computer',
                active: true,
                createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
                updatedAt: Date.now()
            }
        ];

        this.habits = sampleHabits;
        this._save('habits', this.habits);

        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            const completions = {};
            if (Math.random() > 0.3) {
                completions['h_workout'] = { completed: true, isTwoMinute: Math.random() > 0.7, completedAt: Date.now() };
            }
            if (Math.random() > 0.2) {
                completions['h_meditate'] = { completed: true, isTwoMinute: Math.random() > 0.8, completedAt: Date.now() };
            }
            if (Math.random() > 0.4) {
                completions['h_read'] = { completed: true, isTwoMinute: Math.random() > 0.6, completedAt: Date.now() };
            }

            this.logs[dateStr] = {
                date: dateStr,
                completions,
                mood: Math.floor(Math.random() * 3) + 3,
                energy: Math.floor(Math.random() * 3) + 3,
                journalNotes: `Reflecting on my habits. Focus on 1% better every day. Staying consistent is key!`,
                wins: ['Met environment cues', 'Maintained visual streaks'],
                improvement: 'Hydrate immediately after waking up',
                updatedAt: Date.now()
            };
        }
        this._save('logs', this.logs);
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

        // Current streak backwards from today
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
        
        if (habits.length === 0 || dates.length === 0) {
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
    }
};

// =========================================================================
// 3. DASHBOARD VIEW COMPONENT
// =========================================================================
const Dashboard = {
    selectedDate: new Date().toISOString().split('T')[0],
    activeFilter: 'all',

    render(container) {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.activeFilter = 'all';
        this.container = container;
        this.updateView();
    },

    updateView() {
        const habits = db.getHabits();
        const log = db.getLogForDate(this.selectedDate);
        const activeHabits = this.activeFilter === 'all' 
            ? habits 
            : habits.filter(h => h.category === this.activeFilter);

        const warnings = AtomicManager.getNeverMissTwiceWarnings();
        const stats = this._getDayStats(log, habits);

        let warningBannerHtml = '';
        if (warnings.length > 0 && this.selectedDate === new Date().toISOString().split('T')[0]) {
            warningBannerHtml = `
                <div class="warning-banner animate-pulse">
                    <i data-lucide="alert-triangle"></i>
                    <span><strong>Never Miss Twice Warning:</strong> You missed <strong>${warnings.map(h => h.name).join(', ')}</strong> yesterday. Log them today to keep streaks alive!</span>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                ${warningBannerHtml}
                
                <div class="view-grid">
                    <!-- Left: Habits checklist -->
                    <div style="grid-column: span 8; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                                <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 2px;">
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'all' ? 'active-filter' : ''}" data-filter="all" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 20px;">All</button>
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'health' ? 'active-filter' : ''}" data-filter="health" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 20px;">Health</button>
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'mind' ? 'active-filter' : ''}" data-filter="mind" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 20px;">Mind</button>
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'career' ? 'active-filter' : ''}" data-filter="career" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 20px;">Career</button>
                                    <button class="btn btn-secondary filter-tab ${this.activeFilter === 'relations' ? 'active-filter' : ''}" data-filter="relations" style="padding: 0.4rem 1rem; font-size: 0.85rem; border-radius: 20px;">Relations</button>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <button class="btn btn-secondary" id="btn-prev-day" style="padding: 0.4rem 0.6rem;"><i data-lucide="chevron-left"></i></button>
                                    <input type="date" id="dashboard-date-picker" class="form-control" value="${this.selectedDate}" style="padding: 0.35rem 0.75rem; font-size: 0.9rem; width: 140px;">
                                    <button class="btn btn-secondary" id="btn-next-day" style="padding: 0.4rem 0.6rem;"><i data-lucide="chevron-right"></i></button>
                                </div>
                            </div>
                        </div>

                        <div class="glass-card" style="padding: 1.5rem 1.75rem;">
                            <div class="card-header-flex">
                                <div>
                                    <h3 class="card-title"><i data-lucide="check-square" style="color: var(--primary);"></i> Daily Habit Stack</h3>
                                    <p class="card-subtitle">Mark off actions to solidify your core identity statements.</p>
                                </div>
                                <button class="btn btn-primary" id="btn-add-habit" style="padding: 0.5rem 1rem; font-size: 0.85rem;">
                                    <i data-lucide="plus"></i> New Habit
                                </button>
                            </div>

                            <div id="habits-list-container" style="margin-top: 1.5rem;">
                                ${this._renderHabitsList(activeHabits, log)}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Progress wheel -->
                    <div style="grid-column: span 4; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card text-center" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem;">
                            <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1.5rem;">Today's Flow Completion</h4>
                            
                            <div class="progress-ring-container" style="width: 140px; height: 140px; margin-bottom: 1.5rem;">
                                <svg width="140" height="140">
                                    <circle stroke="var(--border-color)" stroke-width="10" fill="transparent" r="56" cx="70" cy="70"/>
                                    <circle class="progress-ring-circle" stroke="url(#progress-grad)" stroke-width="12" stroke-linecap="round" fill="transparent" r="56" cx="70" cy="70" 
                                        stroke-dasharray="351.8" stroke-dashoffset="${351.8 - (351.8 * stats.pct) / 100}"/>
                                    <defs>
                                        <linearGradient id="progress-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stop-color="#6366f1" />
                                            <stop offset="100%" stop-color="#a855f7" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div class="progress-percentage" style="font-size: 1.6rem; font-weight: 800; color: var(--text-primary);">${stats.pct}%</div>
                            </div>

                            <div style="display: flex; gap: 1.5rem; width: 100%; border-top: 1px solid var(--border-color); padding-top: 1.25rem;">
                                <div style="flex: 1; text-align: center;">
                                    <div style="font-size: 1.35rem; font-weight: 700; color: var(--color-success);">${stats.done}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Completed</div>
                                </div>
                                <div style="flex: 1; text-align: center; border-left: 1px solid var(--border-color);">
                                    <div style="font-size: 1.35rem; font-weight: 700; color: var(--text-muted);">${stats.pending}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">Remaining</div>
                                </div>
                            </div>
                        </div>

                        <div class="glass-card" style="background: var(--grad-glow); border-color: rgba(99, 102, 241, 0.1); padding: 1.5rem;">
                            <h4 style="font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; color: var(--primary);">
                                <i data-lucide="book-open"></i> Atomic Law of the Day
                            </h4>
                            <p id="atomic-quote-box" style="font-size: 0.88rem; font-style: italic; color: var(--text-primary); line-height: 1.5; margin-top: 0.75rem;">
                                "You do not rise to the level of your goals. You fall to the level of your systems."
                            </p>
                            <span style="display: block; font-size: 0.75rem; font-weight: 600; text-align: right; color: var(--text-secondary); margin-top: 0.5rem;">— James Clear, *Atomic Habits*</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- New Habit Form Modal Container -->
            <div id="habit-modal" class="modal-overlay">
                <div class="modal-box">
                    <button class="modal-close" id="modal-close-btn">&times;</button>
                    <h3 style="margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="sparkles" style="color: var(--primary);"></i> Forge a New Habit
                    </h3>
                    <form id="new-habit-form" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div class="form-group">
                            <label>Habit Name <span style="color: var(--color-danger);">*</span></label>
                            <input type="text" id="form-habit-name" class="form-control" placeholder="e.g. Strength Training, Morning Meditation" required>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group">
                                <label>Category</label>
                                <select id="form-habit-category" class="form-control">
                                    <option value="health">Health</option>
                                    <option value="mind">Mind</option>
                                    <option value="career">Career</option>
                                    <option value="relations">Relations</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Target Identity Statement</label>
                                <input type="text" id="form-habit-identity" class="form-control" placeholder="e.g. I am an active athlete">
                            </div>
                        </div>

                        <div style="border-top: 1px dashed var(--border-color); padding-top: 1rem; margin-top: 0.25rem;">
                            <h5 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem;">Atomic Laws Builder (Optional)</h5>
                            
                            <div class="form-group">
                                <label>1. Habit Stack (Make it Obvious)</label>
                                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                                    <span style="font-size: 0.85rem; color: var(--text-secondary);">After I</span>
                                    <input type="text" id="form-habit-trigger" class="form-control" style="flex: 1; min-width: 120px; padding: 0.4rem 0.75rem; font-size: 0.85rem;" placeholder="pour my morning coffee">
                                    <span style="font-size: 0.85rem; color: var(--text-secondary);">, I will...</span>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>2. Cue Environment Design (Make it Obvious)</label>
                                <input type="text" id="form-habit-cue" class="form-control" placeholder="e.g. Lay my training shoes next to the bed">
                            </div>

                            <div class="form-group">
                                <label>3. 2-Minute Rule Alternative (Make it Easy)</label>
                                <input type="text" id="form-habit-twomin" class="form-control" placeholder="e.g. Do 10 bodyweight squats">
                            </div>

                            <div class="form-group">
                                <label>4. Instant Reward (Make it Satisfying)</label>
                                <input type="text" id="form-habit-reward" class="form-control" placeholder="e.g. Enjoy a hot shower and chocolate smoothie">
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; margin-top: 1rem; justify-content: flex-end;">
                            <button type="button" class="btn btn-secondary" id="form-cancel-btn">Cancel</button>
                            <button type="submit" class="btn btn-primary">Create Habit</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
        this._loadRandomQuote();
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

    _renderHabitsList(activeHabits, log) {
        if (activeHabits.length === 0) {
            return `
                <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                    <i data-lucide="inbox" style="width: 48px; height: 48px; stroke-width: 1.5; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p style="font-weight: 600;">No habits in this category.</p>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Click "New Habit" above to forge your first one!</p>
                </div>
            `;
        }

        return activeHabits.map((habit, index) => {
            const completion = log.completions && log.completions[habit.id];
            const isCompleted = !!(completion && completion.completed);
            const isTwoMinuteSelected = !!(completion && completion.isTwoMinute);
            const streak = AtomicManager.calculateStreak(habit.id);
            const isHot = streak.current >= 5;
            
            return `
                <div class="habit-card ${isCompleted ? 'completed' : ''} animate-fade-in stagger-${(index % 6) + 1}" data-id="${habit.id}">
                    <label class="checkbox-wrapper">
                        <input type="checkbox" class="habit-check" ${isCompleted ? 'checked' : ''}>
                        <span class="checkmark"><i data-lucide="check"></i></span>
                    </label>

                    <div class="habit-details">
                        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                            <span class="habit-name">${habit.name}</span>
                            <span class="habit-category cat-${habit.category}">${habit.category}</span>
                            ${habit.identity ? `
                                <span class="habit-identity-badge">
                                    <i data-lucide="user"></i> ${habit.identity}
                                </span>
                            ` : ''}
                        </div>
                        <p class="habit-desc" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; font-weight: 500;">
                            ${isTwoMinuteSelected 
                                ? `<strong style="color: var(--primary);">2-Min Version:</strong> ${habit.twoMinuteVersion || 'Quick start.'}`
                                : (habit.stackTrigger ? `After I <strong>${habit.stackTrigger}</strong>, I will complete this habit.` : 'Consistent action is the key.')
                            }
                        </p>
                    </div>

                    <div style="display: flex; align-items: center; gap: 1rem; flex-shrink: 0;">
                        ${habit.twoMinuteVersion ? `
                            <div class="two-minute-toggle" title="Low energy? Toggle the 2-Minute rule to secure a micro-victory!">
                                <span>2-Min Rule</span>
                                <label class="switch-control">
                                    <input type="checkbox" class="twomin-switch" ${isTwoMinuteSelected ? 'checked' : ''} ${isCompleted ? 'disabled' : ''}>
                                    <span class="slider"></span>
                                </label>
                            </div>
                        ` : ''}

                        <div class="streak-badge ${isHot ? 'hot' : ''}">
                            <i data-lucide="flame"></i>
                            <span>${streak.current}</span>
                        </div>
                        
                        <button class="btn btn-secondary btn-drawer-toggle" style="padding: 4px 8px; border: none; background: transparent;">
                            <i data-lucide="chevron-down" style="width: 18px; height: 18px;"></i>
                        </button>
                    </div>

                    <div class="habit-drawer hidden">
                        <div style="grid-column: span 1;">
                            <div class="drawer-section-title">1st Law: Make it Obvious</div>
                            <div class="drawer-bubble" style="margin-bottom: 0.75rem;">
                                <strong>Cue Environment:</strong> ${habit.cue || 'Not set.'}
                            </div>
                            <div class="drawer-bubble">
                                <strong>Habit Stacking:</strong> After I <em>${habit.stackTrigger || '[X]'}</em>, I will <em>${habit.name}</em>.
                            </div>
                        </div>
                        <div style="grid-column: span 1;">
                            <div class="drawer-section-title">4th Law: Make it Satisfying</div>
                            <div class="drawer-bubble" style="margin-bottom: 0.75rem;">
                                <strong>Instant Reward:</strong> ${habit.reward || 'Not set.'}
                            </div>
                            <div class="drawer-bubble" style="border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.02);">
                                <strong>Identity Core:</strong> Proving I am <em>"${habit.identity || 'better today'}"</em>.
                            </div>
                        </div>
                        
                        <div style="grid-column: span 2; display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem;">
                            <button class="btn btn-secondary btn-delete-habit" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-color: rgba(239,68,68,0.2); color: #ef4444;"><i data-lucide="trash-2"></i> Delete Habit</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    _setupListeners() {
        // Filter tabs
        const tabs = this.container.querySelectorAll('.filter-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active-filter'));
                tab.classList.add('active-filter');
                this.activeFilter = tab.getAttribute('data-filter');
                this.updateView();
            });
        });

        // Date picker
        const picker = this.container.querySelector('#dashboard-date-picker');
        picker.addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            this.updateView();
        });

        // Prev/Next Day buttons
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

        // Toggle Expandable Drawers
        const cards = this.container.querySelectorAll('.habit-card');
        cards.forEach(card => {
            const toggle = card.querySelector('.btn-drawer-toggle');
            const details = card.querySelector('.habit-details');
            const drawer = card.querySelector('.habit-drawer');
            
            const handleToggle = (e) => {
                if (e.target.closest('.checkbox-wrapper') || e.target.closest('.two-minute-toggle') || e.target.closest('.btn-delete-habit')) return;
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

        // Delete habit button
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

        // 2-Minute toggle descriptions
        cards.forEach(card => {
            const tmSwitch = card.querySelector('.twomin-switch');
            if (tmSwitch) {
                tmSwitch.addEventListener('change', (e) => {
                    const habitId = card.getAttribute('data-id');
                    const habit = db.getHabits().find(h => h.id === habitId);
                    const desc = card.querySelector('.habit-desc');
                    if (e.target.checked) {
                        desc.innerHTML = `<strong style="color: var(--primary);">2-Min Version:</strong> ${habit.twoMinuteVersion}`;
                    } else {
                        desc.innerHTML = habit.stackTrigger ? `After I <strong>${habit.stackTrigger}</strong>, I will complete this habit.` : 'Consistent action is the key.';
                    }
                });
            }
        });

        // Toggle completions
        cards.forEach(card => {
            const check = card.querySelector('.habit-check');
            check.addEventListener('change', (e) => {
                const habitId = card.getAttribute('data-id');
                const tmSwitch = card.querySelector('.twomin-switch');
                const isTwoMinute = tmSwitch ? tmSwitch.checked : false;

                if (e.target.checked) {
                    card.classList.add('completed');
                    card.classList.add('animate-pop');
                    this._playConfetti();
                } else {
                    card.classList.remove('completed');
                }

                db.toggleHabitCompletion(this.selectedDate, habitId, isTwoMinute);
                
                setTimeout(() => {
                    this.updateView();
                    this._updateSidebarProgress();
                }, 300);
            });
        });

        // Modal triggers
        const modal = this.container.querySelector('#habit-modal');
        this.container.querySelector('#btn-add-habit').addEventListener('click', () => {
            modal.classList.add('active');
        });

        this.container.querySelector('#modal-close-btn').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        this.container.querySelector('#form-cancel-btn').addEventListener('click', () => {
            modal.classList.remove('active');
        });

        // Form Submit
        const form = this.container.querySelector('#new-habit-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const newHabit = {
                name: this.container.querySelector('#form-habit-name').value,
                category: this.container.querySelector('#form-habit-category').value,
                identity: this.container.querySelector('#form-habit-identity').value,
                stackTrigger: this.container.querySelector('#form-habit-trigger').value,
                cue: this.container.querySelector('#form-habit-cue').value,
                twoMinuteVersion: this.container.querySelector('#form-habit-twomin').value,
                reward: this.container.querySelector('#form-habit-reward').value
            };

            db.saveHabit(newHabit);
            modal.classList.remove('active');
            form.reset();
            this.updateView();
            this._updateSidebarProgress();
        });
    },

    _updateSidebarProgress() {
        const todayStr = new Date().toISOString().split('T')[0];
        const habits = db.getHabits();
        const log = db.getLogForDate(todayStr);
        const stats = this._getDayStats(log, habits);
        
        const circle = document.querySelector('.progress-ring-circle');
        const text = document.querySelector('.progress-percentage');
        
        if (circle && text) {
            const offset = 351.8 - (351.8 * stats.pct) / 100;
            circle.style.strokeDashoffset = offset;
            text.innerText = `${stats.pct}%`;
        }
        
        const sidebarSubtitle = document.querySelector('.progress-info p');
        if (sidebarSubtitle) {
            sidebarSubtitle.innerText = `${stats.done} of ${habits.length} habits met today`;
        }
    },

    _playConfetti() {
        if (window.confetti) {
            window.confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.75, x: 0.5 },
                colors: ['#6366f1', '#a855f7', '#10b981', '#f59e0b']
            });
        }
    },

    _loadRandomQuote() {
        const quotes = [
            "\"Every action you take is a vote for the type of person you wish to become.\"",
            "\"You do not rise to the level of your goals. You fall to the level of your systems.\"",
            "\"Success is the product of daily habits—not once-in-a-lifetime transformations.\"",
            "\"If you want to master a habit, the key is to start with repetition, not perfection.\"",
            "\"The primary reason other habits are hard is that they conflict with your self-image. Change your identity first.\"",
            "\"Be the designer of your world and not merely the consumer of it. Make your cues obvious.\""
        ];
        const randomIdx = Math.floor(Math.random() * quotes.length);
        const quoteBox = this.container.querySelector('#atomic-quote-box');
        if (quoteBox) {
            quoteBox.innerHTML = quotes[randomIdx];
        }
    }
};

// =========================================================================
// 4. JOURNAL VIEW COMPONENT
// =========================================================================
const Journal = {
    selectedDate: new Date().toISOString().split('T')[0],
    activeMood: 0,
    wins: [],

    render(container) {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.container = container;
        this.loadDateLog();
    },

    loadDateLog() {
        const log = db.getLogForDate(this.selectedDate);
        this.activeMood = log.mood || 0;
        this.wins = log.wins || [];
        this.updateView(log);
    },

    updateView(log) {
        const energyLevels = ["Exhausted", "Tired", "Balanced", "Energetic", "Supercharged!"];
        const currentEnergyVal = log.energy || 3;

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                <div class="view-grid">
                    <!-- Left: Mood & Energy Tracker -->
                    <div style="grid-column: span 5; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.25rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <label style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">Log Entry Date</label>
                                <input type="date" id="journal-date-picker" class="form-control" value="${this.selectedDate}" style="width: 160px;">
                            </div>
                        </div>

                        <div class="glass-card">
                            <h3 class="card-title" style="margin-bottom: 1.25rem;">
                                <i data-lucide="smile" style="color: var(--primary);"></i> Daily Mood Rating
                            </h3>
                            <div class="mood-picker">
                                <div class="mood-option ${this.activeMood === 1 ? 'active' : ''}" data-mood="1">
                                    <span>😢</span>
                                    <span class="mood-label">Sad</span>
                                </div>
                                <div class="mood-option ${this.activeMood === 2 ? 'active' : ''}" data-mood="2">
                                    <span>😕</span>
                                    <span class="mood-label">Low</span>
                                </div>
                                <div class="mood-option ${this.activeMood === 3 ? 'active' : ''}" data-mood="3">
                                    <span>😐</span>
                                    <span class="mood-label">Okay</span>
                                </div>
                                <div class="mood-option ${this.activeMood === 4 ? 'active' : ''}" data-mood="4">
                                    <span>🙂</span>
                                    <span class="mood-label">Good</span>
                                </div>
                                <div class="mood-option ${this.activeMood === 5 ? 'active' : ''}" data-mood="5">
                                    <span>😄</span>
                                    <span class="mood-label">Great</span>
                                </div>
                            </div>
                        </div>

                        <div class="glass-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                                <h3 class="card-title"><i data-lucide="zap" style="color: var(--color-warning);"></i> Energy Level</h3>
                                <span id="energy-badge" class="badge" style="background: var(--grad-glow); color: var(--primary); padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; border: 1px solid rgba(99, 102, 241, 0.15);">
                                    ${energyLevels[currentEnergyVal - 1]}
                                </span>
                            </div>
                            <div style="padding: 0.5rem 0;">
                                <input type="range" id="energy-range-input" class="custom-range" min="1" max="5" value="${currentEnergyVal}">
                                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 10px; font-weight: 600;">
                                    <span>1 (Exhausted)</span>
                                    <span>3 (Balanced)</span>
                                    <span>5 (Peak)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Reflections and micro-wins -->
                    <div style="grid-column: span 7; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.75rem 2rem;">
                            <div class="card-header-flex" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                                <div>
                                    <h3 class="card-title"><i data-lucide="book-open" style="color: var(--primary);"></i> Daily Reflection Sheet</h3>
                                    <p class="card-subtitle">Keep an atomic record of wins, triggers, and thoughts.</p>
                                </div>
                                <button class="btn btn-primary" id="btn-save-journal" style="padding: 0.5rem 1.25rem;">
                                    <i data-lucide="save"></i> Save Log
                                </button>
                            </div>

                            <div class="form-group" style="margin-bottom: 1.5rem;">
                                <label style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>Daily Micro-Wins (1% Better Every Day)</span>
                                    <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Type win and press Enter</span>
                                </label>
                                <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                                    <input type="text" id="win-input" class="form-control" placeholder="e.g. Completed morning workout, Read 1 page" style="flex: 1;">
                                    <button class="btn btn-secondary" id="btn-add-win" style="padding: 0.75rem 1rem;"><i data-lucide="plus"></i> Add</button>
                                </div>
                                <ul id="wins-list" style="list-style: none; display: flex; flex-direction: column; gap: 6px;">
                                    ${this._renderWinsList()}
                                </ul>
                            </div>

                            <div class="form-group" style="margin-bottom: 1.5rem;">
                                <label>Tomorrow's Friction Reduction (How will you improve systems?)</label>
                                <input type="text" id="improvement-input" class="form-control" value="${log.improvement || ''}" placeholder="e.g. Lay clothes on floor before bed to exercise instantly">
                            </div>

                            <div class="form-group">
                                <label>Freeform Journal Notes (Log Book)</label>
                                <textarea id="reflections-textarea" class="form-control" placeholder="Write any thoughts, struggles, or positive affirmations...">${log.journalNotes || ''}</textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Toast Success Popup -->
            <div id="save-toast" class="glass-card animate-slide-up" style="position: fixed; bottom: 2rem; right: 2rem; background: var(--grad-success); color: #ffffff; padding: 0.75rem 1.5rem; border-radius: var(--radius-md); box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3); z-index: 10000; border: none; display: none;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                    <i data-lucide="check-circle" style="width: 20px; height: 20px;"></i>
                    <span>Reflection Log Saved Successfully!</span>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
    },

    _renderWinsList() {
        if (this.wins.length === 0) {
            return `
                <li id="no-wins-msg" style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; padding: 6px 12px; border: 1px dashed var(--border-color); border-radius: var(--radius-sm);">
                    No wins logged yet. Add one above!
                </li>
            `;
        }
        return this.wins.map((win, idx) => `
            <li class="animate-fade-in" style="background: var(--bg-primary); border: 1px solid var(--border-color); padding: 0.5rem 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 500;">
                    <i data-lucide="star" style="width: 14px; height: 14px; fill: var(--color-warning); stroke: var(--color-warning);"></i>
                    <span>${win}</span>
                </div>
                <button class="btn-delete-win" data-index="${idx}" style="background: transparent; border: none; cursor: pointer; color: var(--text-muted);"><i data-lucide="x" style="width: 16px; height: 16px;"></i></button>
            </li>
        `).join('');
    },

    _setupListeners() {
        const picker = this.container.querySelector('#journal-date-picker');
        picker.addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            this.loadDateLog();
        });

        const moodOptions = this.container.querySelectorAll('.mood-option');
        moodOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                moodOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.activeMood = parseInt(opt.getAttribute('data-mood'));
            });
        });

        const energyInput = this.container.querySelector('#energy-range-input');
        const energyBadge = this.container.querySelector('#energy-badge');
        const energyLevels = ["Exhausted", "Tired", "Balanced", "Energetic", "Supercharged!"];
        
        energyInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            energyBadge.innerText = energyLevels[val - 1];
        });

        const winInput = this.container.querySelector('#win-input');
        const addWinBtn = this.container.querySelector('#btn-add-win');

        const addWin = () => {
            const val = winInput.value.trim();
            if (val) {
                this.wins.push(val);
                winInput.value = '';
                this.container.querySelector('#wins-list').innerHTML = this._renderWinsList();
                lucide.createIcons();
                this._setupWinDeleteListeners();
            }
        };

        addWinBtn.addEventListener('click', addWin);
        winInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addWin();
            }
        });

        this._setupWinDeleteListeners();

        this.container.querySelector('#btn-save-journal').addEventListener('click', () => {
            const logData = {
                mood: this.activeMood,
                energy: parseInt(energyInput.value),
                wins: this.wins,
                improvement: this.container.querySelector('#improvement-input').value,
                journalNotes: this.container.querySelector('#reflections-textarea').value
            };

            db.saveLogForDate(this.selectedDate, logData);
            this._showToast();
        });
    },

    _setupWinDeleteListeners() {
        const deleteButtons = this.container.querySelectorAll('.btn-delete-win');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                this.wins.splice(idx, 1);
                this.container.querySelector('#wins-list').innerHTML = this._renderWinsList();
                lucide.createIcons();
                this._setupWinDeleteListeners();
            });
        });
    },

    _showToast() {
        const toast = this.container.querySelector('#save-toast');
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
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
                <div class="glass-card" style="margin-bottom: 2rem; background: var(--grad-glow); border-color: rgba(99, 102, 241, 0.1);">
                    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="award"></i> The Atomic Blueprint Worksheet
                    </h3>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; margin-top: 0.5rem;">
                        Real, lasting change doesn't come from focusing on goals. It comes from adopting your ultimate *Identity*. Use these worksheets to build a robust system of stacks and proofs.
                    </p>
                </div>

                <div class="view-grid">
                    <!-- Left: Identity pillars -->
                    <div style="grid-column: span 6; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.75rem;">
                            <h3 class="card-title" style="margin-bottom: 0.5rem;">
                                <i data-lucide="fingerprint" style="color: var(--primary);"></i> 1. Core Identity Pillars
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1.5rem;">Define your ultimate self and build daily proof systems.</p>

                            <form id="identity-form" style="display: flex; flex-direction: column; gap: 1rem; background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                                <div class="form-group">
                                    <label>I want to become the type of person who is a...</label>
                                    <input type="text" id="identity-title-input" class="form-control" placeholder="e.g. Prolific writer, healthy athlete" required>
                                </div>
                                <div class="form-group">
                                    <label>Daily action that proves this identity:</label>
                                    <input type="text" id="identity-action-input" class="form-control" placeholder="e.g. Writing 100 words, exercising for 10 min" required>
                                </div>
                                <button type="submit" class="btn btn-primary" style="align-self: flex-end; padding: 0.5rem 1.25rem; font-size: 0.85rem;"><i data-lucide="plus"></i> Add Pillar</button>
                            </form>

                            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-secondary);">Your Identity Pillars</h4>
                            <div id="identities-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${this._renderIdentitiesList(blueprints.identities)}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Habit stacking -->
                    <div style="grid-column: span 6; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.75rem;">
                            <h3 class="card-title" style="margin-bottom: 0.5rem;">
                                <i data-lucide="layers" style="color: var(--color-warning);"></i> 2. Habit Stacking Architect
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1.5rem;">Link a new habit to an existing, fully established trigger cue.</p>

                            <form id="stack-form" style="display: flex; flex-direction: column; gap: 1rem; background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-size: 0.9rem; font-weight: 600;">After I</span>
                                    <input type="text" id="stack-trigger" class="form-control" style="flex: 1; min-width: 120px; padding: 0.4rem 0.75rem; font-size: 0.85rem;" placeholder="pour my morning coffee" required>
                                    <span style="font-size: 0.9rem; font-weight: 600;">, I will...</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <input type="text" id="stack-new-habit" class="form-control" style="flex: 1; min-width: 120px; padding: 0.4rem 0.75rem; font-size: 0.85rem;" placeholder="meditate for 5 minutes" required>
                                    <span style="font-size: 0.9rem; font-weight: 600;">in/at</span>
                                    <input type="text" id="stack-location" class="form-control" style="flex: 0.6; min-width: 90px; padding: 0.4rem 0.75rem; font-size: 0.85rem;" placeholder="living room chair" required>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                    <label class="checkbox-wrapper" style="width: auto; height: auto; display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">
                                        <input type="checkbox" id="stack-auto-add-dashboard" checked>
                                        <span class="checkmark" style="width: 20px; height: 20px; border-radius: 4px;"><i data-lucide="check" style="width: 12px; height: 12px;"></i></span>
                                        <span>Add as active habit to dashboard</span>
                                    </label>
                                    <button type="submit" class="btn btn-primary" style="padding: 0.5rem 1.25rem; font-size: 0.85rem;"><i data-lucide="plus"></i> Add Stack</button>
                                </div>
                            </form>

                            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--text-secondary);">Your Configured Stacks</h4>
                            <div id="stacks-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                ${this._renderStacksList(blueprints.stacks)}
                            </div>
                        </div>
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
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                    Define your first Identity statement above!
                </div>
            `;
        }
        return identities.map((idObj, idx) => `
            <div class="animate-fade-in" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-left: 4px solid var(--primary); padding: 1rem 1.25rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">"${idObj.title}"</span>
                    <span style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">
                        <i data-lucide="star" style="width: 12px; height: 12px; fill: var(--color-warning); stroke: var(--color-warning);"></i> 
                        Daily Proof: ${idObj.proof || 'Action not set'}
                    </span>
                </div>
                <button class="btn-delete-identity" data-index="${idx}" style="background: transparent; border: none; cursor: pointer; color: var(--text-muted);"><i data-lucide="trash-2" style="width: 18px; height: 18px;"></i></button>
            </div>
        `).join('');
    },

    _renderStacksList(stacks) {
        if (!stacks || stacks.length === 0) {
            return `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md);">
                    Construct your first Habit Stack trigger!
                </div>
            `;
        }
        return stacks.map((stack, idx) => `
            <div class="animate-fade-in" style="background: var(--bg-primary); border: 1px solid var(--border-color); border-left: 4px solid var(--color-warning); padding: 1rem 1.25rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem;">
                    <div style="line-height: 1.4;">
                        After I <strong style="color: var(--primary);">${stack.trigger}</strong>, 
                        I will <strong style="color: var(--color-success);">${stack.habit}</strong> 
                        at <strong style="color: var(--color-warning);">${stack.location}</strong>.
                    </div>
                </div>
                <button class="btn-delete-stack" data-index="${idx}" style="background: transparent; border: none; cursor: pointer; color: var(--text-muted); flex-shrink: 0;"><i data-lucide="trash-2" style="width: 18px; height: 18px;"></i></button>
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
        
        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                <div class="view-grid" style="margin-bottom: 2rem;">
                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--grad-primary); display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);">
                            <i data-lucide="percent"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Global Consistency</span>
                            <h3 style="font-size: 1.6rem; font-weight: 800; margin-top: 2px;">${stats.consistencyScore}%</h3>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--grad-success); display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                            <i data-lucide="check-circle-2"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Total Habits Met</span>
                            <h3 style="font-size: 1.6rem; font-weight: 800; margin-top: 2px;">${stats.totalCheckoffs}</h3>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--grad-warning); display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
                            <i data-lucide="flame"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Longest Streak</span>
                            <h3 style="font-size: 1.6rem; font-weight: 800; margin-top: 2px;">${stats.longestStreakGlobal} <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary);">days</span></h3>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1.25rem 1.5rem;">
                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--grad-glow); border: 1px solid rgba(99, 102, 241, 0.15); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                            <i data-lucide="clock"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">2-Min Micro Wins</span>
                            <h3 style="font-size: 1.6rem; font-weight: 800; margin-top: 2px;">${stats.twoMinRuleCount}</h3>
                        </div>
                    </div>
                </div>

                <div class="glass-card" style="margin-bottom: 2rem; padding: 1.5rem 1.75rem;">
                    <div class="card-header-flex" style="margin-bottom: 1.5rem;">
                        <div>
                            <h3 class="card-title"><i data-lucide="grid" style="color: var(--primary);"></i> 1% Better Daily Contribution Heatmap</h3>
                            <p class="card-subtitle">Visual intensity of habit repetitions achieved over the past 20 weeks.</p>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center; font-size: 0.75rem; color: var(--text-secondary);">
                            <span>Less</span>
                            <div style="width: 10px; height: 10px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #d8b4fe; border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #c084fc; border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #a855f7; border-radius: 2px;"></div>
                            <div style="width: 10px; height: 10px; background: #6366f1; border-radius: 2px;"></div>
                            <span>More</span>
                        </div>
                    </div>
                    
                    <div class="heatmap-container">
                        <div class="heatmap-grid" id="heatmap-cells-grid">
                            ${this._renderHeatmapCells()}
                        </div>
                    </div>
                </div>

                <div class="view-grid">
                    <div class="glass-card" style="grid-column: span 8;">
                        <h3 class="card-title" style="margin-bottom: 1.5rem;">
                            <i data-lucide="trending-up" style="color: var(--primary);"></i> Habits & Wellbeing Correlation
                        </h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="correlationChart"></canvas>
                        </div>
                    </div>

                    <div class="glass-card" style="grid-column: span 4;">
                        <h3 class="card-title" style="margin-bottom: 1.5rem;">
                            <i data-lucide="pie-chart" style="color: var(--color-success);"></i> Category Breakdown
                        </h3>
                        <div style="position: relative; height: 300px; width: 100%; display: flex; align-items: center; justify-content: center;">
                            <canvas id="categoryChart"></canvas>
                        </div>
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
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.05)',
                            borderWidth: 3,
                            tension: 0.35,
                            fill: true,
                            spanGaps: true
                        },
                        {
                            label: 'Subjective Mood (%)',
                            data: moodData,
                            borderColor: '#f59e0b',
                            backgroundColor: 'transparent',
                            borderWidth: 3,
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
                    labels: ['Health', 'Mind', 'Career', 'Relations'],
                    datasets: [{
                        data: [
                            completionsByCat.health,
                            completionsByCat.mind,
                            completionsByCat.career,
                            completionsByCat.relations
                        ],
                        backgroundColor: ['#10b981', '#3b82f6', '#6366f1', '#f59e0b'],
                        borderWidth: isDark ? 2 : 1,
                        borderColor: isDark ? '#0f172a' : '#ffffff'
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
  habitSheet.appendRow(["Habit ID", "Name", "Category", "Identity", "Cue", "Two-Minute Version", "Trigger Stack"]);
  if (data.habits) {
    data.habits.forEach(function(h) {
      if (h.active) {
        habitSheet.appendRow([h.id, h.name, h.category, h.identity || '', h.cue || '', h.twoMinuteVersion || '', h.stackTrigger || '']);
      }
    });
  }
  
  var logsSheet = ss.getSheetByName("VIEW_DAILY_LOGS") || ss.insertSheet("VIEW_DAILY_LOGS");
  logsSheet.clear();
  logsSheet.appendRow(["Date", "Mood", "Energy", "Wins", "Tomorrow Pivot", "Journal Notes"]);
  if (data.logs) {
    Object.keys(data.logs).sort().forEach(function(dateKey) {
      var log = data.logs[dateKey];
      logsSheet.appendRow([dateKey, log.mood || 0, log.energy || 0, (log.wins || []).join(" | "), log.improvement || '', log.journalNotes || '']);
    });
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
}`;

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                <div class="view-grid">
                    <!-- Left: Profile -->
                    <div style="grid-column: span 5; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card">
                            <h3 class="card-title" style="margin-bottom: 1.25rem;">
                                <i data-lucide="user" style="color: var(--primary);"></i> Personal Profile
                            </h3>
                            <div class="form-group">
                                <label>Your Display Name</label>
                                <div style="display: flex; gap: 0.5rem;">
                                    <input type="text" id="username-input" class="form-control" value="${settings.userName}" style="flex: 1;">
                                    <button class="btn btn-primary" id="btn-save-username" style="padding: 0.75rem 1.25rem;">Save</button>
                                </div>
                            </div>
                        </div>

                        <div class="glass-card">
                            <h3 class="card-title" style="margin-bottom: 1.25rem;">
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

                        <div class="glass-card">
                            <h3 class="card-title" style="color: var(--color-danger); margin-bottom: 0.5rem;">
                                <i data-lucide="database"></i> Local Database Storage
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1.25rem;">Directly manage your local browser files.</p>
                            
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <button class="btn btn-secondary" id="btn-export-db" style="justify-content: flex-start; width: 100%;"><i data-lucide="download"></i> Export Database (JSON)</button>
                                
                                <div style="display: flex; flex-direction: column; gap: 0.5rem; background: var(--bg-primary); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Import Database String</label>
                                    <textarea id="import-json-string" class="form-control" style="font-size: 0.75rem; font-family: monospace; min-height: 50px;" placeholder="Paste exported JSON string..."></textarea>
                                    <button class="btn btn-primary" id="btn-import-db" style="font-size: 0.75rem; padding: 0.4rem 1rem; align-self: flex-end;"><i data-lucide="upload-cloud"></i> Import JSON</button>
                                </div>

                                <button class="btn btn-danger" id="btn-reset-db" style="justify-content: flex-start; width: 100%;"><i data-lucide="refresh-cw"></i> Reset Database to Factory Seeds</button>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Cloud Sync -->
                    <div style="grid-column: span 7; display: flex; flex-direction: column; gap: 1.5rem;">
                        <div class="glass-card" style="padding: 1.75rem 2rem;">
                            <div class="card-header-flex" style="border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; margin-bottom: 1.5rem;">
                                <div>
                                    <h3 class="card-title"><i data-lucide="share-2" style="color: var(--primary);"></i> Google Sheets Cloud Sync</h3>
                                    <p class="card-subtitle">Secure personal sync where you own 100% of the spreadsheet data.</p>
                                </div>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 1.25rem; background: var(--bg-primary); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label>Google Apps Script Web App URL</label>
                                    <input type="text" id="sheets-url-input" class="form-control" value="${settings.sheetsUrl || ''}" placeholder="https://script.google.com/macros/s/.../exec">
                                </div>

                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                                    <label class="checkbox-wrapper" style="width: auto; height: auto; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">
                                        <input type="checkbox" id="auto-sync-checkbox" ${settings.autoSync ? 'checked' : ''}>
                                        <span class="checkmark" style="width: 20px; height: 20px; border-radius: 4px;"><i data-lucide="check" style="width: 12px; height: 12px;"></i></span>
                                        <span>Auto-sync logs on checklist actions</span>
                                    </label>
                                    <span id="sync-conn-badge" class="badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.15); padding: 3px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
                                        Disconnected
                                    </span>
                                </div>

                                <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;">
                                    <button class="btn btn-secondary" id="btn-test-sync" style="font-size: 0.85rem; padding: 0.5rem 1rem;"><i data-lucide="activity"></i> Test Link</button>
                                    <button class="btn btn-secondary" id="btn-pull-sync" style="font-size: 0.85rem; padding: 0.5rem 1rem;"><i data-lucide="arrow-down-to-line"></i> Pull Cloud</button>
                                    <button class="btn btn-primary" id="btn-push-sync" style="font-size: 0.85rem; padding: 0.5rem 1rem;"><i data-lucide="arrow-up-from-line"></i> Push Cloud</button>
                                </div>
                            </div>

                            <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="help-circle" style="color: var(--primary);"></i> Setup Walkthrough (5 Minutes)
                            </h4>
                            
                            <div class="setup-guide">
                                <div class="step-card">
                                    <div class="step-num">1</div>
                                    <div class="step-body">
                                        <h5>Create a Google Spreadsheet</h5>
                                        <p>Go to Google Drive, create a blank Google Spreadsheet named <strong>"My Habits Log"</strong>.</p>
                                    </div>
                                </div>
                                <div class="step-card">
                                    <div class="step-num">2</div>
                                    <div class="step-body">
                                        <h5>Open Apps Script Editor</h5>
                                        <p>In your spreadsheet menu, click <strong>Extensions</strong> &rarr; <strong>Apps Script</strong>. Clear existing code.</p>
                                    </div>
                                </div>
                                <div class="step-card" style="flex-direction: column; gap: 0.5rem;">
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
                                <div class="step-card">
                                    <div class="step-num">4</div>
                                    <div class="step-body">
                                        <h5>Deploy Web App</h5>
                                        <p>Click <strong>Deploy</strong> &rarr; <strong>New deployment</strong>. Choose type: <strong>Web app</strong>. Execute as: "Me", access: "Anyone". Click Deploy.</p>
                                    </div>
                                </div>
                                <div class="step-card">
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
            <div id="settings-toast" class="glass-card animate-slide-up" style="position: fixed; bottom: 2rem; right: 2rem; background: var(--grad-primary); color: #ffffff; padding: 0.75rem 1.5rem; border-radius: var(--radius-md); box-shadow: var(--glass-shadow); z-index: 10000; border: none; display: none;">
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
                badge.style.background = "rgba(16, 185, 129, 0.1)";
                badge.style.color = "#10b981";
                badge.style.borderColor = "rgba(16, 185, 129, 0.15)";
            } else {
                badge.innerText = "Disconnected";
                badge.style.background = "rgba(239, 68, 68, 0.1)";
                badge.style.color = "#ef4444";
                badge.style.borderColor = "rgba(239, 68, 68, 0.15)";
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

    init() {
        this.applyTheme();
        this.bindGlobalListeners();
        this.renderGlobalUI();
        this.route();
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
            const circumference = 351.8;
            const offset = circumference - (circumference * pct) / 100;
            progressRing.style.strokeDashoffset = offset;
            textElement.innerText = `${pct}%`;
        }

        if (sidebarSubtitle) {
            sidebarSubtitle.innerText = `${done} of ${habits.length} habits met today`;
        }
    }

    route() {
        const hash = window.location.hash.substring(1) || 'dashboard';
        const activeView = this.views[hash];

        if (!activeView) {
            window.location.hash = '#dashboard';
            return;
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
