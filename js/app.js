/**
 * AtomicFlow Unified Application Logic - V3 Google-Style & Office-Optimized
 * Custom re-engineered for extreme Google-style simplicity, chronological routines aligned 
 * with the user's 9:00 AM - 6:30 PM office hours, and a dedicated, high-end sleep time logger.
 */

// =========================================================================
// 1. DATABASE MANAGER LAYER
// =========================================================================
const DB_PREFIX = 'atomicflow_';

// Helper: Hash password using SHA-256 (Web Crypto API)
async function hashPassword(password) {
    if (!password) return '';
    const msgBuffer = new TextEncoder().encode(password);
    try {
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        console.warn("Crypto API failed, using fallback hash", e);
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return "fallback_" + hash.toString(16);
    }
}

// Helper: Show global toast notification dynamically
function showGlobalToast(msg, bg = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', color = '#000') {
    let toast = document.getElementById('global-app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-app-toast';
        toast.className = 'glass-card animate-slide-up';
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '2rem';
        toast.style.padding = '0.75rem 1.5rem';
        toast.style.borderRadius = 'var(--radius-sm)';
        toast.style.boxShadow = '0 10px 25px rgba(245, 158, 11, 0.3)';
        toast.style.zIndex = '100000';
        toast.style.border = 'none';
        toast.style.display = 'none';
        document.body.appendChild(toast);
    }
    
    toast.style.background = bg;
    toast.style.color = color;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 700;">
            <span style="font-size: 1.2rem;">🪙</span>
            <span>${msg}</span>
        </div>
    `;
    
    toast.style.display = 'block';
    
    if (window.globalToastTimeout) {
        clearTimeout(window.globalToastTimeout);
    }
    
    window.globalToastTimeout = setTimeout(() => {
        toast.style.display = 'none';
    }, 3500);
}

// Helper: Check if a habit is active on a specific YYYY-MM-DD date
function isHabitActiveOnDate(habit, dateStr) {
    if (!habit.frequency || habit.frequency === 'daily') return true;
    
    const parts = dateStr.split('-');
    if (parts.length !== 3) return true;
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    if (habit.frequency === 'weekdays') {
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    }
    if (habit.frequency === 'weekends') {
        return dayOfWeek === 0 || dayOfWeek === 6;
    }
    if (habit.frequency === 'weekly') {
        const targetDay = habit.weeklyDay !== undefined ? parseInt(habit.weeklyDay) : 0; // default 0 (Sunday)
        return dayOfWeek === targetDay;
    }
    return true;
}

class DatabaseManager {
    constructor() {
        this.habits = this._load('habits') || [];
        this.logs = this._load('logs') || {};
        this.blueprints = this._load('blueprints') || {
            identities: [
                { id: '1', title: 'A clean, self-respecting person', proof: 'Keep a clean hygiene routine' },
                { id: '2', title: 'An organized, mindful system designer', proof: 'Maintain arranged and tidy environment' }
            ],
            stacks: [],
            updatedAt: 0
        };
        const defaultRewards = [
            { id: 'r_show', name: 'Watch 1 hour of favorite show', cost: 10, icon: 'tv', system: true },
            { id: 'r_game', name: 'Play 1 hour of video games', cost: 12, icon: 'gamepad-2', system: true },
            { id: 'r_cheat', name: 'Enjoy a cheat meal or snack', cost: 15, icon: 'pizza', system: true },
            { id: 'r_nap', name: 'Take a 30 min power nap', cost: 5, icon: 'moon', system: true },
            { id: 'r_social', name: 'Scroll social media for 20 mins', cost: 5, icon: 'smartphone', system: true },
            { id: 'r_coffee', name: 'Buy a specialty coffee/treat', cost: 8, icon: 'coffee', system: true }
        ];
        const defaultSettings = {
            theme: 'dark', // Google dark theme default
            sheetsUrl: '',
            userName: 'Achiever',
            autoSync: false,
            useNetlifyProxy: false,
            passwordHash: '',
            lockTimeout: 0, // 0 = Never
            xp: 0
        };
        this.settings = { ...defaultSettings, ...(this._load('settings') || {}) };
        
        // Migrate legacy coins and rewards from settings to blueprints
        if (this.settings.coins !== undefined && this.blueprints.coins === undefined) {
            this.blueprints.coins = this.settings.coins;
        }
        if (this.settings.customRewards !== undefined && this.blueprints.customRewards === undefined) {
            this.blueprints.customRewards = this.settings.customRewards;
        }
        if (this.settings.redeemedRewards !== undefined && this.blueprints.redeemedRewards === undefined) {
            this.blueprints.redeemedRewards = this.settings.redeemedRewards;
        }

        // Initialize blueprints fields
        if (this.blueprints.coins === undefined) {
            this.blueprints.coins = 0;
        }
        if (!this.blueprints.customRewards) {
            this.blueprints.customRewards = defaultRewards;
        }
        if (!this.blueprints.redeemedRewards) {
            this.blueprints.redeemedRewards = [];
        }

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
        this.useProxy = !!this.settings.useNetlifyProxy;
        this._healIdentityPillars();
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
            if (!habit.timeOfDay) {
                const hour = new Date().getHours();
                if (hour >= 5 && hour < 10) habit.timeOfDay = 'morning';
                else if (hour >= 10 && hour < 17) habit.timeOfDay = 'daytime';
                else if (hour >= 17 && hour < 21) habit.timeOfDay = 'evening';
                else habit.timeOfDay = 'night';
            }
            if (!habit.frequency) {
                habit.frequency = 'daily';
            }
            if (habit.weeklyDay === undefined) {
                habit.weeklyDay = 0;
            }
            this.habits.push(habit);
        }
        this._save('habits', this.habits);
        this._healIdentityPillars();
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

    _healIdentityPillars() {
        let modified = false;
        this.blueprints = this.blueprints || { identities: [], stacks: [] };
        this.blueprints.identities = this.blueprints.identities || [];
        
        this.habits.forEach(habit => {
            if (habit.active !== false && habit.identity && habit.identity.trim()) {
                const idTitle = habit.identity.trim();
                const exists = this.blueprints.identities.some(i => i.title && i.title.toLowerCase() === idTitle.toLowerCase());
                if (!exists) {
                    this.blueprints.identities.push({
                        id: 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        title: idTitle,
                        proof: 'Reinforced by ' + habit.name
                    });
                    modified = true;
                }
            }
        });
        
        if (modified) {
            this.blueprints.updatedAt = Date.now();
            this._save('blueprints', this.blueprints);
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
        let coinsGained = 0;
        let isChecking = true;
        
        const habit = this.habits.find(h => h.id === habitId);
        const hasSubactions = habit && habit.subactions && habit.subactions.length > 0;

        if (log.completions[habitId] && log.completions[habitId].completed) {
            isChecking = false;
            const wasTwoMinute = !!log.completions[habitId].isTwoMinute;
            if (hasSubactions) {
                if (!log.completions[habitId].subactions) {
                    log.completions[habitId].subactions = {};
                }
                habit.subactions.forEach(sub => {
                    if (log.completions[habitId].subactions[sub]) {
                        log.completions[habitId].subactions[sub] = false;
                        coinsGained -= 1;
                    }
                });
            } else {
                coinsGained = wasTwoMinute ? -1 : -2;
            }
            delete log.completions[habitId];
        } else {
            if (!log.completions[habitId]) {
                log.completions[habitId] = {
                    completed: true,
                    isTwoMinute: isTwoMinute,
                    completedAt: Date.now()
                };
            } else {
                log.completions[habitId].completed = true;
                log.completions[habitId].isTwoMinute = isTwoMinute;
                log.completions[habitId].completedAt = Date.now();
            }

            if (hasSubactions) {
                if (!log.completions[habitId].subactions) {
                    log.completions[habitId].subactions = {};
                }
                habit.subactions.forEach(sub => {
                    if (!log.completions[habitId].subactions[sub]) {
                        log.completions[habitId].subactions[sub] = true;
                        coinsGained += 1;
                    }
                });
            } else {
                coinsGained = isTwoMinute ? 1 : 2;
            }
        }
        
        this.saveLogForDate(dateStr, log);
        this.addCoins(coinsGained);

        // Check section completion bonus
        const bonusResult = this.checkSectionBonus(dateStr, habitId, isChecking);
        if (bonusResult.coinsGained !== 0) {
            this.addCoins(bonusResult.coinsGained);
            coinsGained += bonusResult.coinsGained;
        }

        return { 
            log, 
            coinsGained, 
            isChecking, 
            sectionCompleted: bonusResult.sectionCompleted,
            sectionIncompleted: bonusResult.sectionIncompleted
        };
    }

    toggleHabitSubaction(dateStr, habitId, subactionText, isChecked) {
        const log = this.getLogForDate(dateStr);
        if (!log.completions[habitId]) {
            log.completions[habitId] = {
                completed: false,
                completedAt: null,
                subactions: {}
            };
        }
        if (!log.completions[habitId].subactions) {
            log.completions[habitId].subactions = {};
        }
        
        const wasChecked = !!log.completions[habitId].subactions[subactionText];
        if (wasChecked === isChecked) {
            return { log, coinsGained: 0, isChecking: isChecked, sectionCompleted: null };
        }
        
        log.completions[habitId].subactions[subactionText] = isChecked;
        let coinsGained = isChecked ? 1 : -1;
        this.addCoins(coinsGained);
        
        // Check if all subactions of the habit are completed
        const habit = this.habits.find(h => h.id === habitId);
        let parentToggled = false;
        let sectionCompleted = null;
        let sectionIncompleted = null;

        if (habit && habit.subactions && habit.subactions.length > 0) {
            const allCompleted = habit.subactions.every(sub => !!log.completions[habitId].subactions[sub]);
            const wasCompleted = log.completions[habitId].completed;
            
            if (allCompleted && !wasCompleted) {
                log.completions[habitId].completed = true;
                log.completions[habitId].completedAt = Date.now();
                parentToggled = true;
                
                // Check section bonus
                const bonusResult = this.checkSectionBonus(dateStr, habitId, true);
                if (bonusResult.coinsGained !== 0) {
                    this.addCoins(bonusResult.coinsGained);
                    coinsGained += bonusResult.coinsGained;
                }
                sectionCompleted = bonusResult.sectionCompleted;
            } else if (!allCompleted && wasCompleted) {
                log.completions[habitId].completed = false;
                log.completions[habitId].completedAt = null;
                parentToggled = true;
                
                // Revert section bonus if applicable
                const bonusResult = this.checkSectionBonus(dateStr, habitId, false);
                if (bonusResult.coinsGained !== 0) {
                    this.addCoins(bonusResult.coinsGained);
                    coinsGained += bonusResult.coinsGained;
                }
                sectionIncompleted = bonusResult.sectionIncompleted;
            }
        }
        
        this.saveLogForDate(dateStr, log);
        return { 
            log, 
            coinsGained, 
            isChecking: isChecked, 
            parentToggled, 
            sectionCompleted, 
            sectionIncompleted 
        };
    }

    checkSectionBonus(dateStr, habitId, isChecking) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit || !habit.timeOfDay || habit.timeOfDay === 'all') return { coinsGained: 0, sectionCompleted: null };

        const section = habit.timeOfDay;
        const log = this.getLogForDate(dateStr);
        
        const sectionHabits = this.getHabits().filter(h => h.timeOfDay === section && isHabitActiveOnDate(h, dateStr));
        if (sectionHabits.length === 0) return { coinsGained: 0, sectionCompleted: null };

        if (!log.sectionBonuses) log.sectionBonuses = {};

        if (isChecking) {
            const allCompleted = sectionHabits.every(h => {
                if (h.id === habitId) return true;
                return log.completions[h.id] && log.completions[h.id].completed;
            });

            if (allCompleted && !log.sectionBonuses[section]) {
                log.sectionBonuses[section] = true;
                this.saveLogForDate(dateStr, log);
                return { coinsGained: 3, sectionCompleted: section };
            }
        } else {
            if (log.sectionBonuses[section]) {
                log.sectionBonuses[section] = false;
                this.saveLogForDate(dateStr, log);
                return { coinsGained: -3, sectionIncompleted: section };
            }
        }
        return { coinsGained: 0, sectionCompleted: null };
    }

    addCoins(amount) {
        this.blueprints.coins = Math.max(0, (this.blueprints.coins || 0) + amount);
        this.blueprints.updatedAt = Date.now();
        this._save('blueprints', this.blueprints);
        
        const appShell = window.globalAppInstance;
        if (appShell) {
            appShell.updateSidebarStats();
        }
    }

    addXp(amount) {
        // Legacy support
        this.addCoins(Math.round(amount / 10) || 1);
    }

    getBlueprints() {
        return this.blueprints;
    }

    saveBlueprints(blueprints) {
        this.blueprints = { ...this.blueprints, ...blueprints, updatedAt: Date.now() };
        this._save('blueprints', this.blueprints);
    }

    getSettings() {
        return this.settings;
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        if (newSettings.useNetlifyProxy !== undefined) {
            this.useProxy = !!newSettings.useNetlifyProxy;
        }
        this._save('settings', this.settings);
    }

    isPristine() {
        const isBlueprintsDefault = this.blueprints.identities && this.blueprints.identities.length === 2 && 
                                   this.blueprints.identities.some(i => i.id === '1') && 
                                   this.blueprints.identities.some(i => i.id === '2') &&
                                   (!this.blueprints.updatedAt || this.blueprints.updatedAt === 0);
        
        const hasOnlySampleHabits = this.habits.every(h => h.id === 'h_hygiene' || h.id === 'h_arranging');
        
        const hasNoTasks = this.tasks.length === 0;

        return isBlueprintsDefault && hasOnlySampleHabits && hasNoTasks;
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
        this.blueprints.coins = 20;
        this.blueprints.updatedAt = Date.now();
        this._save('blueprints', this.blueprints);
        this.settings.theme = 'dark'; // Force dark theme for clean Google-style dark mode by default
        this._save('settings', this.settings);
    }

    async testSheetsConnection(url) {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (this.useProxy && !isLocal) {
            const proxyUrl = `/api/proxy?action=test`;
            try {
                const res = await fetch(proxyUrl, {
                    headers: { 'x-target-url': url }
                });
                if (!res.ok) throw new Error(`Proxy HTTP Error ${res.status}`);
                const data = await res.json();
                return data.status === 'ok';
            } catch (e) {
                console.error("Proxy test connection failed:", e);
                throw e;
            }
        }

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

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (this.useProxy && !isLocal) {
            try {
                const res = await fetch('/api/proxy', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-target-url': url 
                    },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error(`Proxy Push HTTP Error ${res.status}`);
                return true;
            } catch (e) {
                console.error("Failed to push data via proxy:", e);
                throw e;
            }
        }

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

    async pullFromGoogleSheets(forceOverwrite = false) {
        const url = this.settings.sheetsUrl;
        if (!url) return false;

        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (this.useProxy && !isLocal) {
            const proxyUrl = `/api/proxy?action=pull`;
            try {
                const res = await fetch(proxyUrl, {
                    headers: { 'x-target-url': url }
                });
                if (!res.ok) throw new Error(`Proxy Pull HTTP Error ${res.status}`);
                const data = await res.json();
                
                this.mergeDatabase(data, forceOverwrite);
                return true;
            } catch (e) {
                console.error("Failed to pull data via proxy:", e);
                throw e;
            }
        }

        const pullUrl = `${url}?action=pull`;
        try {
            const res = await fetch(pullUrl);
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            const data = await res.json();
            
            this.mergeDatabase(data, forceOverwrite);
            return true;
        } catch (e) {
            console.error("Failed to pull data:", e);
            throw e;
        }
    }

    mergeDatabase(cloudData, forceOverwrite = false) {
        if (!cloudData) return false;

        const isPristine = this.isPristine();

        if (forceOverwrite || isPristine) {
            console.log("[AtomicFlow Sync] Pristine/Force Overwrite. Replacing local database with cloud. Pristine:", isPristine, "Force:", forceOverwrite);
            
            let databaseModified = false;
            
            if (Array.isArray(cloudData.habits)) {
                this.habits = cloudData.habits;
                localStorage.setItem(DB_PREFIX + 'habits', JSON.stringify(this.habits));
                databaseModified = true;
            }
            if (Array.isArray(cloudData.tasks)) {
                this.tasks = cloudData.tasks;
                localStorage.setItem(DB_PREFIX + 'tasks', JSON.stringify(this.tasks));
                databaseModified = true;
            }
            if (cloudData.blueprints) {
                this.blueprints = cloudData.blueprints;
                localStorage.setItem(DB_PREFIX + 'blueprints', JSON.stringify(this.blueprints));
                databaseModified = true;
            }
            if (cloudData.logs) {
                this.logs = cloudData.logs;
                localStorage.setItem(DB_PREFIX + 'logs', JSON.stringify(this.logs));
                databaseModified = true;
            }
            this._healIdentityPillars();
            return databaseModified;
        }

        let localModified = false;

        // 1. Merge Habits
        if (Array.isArray(cloudData.habits)) {
            const mergedHabits = [...this.habits];
            cloudData.habits.forEach(cloudHabit => {
                const localIndex = mergedHabits.findIndex(h => h.id === cloudHabit.id);
                if (localIndex !== -1) {
                    const localHabit = mergedHabits[localIndex];
                    const localTime = localHabit.updatedAt || localHabit.createdAt || 0;
                    const cloudTime = cloudHabit.updatedAt || cloudHabit.createdAt || 0;
                    if (cloudTime > localTime) {
                        mergedHabits[localIndex] = cloudHabit;
                        localModified = true;
                    }
                } else {
                    mergedHabits.push(cloudHabit);
                    localModified = true;
                }
            });
            this.habits = mergedHabits;
            if (localModified) {
                localStorage.setItem(DB_PREFIX + 'habits', JSON.stringify(this.habits));
            }
        }

        // 2. Merge Tasks
        if (Array.isArray(cloudData.tasks)) {
            let tasksModified = false;
            const mergedTasks = [...this.tasks];
            cloudData.tasks.forEach(cloudTask => {
                const localIndex = mergedTasks.findIndex(t => t.id === cloudTask.id);
                if (localIndex !== -1) {
                    const localTask = mergedTasks[localIndex];
                    const localTime = localTask.updatedAt || localTask.createdAt || 0;
                    const cloudTime = cloudTask.updatedAt || cloudTask.createdAt || 0;
                    if (cloudTime > localTime) {
                        mergedTasks[localIndex] = cloudTask;
                        tasksModified = true;
                    }
                } else {
                    mergedTasks.push(cloudTask);
                    tasksModified = true;
                }
            });
            this.tasks = mergedTasks;
            if (tasksModified) {
                localStorage.setItem(DB_PREFIX + 'tasks', JSON.stringify(this.tasks));
                localModified = true;
            }
        }

        // 3. Merge Blueprints
        if (cloudData.blueprints) {
            const cloudBlueprints = cloudData.blueprints;
            const localTime = this.blueprints.updatedAt || 0;
            const cloudTime = cloudBlueprints.updatedAt || 0;
            
            const isLocalDefault = this.blueprints.identities && this.blueprints.identities.length === 2 && 
                                   this.blueprints.identities.some(i => i.id === '1') && 
                                   this.blueprints.identities.some(i => i.id === '2') &&
                                   (!this.blueprints.updatedAt || this.blueprints.updatedAt === 0);
            
            if (cloudTime > localTime || (isLocalDefault && cloudData.updatedAt)) {
                this.blueprints = cloudBlueprints;
                localStorage.setItem(DB_PREFIX + 'blueprints', JSON.stringify(this.blueprints));
                localModified = true;
            }
        }

        // 4. Merge Logs
        if (cloudData.logs) {
            let logsModified = false;
            Object.keys(cloudData.logs).forEach(dateStr => {
                const cloudLog = cloudData.logs[dateStr];
                const localLog = this.logs[dateStr];
                if (localLog) {
                    const localTime = localLog.updatedAt || 0;
                    const cloudTime = cloudLog.updatedAt || 0;
                    if (cloudTime > localTime) {
                        this.logs[dateStr] = cloudLog;
                        logsModified = true;
                    }
                } else {
                    this.logs[dateStr] = cloudLog;
                    logsModified = true;
                }
            });
            if (logsModified) {
                localStorage.setItem(DB_PREFIX + 'logs', JSON.stringify(this.logs));
                localModified = true;
            }
        }

        this._healIdentityPillars();
        return localModified;
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
            // If the habit is not active on this date, skip it!
            if (!isHabitActiveOnDate(habit, dateStr)) {
                continue;
            }
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
        
        // Define a safety limit to prevent infinite loops (past creation date with some buffer)
        const limitDate = habit.createdAt ? new Date(habit.createdAt) : new Date();
        if (habit.createdAt) {
            limitDate.setDate(limitDate.getDate() - 7); // 7 days safety buffer before creation date
        } else {
            limitDate.setDate(limitDate.getDate() - 365); // fallback to 1 year back
        }

        while (!streakBroken) {
            if (checkDate < limitDate) {
                break;
            }
            
            const dateStr = checkDate.toISOString().split('T')[0];
            
            // If the habit was not active on this date, skip this day without breaking the streak!
            if (!isHabitActiveOnDate(habit, dateStr)) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }

            const log = logs[dateStr];
            const isCompleted = log && log.completions && log.completions[habitId] && log.completions[habitId].completed;

            if (isCompleted) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (dateStr === todayStr) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    
                    // Look for the next preceding active day to see if it was completed
                    let foundActivePreceding = false;
                    let innerCheckDate = new Date(checkDate);
                    while (!foundActivePreceding && innerCheckDate >= limitDate) {
                        const innerStr = innerCheckDate.toISOString().split('T')[0];
                        if (isHabitActiveOnDate(habit, innerStr)) {
                            foundActivePreceding = true;
                            const innerLog = logs[innerStr];
                            const innerCompleted = innerLog && innerLog.completions && innerLog.completions[habitId] && innerLog.completions[habitId].completed;
                            if (innerCompleted) {
                                // The preceding active day was completed, so the streak is NOT broken by today's incomplete status (since today is still in progress)
                                checkDate = innerCheckDate;
                            } else {
                                streakBroken = true;
                            }
                        } else {
                            innerCheckDate.setDate(innerCheckDate.getDate() - 1);
                        }
                    }
                    if (!foundActivePreceding) {
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
            const isTodayActive = isHabitActiveOnDate(habit, todayStr);
            const isYesterdayActive = isHabitActiveOnDate(habit, yesterdayStr);
            if (!isTodayActive || !isYesterdayActive) continue;

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
            const activeHabitsOnDate = habits.filter(h => h.createdAt <= logTime && isHabitActiveOnDate(h, d));
            
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
    activeTimers: {}, // Tracks running countdown intervals: habitId -> { secondsLeft, intervalId }

    render(container) {
        this.clearAllTimers();
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.activeFilter = 'all';
        
        // Smart Auto-Detect Time of Day: Morning 5-10 AM, Daytime 10 AM-5 PM, Evening 5-9 PM, Night 9 PM-5 AM
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 10) {
            this.activeTimeFilter = 'morning';
        } else if (hour >= 10 && hour < 17) {
            this.activeTimeFilter = 'daytime';
        } else if (hour >= 17 && hour < 21) {
            this.activeTimeFilter = 'evening';
        } else {
            this.activeTimeFilter = 'night';
        }
        
        this.container = container;
        this.updateView();
    },

    updateView() {
        const habits = db.getHabits();
        const blueprints = db.getBlueprints();
        const log = db.getLogForDate(this.selectedDate);
        
        // V4: Category + 3 Routines (Morning, Evening, Night) dual-filter system
        const filteredHabits = habits.filter(h => {
            const matchesCategory = this.activeFilter === 'all' || h.category === this.activeFilter;
            const matchesTime = this.activeTimeFilter === 'all' || h.timeOfDay === this.activeTimeFilter;
            const matchesDay = isHabitActiveOnDate(h, this.selectedDate);
            return matchesCategory && matchesTime && matchesDay;
        });

        const warnings = AtomicManager.getNeverMissTwiceWarnings();
        const activeHabitsForDay = habits.filter(h => isHabitActiveOnDate(h, this.selectedDate));
        const stats = this._getDayStats(log, activeHabitsForDay);

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

        // Render clean, decluttered layout (Consistent Card Sizes & Fully Mobile Responsive via column classes)
        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                ${warningBannerHtml}
                
                <div class="view-grid">
                    <!-- Left: Identity-Grouped Checklist -->
                    <div class="column-main" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        
                        <!-- Date picker panel -->
                        <div class="glass-card" style="padding: 0.5rem 1rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: center; align-items: center; gap: 0.25rem;">
                                <button class="btn btn-secondary" id="btn-prev-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i></button>
                                <input type="date" id="dashboard-date-picker" class="form-control" value="${this.selectedDate}" style="padding: 0.3rem 0.5rem; font-size: 0.85rem; width: 130px; border-radius: 16px; height: auto; text-align: center; border: 1px solid var(--border-color);">
                                <button class="btn btn-secondary" id="btn-next-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i></button>
                            </div>
                        </div>

                        <!-- Main Checklist Card (Decluttered & Correlated with Blueprints) -->
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <div class="card-header-flex" style="margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <div>
                                    <h3 class="card-title" style="font-size: 1.15rem; font-weight: 500;"><i data-lucide="check-circle" style="color: var(--primary); width: 20px; height: 20px;"></i> Daily Systems Checklist</h3>
                                    <p class="card-subtitle" style="font-size: 0.8rem; margin: 2px 0 0 0;">Daily routines grouped by identity (home time only).</p>
                                </div>

                                <!-- V4 Segmented Time of Day Filter (4 routines: Morning, Daytime, Evening, Night) -->
                                <div class="time-filter-segmented" style="display: inline-flex; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 20px; padding: 2px; height: fit-content; align-self: center; flex-wrap: wrap; gap: 2px;">
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'all' ? 'active-segment' : ''}" data-time="all" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">✨ All</button>
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'morning' ? 'active-segment' : ''}" data-time="morning" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">🌅 Morning</button>
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'daytime' ? 'active-segment' : ''}" data-time="daytime" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">☀️ Daytime</button>
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'evening' ? 'active-segment' : ''}" data-time="evening" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">🌙 Evening</button>
                                    <button class="btn time-filter-btn ${this.activeTimeFilter === 'night' ? 'active-segment' : ''}" data-time="night" style="padding: 0.25rem 0.65rem; font-size: 0.72rem; border: none; background: transparent; border-radius: 18px; font-weight: 600; color: var(--text-secondary); transition: all 0.2s; height: auto;">🌃 Night</button>
                                </div>
                            </div>

                            <div style="display: flex; flex-direction: column; gap: 1rem;">
                                ${this._renderGroupedHabits(filteredHabits, log, blueprints.identities)}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Sleep Logger & Completion stats & Reflections Preview -->
                    <div class="column-sidebar" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        
                        <!-- Completion card (Matching padding & border-radius) -->
                        <div class="glass-card text-center" style="display: flex; flex-direction: column; align-items: center; padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
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

                        <!-- Dedicated Bedtime Logger Card (Matching padding & border-radius) -->
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <h4 style="font-size: 1rem; font-weight: 500; display: flex; align-items: center; gap: 6px; margin-bottom: 0.75rem; color: var(--text-primary);">
                                <i data-lucide="moon" style="color: var(--primary); width: 18px; height: 18px;"></i> Bedtime & Sleep Logger
                            </h4>
                            <div id="sleep-card-content-root">
                                ${this._renderSleepLoggerCard(log)}
                            </div>
                        </div>

                        <!-- Correlated Daily Reflection Summary Card (Matching padding & border-radius) -->
                        ${(log.mood > 0 || winsText || hardText || anxietyText || freeText) ? `
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <h4 style="font-size: 1rem; font-weight: 500; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; color: var(--text-primary);">
                                <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="book-open" style="color: var(--primary); width: 18px; height: 18px;"></i> Day Reflection Log</span>
                                <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; background: var(--sidebar-active-bg); padding: 2px 8px; border-radius: 8px;">Saved</span>
                            </h4>
                            <div style="font-size: 0.82rem; display: flex; flex-direction: column; gap: 0.55rem;">
                                <div style="display: flex; gap: 1rem; align-items: center; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px; margin-bottom: 2px;">
                                    <div>Mood: <strong style="font-size: 1rem;">${["😔", "😐", "🙂", "😊", "😄"][log.mood - 1] || 'None'}</strong></div>
                                    <div style="border-left: 1px solid var(--border-color); padding-left: 10px;">Energy: <strong>${log.energy !== undefined && log.energy > 0 ? log.energy : 'Not set'} / 5</strong></div>
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

    

    _renderGroupedHabits(habits, log, identities) {
        if (habits.length === 0) {
            return `
                <div class="text-center" style="padding: 2rem; border: 1px dashed var(--border-color); border-radius: var(--radius-md); background: var(--bg-primary);">
                    <i data-lucide="sparkles" style="width: 28px; height: 28px; color: var(--text-muted); margin-bottom: 6px;"></i>
                    <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">No routines scheduled. Go to the <a href="#blueprint" style="color: var(--primary); font-weight: 600; text-decoration: none;">Blueprints tab</a> to forge your first habits!</p>
                </div>
            `;
        }

        return `<div style="display: flex; flex-direction: column; gap: 6px;">
            ${this._renderHabitListMarkup(habits, log)}
        </div>`;
    },

    _renderHabitListMarkup(groupHabits, log) {
        return groupHabits.map((habit) => {
            const completion = log.completions && log.completions[habit.id];
            const isCompleted = !!(completion && completion.completed);
            const isTwoMinuteSelected = completion ? completion.isTwoMinute : !!this.activeTwoMinuteHabits[habit.id];
            const displayName = isTwoMinuteSelected && habit.twoMinuteVersion ? `⚡ ${habit.twoMinuteVersion} (2-Min)` : habit.name;
            const streak = AtomicManager.calculateStreak(habit.id);
            const isHot = streak.current >= 5;
            const cat = habit.category || 'other';

            const activeTimer = this.activeTimers && this.activeTimers[habit.id];
            const isTimerRunning = !!(activeTimer && activeTimer.intervalId);
            const timerLabel = activeTimer ? this._formatTime(activeTimer.secondsLeft) : 'Start 2m';
            const timerIcon = isTimerRunning ? 'pause' : 'play';
            const timerStyle = isTimerRunning 
                ? 'background: var(--grad-primary); border-color: transparent; color: #0d0d0f;' 
                : 'background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.3); color: var(--primary);';
            
            return `
                <div class="habit-card habit-color-${cat} ${isCompleted ? 'completed' : ''} animate-fade-in" data-id="${habit.id}" style="position: relative;">
                    <label class="checkbox-wrapper" style="margin-bottom: 0;">
                        <input type="checkbox" class="habit-check" ${isCompleted ? 'checked' : ''}>
                        <span class="checkmark"><i data-lucide="check" style="width: 12px; height: 12px;"></i></span>
                    </label>

                    ${habit.twoMinuteVersion && (!habit.subactions || habit.subactions.length === 0) ? `
                        <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
                            <button class="btn-twomin-toggle-compact ${isTwoMinuteSelected ? 'active' : ''}" style="background: ${isTwoMinuteSelected ? 'var(--grad-primary)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${isTwoMinuteSelected ? 'transparent' : 'var(--border-color)'}; color: ${isTwoMinuteSelected ? '#0d0d0f' : 'var(--text-muted)'}; padding: 3px 6px; border-radius: 8px; font-size: 0.65rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 3px; flex-shrink: 0; transition: all 0.2s;" title="Toggle 2-Minute Easy Version">
                                <i data-lucide="zap" style="width: 10px; height: 10px; ${isTwoMinuteSelected ? 'fill: currentColor;' : ''}"></i>
                                2-Min
                            </button>
                            ${isTwoMinuteSelected && !isCompleted ? `
                                <button class="btn-habit-timer ${isTimerRunning ? 'running' : ''}" data-id="${habit.id}" style="${timerStyle} padding: 3px 6px; border-radius: 8px; font-size: 0.65rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 3px; flex-shrink: 0; transition: all 0.2s;" title="${isTimerRunning ? 'Pause Timer' : 'Start Timer'}">
                                    <i data-lucide="${timerIcon}" style="width: 10px; height: 10px;"></i>
                                    <span class="timer-label">${timerLabel}</span>
                                </button>
                            ` : ''}
                        </div>
                    ` : ''}

                    <div class="habit-details" style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;">
                        <span class="habit-color-dot dot-${cat}"></span>
                        <div style="display: flex; flex-direction: column; min-width: 0;">
                            <span class="habit-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">${displayName}</span>
                            ${habit.frequency && habit.frequency !== 'daily' ? `
                                <span class="habit-freq-badge" style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-top: 1px;">
                                    ${habit.frequency === 'weekdays' ? '📅 Weekdays' : 
                                      habit.frequency === 'weekends' ? '🏖️ Weekends' : 
                                      `🔁 Weekly (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][habit.weeklyDay || 0]})`}
                                </span>
                            ` : ''}
                        </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-left: auto;">
                        ${streak.current > 0 ? `
                            <div class="streak-badge ${isHot ? 'hot' : ''}" title="${streak.current} day streak">
                                <i data-lucide="flame" style="width: 10px; height: 10px;"></i>
                                <span>${streak.current}</span>
                            </div>
                        ` : ''}
                        
                        <button class="btn btn-secondary btn-drawer-toggle" style="padding: 1px 2px; border: none; background: transparent; color: var(--text-muted);">
                            <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>

                    ${habit.subactions && habit.subactions.length > 0 ? `
                        <div class="subactions-container" style="flex-basis: 100%; width: 100%; display: flex; flex-direction: column; gap: 0.4rem; padding-left: 2.25rem; border-left: 1px solid var(--border-color); margin-left: 0.75rem; margin-top: 0.25rem; margin-bottom: 0.25rem;">
                            ${habit.subactions.map(sub => {
                                const isSubCompleted = !!(completion && completion.subactions && completion.subactions[sub]);
                                return `
                                    <div class="subaction-row" data-sub-text="${sub}" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                                        <label class="checkbox-wrapper" style="width: 16px; height: 16px; margin-bottom: 0; flex-shrink: 0;">
                                            <input type="checkbox" class="subaction-check" ${isSubCompleted ? 'checked' : ''}>
                                            <span class="checkmark" style="width: 16px; height: 16px; border-radius: 50%; border-width: 1px;"><i data-lucide="check" style="width: 8px; height: 8px;"></i></span>
                                        </label>
                                        <span style="flex: 1; font-size: 0.78rem; color: ${isSubCompleted ? 'var(--text-muted)' : 'var(--text-secondary)'}; text-decoration: ${isSubCompleted ? 'line-through' : 'none'}; transition: color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                            ${sub}
                                        </span>
                                        ${isSubCompleted ? `
                                            <span style="font-size: 0.6rem; color: #fbbf24; font-weight: 600; flex-shrink: 0; margin-left: 4px;">+1 🪙</span>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}

                    <div class="habit-drawer hidden">
                        <div style="grid-column: span 1;">
                            <div class="drawer-section-title">1st Law: Make it Obvious</div>
                            <div class="drawer-bubble" style="margin-bottom: 0.5rem; font-size: 0.78rem; padding: 0.45rem;">
                                <strong>Cue:</strong> ${habit.cue || 'Not set.'}
                            </div>
                            <div class="drawer-bubble" style="font-size: 0.78rem; padding: 0.45rem;">
                                <strong>Stack:</strong> After I <em>${habit.stackTrigger || '[X]'}</em>, I will <em>${habit.name}</em>.
                            </div>
                        </div>
                        <div style="grid-column: span 1;">
                            <div class="drawer-section-title">4th Law: Make it Satisfying</div>
                            <div class="drawer-bubble" style="margin-bottom: 0.5rem; font-size: 0.78rem; padding: 0.45rem;">
                                <strong>Reward:</strong> ${habit.reward || 'Not set.'}
                            </div>
                            <div class="drawer-bubble" style="border-color: rgba(184, 240, 100, 0.2); background: rgba(184, 240, 100, 0.01); font-size: 0.78rem; padding: 0.45rem;">
                                <strong>Identity:</strong> Proving I am <em>"${habit.identity || 'better today'}"</em>.
                            </div>
                        </div>
                        
                        <div style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem; flex-wrap: wrap; gap: 0.5rem;">
                            ${habit.twoMinuteVersion ? `
                                <span style="font-size: 0.7rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; background: rgba(99,102,241,0.05); padding: 3px 8px; border-radius: var(--radius-sm); border: 1px solid rgba(99,102,241,0.1);">
                                    ⚡ 2-Min target: "${habit.twoMinuteVersion}"
                                </span>
                            ` : '<span></span>'}
                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-secondary btn-edit-habit" style="padding: 0.2rem 0.5rem; font-size: 0.68rem; border-color: rgba(99,102,241,0.15); color: var(--primary);"><i data-lucide="edit-3" style="width: 10px; height: 10px;"></i> Edit</button>
                                <button class="btn btn-secondary btn-delete-habit" style="padding: 0.2rem 0.5rem; font-size: 0.68rem; border-color: rgba(239,68,68,0.15); color: #ef4444;"><i data-lucide="trash-2" style="width: 10px; height: 10px;"></i> Delete</button>
                            </div>
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
                <div style="display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, 0.02); padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px dashed var(--border-color); font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
                    <i data-lucide="moon" style="width: 16px; height: 16px; color: var(--text-muted);"></i>
                    <span>🌙 Sleep not logged yet</span>
                </div>
                <form id="sleep-logger-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Bedtime</label>
                            <input type="time" id="sleep-bedtime-input" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" value="" required>
                        </div>
                        <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Wake Up</label>
                            <input type="time" id="sleep-wakeup-input" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" value="" required>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Rest Quality</label>
                        <select id="sleep-quality-select" class="form-control" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" required>
                            <option value="" disabled selected>-- Select Quality --</option>
                            <option value="3">😄 Fully Refreshed & Energized</option>
                            <option value="2">😐 Rested (Okay Sleep)</option>
                            <option value="1">😢 Restless (Tired / Interrupted)</option>
                        </select>
                    </div>

                    <button type="submit" class="btn btn-primary" style="padding: 0.45rem 1rem; font-size: 0.8rem; border-radius: 12px; font-weight: 600; margin-top: 0.25rem;"><i data-lucide="moon"></i> Save Log & +2 Coins 🪙</button>
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



    _setupListeners() {

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
                if (e.target.closest('.checkbox-wrapper') || e.target.closest('.btn-twomin-toggle-compact') || e.target.closest('.btn-delete-habit')) return;
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

            const editBtn = card.querySelector('.btn-edit-habit');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    const hId = card.getAttribute('data-id');
                    this.showHabitEditModal(hId);
                });
            }
        });

        cards.forEach(card => {
            const tmBtn = card.querySelector('.btn-twomin-toggle-compact');
            if (tmBtn) {
                tmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const habitId = card.getAttribute('data-id');
                    const habit = db.getHabits().find(h => h.id === habitId);
                    
                    const completion = db.getLogForDate(this.selectedDate).completions[habitId];
                    if (completion && completion.completed) {
                        showGlobalToast("Uncheck the habit first to adjust modes!");
                        return;
                    }
                    
                    const wasActive = !!this.activeTwoMinuteHabits[habitId];
                    if (wasActive) {
                        delete this.activeTwoMinuteHabits[habitId];
                        if (this.activeTimers && this.activeTimers[habitId]) {
                            if (this.activeTimers[habitId].intervalId) {
                                clearInterval(this.activeTimers[habitId].intervalId);
                            }
                            delete this.activeTimers[habitId];
                        }
                        showGlobalToast("Normal mode activated.");
                    } else {
                        this.activeTwoMinuteHabits[habitId] = true;
                        showGlobalToast(`2-Min version active: "${habit.twoMinuteVersion}"`);
                    }
                    this.updateView();
                });
            }

            const timerBtn = card.querySelector('.btn-habit-timer');
            if (timerBtn) {
                timerBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const habitId = card.getAttribute('data-id');
                    this.toggleHabitTimer(habitId);
                });
            }
        });

        cards.forEach(card => {
            const check = card.querySelector('.habit-check');
            check.addEventListener('change', (e) => {
                const habitId = card.getAttribute('data-id');
                const isTwoMinute = !!this.activeTwoMinuteHabits[habitId];

                // Stop and delete any running timer for this habit if manually checked/unchecked
                if (this.activeTimers && this.activeTimers[habitId]) {
                    if (this.activeTimers[habitId].intervalId) {
                        clearInterval(this.activeTimers[habitId].intervalId);
                    }
                    delete this.activeTimers[habitId];
                }

                if (e.target.checked) {
                    card.classList.add('completed');
                    card.classList.add('animate-pop');
                    this._playConfetti();
                } else {
                    card.classList.remove('completed');
                }

                const { coinsGained, isChecking, sectionCompleted } = db.toggleHabitCompletion(this.selectedDate, habitId, isTwoMinute);
                this._floatCoinNotification(card, coinsGained, isChecking);

                if (sectionCompleted) {
                    setTimeout(() => {
                        this._playConfetti();
                        const sectionName = sectionCompleted.charAt(0).toUpperCase() + sectionCompleted.slice(1);
                        showGlobalToast(`${sectionName} routines completed! +3 Coins Bonus! 🪙`);
                    }, 500);
                }

                setTimeout(() => {
                    this.updateView();
                    this._updateSidebarProgress();
                }, 400);
            });

            // Subaction check listener
            const subChecks = card.querySelectorAll('.subaction-check');
            subChecks.forEach(subCheck => {
                subCheck.addEventListener('change', (e) => {
                    const habitId = card.getAttribute('data-id');
                    const subRow = subCheck.closest('.subaction-row');
                    const subText = subRow.getAttribute('data-sub-text');
                    const isChecked = e.target.checked;
                    
                    const { coinsGained, isChecking, parentToggled, sectionCompleted, sectionIncompleted } = db.toggleHabitSubaction(this.selectedDate, habitId, subText, isChecked);
                    
                    if (isChecked) {
                        subRow.classList.add('animate-pop');
                        this._playConfetti();
                    }
                    
                    this._floatCoinNotification(card, coinsGained, isChecking);
                    
                    if (sectionCompleted) {
                        setTimeout(() => {
                            this._playConfetti();
                            const sectionName = sectionCompleted.charAt(0).toUpperCase() + sectionCompleted.slice(1);
                            showGlobalToast(`${sectionName} routines completed! +3 Coins Bonus! 🪙`);
                        }, 500);
                    }
                    
                    setTimeout(() => {
                        this.updateView();
                        this._updateSidebarProgress();
                    }, 400);
                });
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
                
                db.addCoins(2);
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
                currentLog.sleepQuality = 0;
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


    },

    _floatCoinNotification(card, amount, isChecking) {
        if (amount === 0) return;
        
        const floatSpan = document.createElement('span');
        floatSpan.innerText = isChecking ? `+${amount} Coin${amount > 1 ? 's' : ''} 🪙` : `-${Math.abs(amount)} Coin${Math.abs(amount) > 1 ? 's' : ''} 🪙`;
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
    },

    clearAllTimers() {
        if (this.activeTimers) {
            Object.keys(this.activeTimers).forEach(habitId => {
                if (this.activeTimers[habitId].intervalId) {
                    clearInterval(this.activeTimers[habitId].intervalId);
                }
            });
        }
        this.activeTimers = {};
    },

    _formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    toggleHabitTimer(habitId) {
        if (!this.activeTimers) this.activeTimers = {};
        
        const timer = this.activeTimers[habitId];
        
        if (timer && timer.intervalId) {
            // Pause
            clearInterval(timer.intervalId);
            timer.intervalId = null;
            this.updateView();
            showGlobalToast("Timer paused.");
        } else {
            // Start/Resume
            let secondsLeft = 120; // 2 minutes
            if (timer) {
                secondsLeft = timer.secondsLeft;
            } else {
                this.activeTimers[habitId] = { secondsLeft: 120, intervalId: null };
            }
            
            showGlobalToast("2-Minute timer started! Focus on the habit...");
            
            const intervalId = setInterval(() => {
                const activeTimer = this.activeTimers[habitId];
                if (!activeTimer) {
                    clearInterval(intervalId);
                    return;
                }
                
                activeTimer.secondsLeft--;
                
                // Live update the button text in the DOM
                const btn = this.container.querySelector(`.btn-habit-timer[data-id="${habitId}"]`);
                if (btn) {
                    const label = btn.querySelector('.timer-label');
                    if (label) label.innerText = this._formatTime(activeTimer.secondsLeft);
                }
                
                if (activeTimer.secondsLeft <= 0) {
                    clearInterval(intervalId);
                    delete this.activeTimers[habitId];
                    this.completeHabitViaTimer(habitId);
                }
            }, 1000);
            
            this.activeTimers[habitId].intervalId = intervalId;
            this.updateView();
        }
    },

    completeHabitViaTimer(habitId) {
        this._playSuccessTone();
        const isTwoMinute = true;
        const { coinsGained, isChecking, sectionCompleted } = db.toggleHabitCompletion(this.selectedDate, habitId, isTwoMinute);
        
        this._playConfetti();
        showGlobalToast("2-Min Rule accomplished! +1 Coin gained! ⚡ 🪙");
        
        if (sectionCompleted) {
            setTimeout(() => {
                this._playConfetti();
                const sectionName = sectionCompleted.charAt(0).toUpperCase() + sectionCompleted.slice(1);
                showGlobalToast(`${sectionName} routines completed! +3 Coins Bonus! 🪙`);
            }, 500);
        }
        
        this.updateView();
        this._updateSidebarProgress();
    },

    _playSuccessTone() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Tone 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc1.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
            
            gain1.gain.setValueAtTime(0.12, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start();
            osc1.stop(ctx.currentTime + 0.3);
            
            // Tone 2 (delayed)
            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
                
                gain2.gain.setValueAtTime(0.12, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
                
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start();
                osc2.stop(ctx.currentTime + 0.4);
            }, 120);
        } catch (e) {
            console.error("Audio chime playback blocked or unsupported:", e);
        }
    },

    showHabitEditModal(habitId) {
        const habit = db.getHabits().find(h => h.id === habitId);
        if (!habit) return;

        const blueprints = db.getBlueprints();
        
        const modal = document.createElement('div');
        modal.id = 'habit-edit-modal';
        modal.className = 'glass-card';
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.width = '90%';
        modal.style.maxWidth = '500px';
        modal.style.zIndex = '100001';
        modal.style.padding = '1.5rem';
        modal.style.borderRadius = 'var(--radius-md)';
        modal.style.boxShadow = 'var(--glass-shadow)';
        modal.style.border = '1px solid var(--border-color)';
        modal.style.background = 'var(--bg-primary)';

        const backdrop = document.createElement('div');
        backdrop.id = 'habit-edit-backdrop';
        backdrop.style.position = 'fixed';
        backdrop.style.top = '0';
        backdrop.style.left = '0';
        backdrop.style.width = '100%';
        backdrop.style.height = '100%';
        backdrop.style.background = 'rgba(0, 0, 0, 0.6)';
        backdrop.style.backdropFilter = 'blur(8px)';
        backdrop.style.zIndex = '100000';

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                <h3 style="font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 6px; color: var(--text-primary);">
                    <i data-lucide="edit-3" style="color: var(--primary); width: 18px; height: 18px;"></i> Edit Habit
                </h3>
                <button id="btn-close-edit-modal" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px;"><i data-lucide="x" style="width: 18px; height: 18px;"></i></button>
            </div>
            
            <form id="edit-habit-form" style="display: flex; flex-direction: column; gap: 0.85rem; max-height: 70vh; overflow-y: auto; padding-right: 4px;">
                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 600;">Habit Name</label>
                    <input type="text" id="edit-habit-name" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" value="${habit.name}" required>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 600;">Identity Pillar</label>
                    <select id="edit-habit-identity" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" required>
                        ${blueprints.identities.map(id => `<option value="${id.title}" ${habit.identity === id.title ? 'selected' : ''}>${id.title}</option>`).join('') || '<option value="">(Create an Identity Pillar first!)</option>'}
                    </select>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem; font-weight: 600;">Color/Category</label>
                        <select id="edit-habit-category" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                            <option value="health" ${habit.category === 'health' ? 'selected' : ''}>Health (Green)</option>
                            <option value="mind" ${habit.category === 'mind' ? 'selected' : ''}>Mind (Blue)</option>
                            <option value="career" ${habit.category === 'career' ? 'selected' : ''}>Career (Purple)</option>
                            <option value="other" ${habit.category === 'other' ? 'selected' : ''}>General (Orange)</option>
                        </select>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem; font-weight: 600;">Timing</label>
                        <select id="edit-habit-time" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                            <option value="morning" ${habit.timeOfDay === 'morning' ? 'selected' : ''}>Morning</option>
                            <option value="daytime" ${habit.timeOfDay === 'daytime' ? 'selected' : ''}>Daytime</option>
                            <option value="evening" ${habit.timeOfDay === 'evening' ? 'selected' : ''}>Evening</option>
                            <option value="night" ${habit.timeOfDay === 'night' ? 'selected' : ''}>Night</option>
                        </select>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-size: 0.75rem; font-weight: 600;">Frequency</label>
                        <select id="edit-habit-frequency" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                            <option value="daily" ${habit.frequency === 'daily' || !habit.frequency ? 'selected' : ''}>Everyday</option>
                            <option value="weekdays" ${habit.frequency === 'weekdays' ? 'selected' : ''}>Weekdays (Mon-Fri)</option>
                            <option value="weekends" ${habit.frequency === 'weekends' ? 'selected' : ''}>Weekends (Sat-Sun)</option>
                            <option value="weekly" ${habit.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
                        </select>
                    </div>
                    <div class="form-group" id="edit-habit-weekly-day-group" style="margin-bottom: 0; display: ${habit.frequency === 'weekly' ? 'block' : 'none'};">
                        <label style="font-size: 0.75rem; font-weight: 600;">On Day</label>
                        <select id="edit-habit-weekly-day" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                            <option value="0" ${habit.weeklyDay === 0 || habit.weeklyDay === undefined ? 'selected' : ''}>Sunday</option>
                            <option value="1" ${habit.weeklyDay === 1 ? 'selected' : ''}>Monday</option>
                            <option value="2" ${habit.weeklyDay === 2 ? 'selected' : ''}>Tuesday</option>
                            <option value="3" ${habit.weeklyDay === 3 ? 'selected' : ''}>Wednesday</option>
                            <option value="4" ${habit.weeklyDay === 4 ? 'selected' : ''}>Thursday</option>
                            <option value="5" ${habit.weeklyDay === 5 ? 'selected' : ''}>Friday</option>
                            <option value="6" ${habit.weeklyDay === 6 ? 'selected' : ''}>Saturday</option>
                        </select>
                    </div>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 600;">Habit Stack Trigger</label>
                    <input type="text" id="edit-habit-trigger" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" value="${habit.stackTrigger || ''}" required>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 600;">Obvious Cue</label>
                    <input type="text" id="edit-habit-cue" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" value="${habit.cue || ''}" required>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 600;">2-Minute Version (Optional)</label>
                    <input type="text" id="edit-habit-twomin" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" value="${habit.twoMinuteVersion || ''}" placeholder="Leave blank if already < 2m (e.g. take a pill)">
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 600;">Immediate Reward</label>
                    <input type="text" id="edit-habit-reward" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" value="${habit.reward || ''}" required>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label style="font-size: 0.75rem; font-weight: 600;">Sub-actions / Checklist (Optional, one per line)</label>
                    <textarea id="edit-habit-subactions" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem; height: 60px; resize: vertical;" placeholder="e.g. Supplement A&#10;Supplement B">${(habit.subactions || []).join('\n')}</textarea>
                </div>

                <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem; padding: 0.5rem 1.25rem; font-size: 0.82rem; border-radius: 12px; font-weight: 600;"><i data-lucide="check"></i> Save Changes</button>
            </form>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);
        lucide.createIcons();

        const closeModal = () => {
            modal.remove();
            backdrop.remove();
        };

        backdrop.addEventListener('click', closeModal);
        modal.querySelector('#btn-close-edit-modal').addEventListener('click', closeModal);

        const editFreqSelect = modal.querySelector('#edit-habit-frequency');
        const editWeeklyDayGroup = modal.querySelector('#edit-habit-weekly-day-group');
        if (editFreqSelect && editWeeklyDayGroup) {
            editFreqSelect.addEventListener('change', (e) => {
                if (e.target.value === 'weekly') {
                    editWeeklyDayGroup.style.display = 'block';
                } else {
                    editWeeklyDayGroup.style.display = 'none';
                }
            });
        }

        modal.querySelector('#edit-habit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const updatedHabit = {
                id: habitId,
                name: modal.querySelector('#edit-habit-name').value.trim(),
                identity: modal.querySelector('#edit-habit-identity').value,
                category: modal.querySelector('#edit-habit-category').value,
                timeOfDay: modal.querySelector('#edit-habit-time').value,
                stackTrigger: modal.querySelector('#edit-habit-trigger').value.trim(),
                cue: modal.querySelector('#edit-habit-cue').value.trim(),
                twoMinuteVersion: modal.querySelector('#edit-habit-twomin').value.trim(),
                reward: modal.querySelector('#edit-habit-reward').value.trim(),
                frequency: modal.querySelector('#edit-habit-frequency').value,
                weeklyDay: parseInt(modal.querySelector('#edit-habit-weekly-day').value),
                subactions: modal.querySelector('#edit-habit-subactions').value.trim().split('\n').map(s => s.trim()).filter(Boolean)
            };

            db.saveHabit(updatedHabit);
            closeModal();
            showGlobalToast("Habit updated successfully!");
            
            this.updateView();
            this._updateSidebarProgress();
        });
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
        this.activeEnergy = log.energy !== undefined && log.energy > 0 ? log.energy : 3;
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
        const isEnergyChanged = this.activeEnergy !== (currentLog.energy !== undefined && currentLog.energy > 0 ? currentLog.energy : 3);

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
        // V6 Redesigned Journal: Single-column, reflection-first, ultra compact
        const habits = db.getHabits();
        const activeHabitsForDay = habits.filter(h => isHabitActiveOnDate(h, this.selectedDate));
        const completions = log.completions || {};
        let completedCount = 0;
        let totalCount = activeHabitsForDay.length;

        const habitSummaryHtml = activeHabitsForDay.map(h => {
            const isDone = completions[h.id] && completions[h.id].completed;
            if (isDone) completedCount++;
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; padding: 4px 0; border-bottom: 1px dashed var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 6px; color: ${isDone ? 'var(--text-primary)' : 'var(--text-muted)'};">
                        <i data-lucide="${isDone ? 'check-circle-2' : 'circle'}" style="width: 13px; height: 13px; color: ${isDone ? 'var(--color-success)' : 'var(--text-muted)'}; flex-shrink: 0;"></i>
                        <span>${h.name}</span>
                    </div>
                    <span style="font-size: 0.68rem; color: ${isDone ? 'var(--color-success)' : 'var(--text-muted)'}; font-weight: 600; flex-shrink: 0;">
                        ${isDone ? '+1 Coin 🪙' : '—'}
                    </span>
                </div>
            `;
        }).join('') || `<div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; font-style: italic; padding: 0.35rem 0;">No habits tracked.</div>`;

        const winsText = Array.isArray(log.wins) ? log.wins.join('\n') : (log.wins || '');
        const hardText = log.hard || '';
        const anxietyText = log.anxiety || '';
        const tomorrowText = log.tomorrow || log.improvement || '';
        const freeText = log.journalNotes || log.free || '';

        // Calculate journaling streak
        let journalStreak = 0;
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            const dayLog = db.logs[dStr];
            if (dayLog && (dayLog.mood > 0 || dayLog.wins?.length > 0 || dayLog.hard || dayLog.journalNotes)) {
                journalStreak++;
            } else {
                break;
            }
        }

        // Is today logged?
        const isTodayLogged = this.selectedDate === new Date().toISOString().split('T')[0] && (log.mood > 0 || (log.wins && log.wins.length > 0));

        const moodLabels = ['', 'Rough', 'Meh', 'Okay', 'Good', 'Great'];
        const energyLabels = ['', 'Drained', 'Low', 'Balanced', 'Charged', 'Peak'];

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%; box-sizing: border-box; max-width: 680px; margin: 0 auto;">

                <!-- Date Nav + Streak Row -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <button class="btn btn-secondary" id="btn-prev-journal-day" style="padding: 0.3rem 0.4rem; border: none; background: transparent;"><i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i></button>
                        <input type="date" id="journal-date-picker" class="form-control" value="${this.selectedDate}" style="width: 130px; border-radius: 16px; padding: 0.3rem 0.5rem; font-size: 0.82rem; height: auto; text-align: center; border: 1px solid var(--border-color);">
                        <button class="btn btn-secondary" id="btn-next-journal-day" style="padding: 0.3rem 0.4rem; border: none; background: transparent;"><i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i></button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                        ${journalStreak > 0 ? `
                            <span style="font-size: 0.72rem; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 3px;">
                                <i data-lucide="flame" style="width: 13px; height: 13px;"></i> ${journalStreak}-day streak
                            </span>
                        ` : ''}
                        <button class="btn btn-primary" id="btn-save-journal" style="padding: 0.4rem 1rem; font-size: 0.78rem; border-radius: 16px;">
                            <i data-lucide="save" style="width: 13px; height: 13px;"></i> Save
                        </button>
                    </div>
                </div>

                <!-- Mood + Energy Compact Inline -->
                <div class="glass-card" style="padding: 0.75rem 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
                    <div style="display: flex; gap: 1rem; align-items: stretch; flex-wrap: wrap;">
                        <!-- Mood -->
                        <div style="flex: 1; min-width: 150px;">
                            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 4px;">
                                <i data-lucide="smile" style="width: 12px; height: 12px; color: var(--primary);"></i>
                                Mood
                                <span id="mood-label" style="color: var(--text-muted); font-weight: 500; margin-left: auto;">${this.activeMood > 0 ? moodLabels[this.activeMood] : '—'}</span>
                            </div>
                            <div class="mood-picker" id="mood-row" style="margin-bottom: 0; gap: 0.3rem;">
                                <button class="mood-btn ${this.activeMood === 1 ? 'sel' : ''}" data-mood="1" style="padding: 6px 2px; font-size: 18px;">😔</button>
                                <button class="mood-btn ${this.activeMood === 2 ? 'sel' : ''}" data-mood="2" style="padding: 6px 2px; font-size: 18px;">😐</button>
                                <button class="mood-btn ${this.activeMood === 3 ? 'sel' : ''}" data-mood="3" style="padding: 6px 2px; font-size: 18px;">🙂</button>
                                <button class="mood-btn ${this.activeMood === 4 ? 'sel' : ''}" data-mood="4" style="padding: 6px 2px; font-size: 18px;">😊</button>
                                <button class="mood-btn ${this.activeMood === 5 ? 'sel' : ''}" data-mood="5" style="padding: 6px 2px; font-size: 18px;">😄</button>
                            </div>
                        </div>
                        <!-- Energy -->
                        <div style="flex: 1; min-width: 150px;">
                            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.4rem; display: flex; align-items: center; gap: 4px;">
                                <i data-lucide="zap" style="width: 12px; height: 12px; color: var(--color-warning);"></i>
                                Energy
                                <span id="energy-label" style="color: var(--text-muted); font-weight: 500; margin-left: auto;">${this.activeEnergy > 0 ? energyLabels[this.activeEnergy] : '—'}</span>
                            </div>
                            <div class="energy-picker" id="nrg-row" style="margin-bottom: 0; gap: 0.3rem;">
                                <button class="energy-btn ${this.activeEnergy === 1 ? 'sel' : ''}" data-energy="1" style="padding: 6px 2px;">1</button>
                                <button class="energy-btn ${this.activeEnergy === 2 ? 'sel' : ''}" data-energy="2" style="padding: 6px 2px;">2</button>
                                <button class="energy-btn ${this.activeEnergy === 3 ? 'sel' : ''}" data-energy="3" style="padding: 6px 2px;">3</button>
                                <button class="energy-btn ${this.activeEnergy === 4 ? 'sel' : ''}" data-energy="4" style="padding: 6px 2px;">4</button>
                                <button class="energy-btn ${this.activeEnergy === 5 ? 'sel' : ''}" data-energy="5" style="padding: 6px 2px;">5</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Daily Reflection — the PRIMARY input area, always on top -->
                <div class="glass-card" style="padding: 1rem 1.15rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.85rem;">

                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-bottom: 0.3rem;">
                                🏆 Today's wins
                            </label>
                            <textarea class="form-control j-auto-grow" id="j-wins" placeholder="What went well? Any habit that felt automatic?" style="border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.82rem; width: 100%; min-height: 48px; resize: none; overflow: hidden;">${winsText}</textarea>
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-bottom: 0.3rem;">
                                💪 What was hard
                            </label>
                            <textarea class="form-control j-auto-grow" id="j-hard" placeholder="Any friction, struggle, or habit you skipped?" style="border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.82rem; width: 100%; min-height: 48px; resize: none; overflow: hidden;">${hardText}</textarea>
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-bottom: 0.3rem;">
                                🅿️ Anxiety parking lot
                                <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 400; margin-left: auto;">park it, deal tomorrow</span>
                            </label>
                            <textarea class="form-control j-auto-grow" id="j-anxiety" placeholder="Write it here instead of doomscrolling tonight…" style="border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.82rem; width: 100%; min-height: 48px; resize: none; overflow: hidden;">${anxietyText}</textarea>
                        </div>

                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-bottom: 0.3rem;">
                                🌅 Intention for tomorrow
                            </label>
                            <textarea class="form-control j-auto-grow" id="j-tomorrow" placeholder="One thing to focus on or do differently…" style="border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.82rem; width: 100%; min-height: 40px; resize: none; overflow: hidden;">${tomorrowText}</textarea>
                        </div>

                        <div style="border-top: 1px dashed var(--border-color); padding-top: 0.75rem;">
                            <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px; margin-bottom: 0.3rem;">
                                📝 Free writing
                            </label>
                            <textarea id="reflections-textarea" class="form-control j-auto-grow" style="border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.82rem; width: 100%; min-height: 60px; resize: none; overflow: hidden;" placeholder="Thoughts, feelings, gratitude, observations…">${freeText}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Routine Compliance — collapsible, secondary -->
                <div class="glass-card" style="padding: 0; border-radius: var(--radius-md); margin-bottom: 0.75rem; overflow: hidden;">
                    <button id="toggle-routine-compliance" style="width: 100%; background: transparent; border: none; padding: 0.65rem 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: var(--text-primary);">
                        <span style="font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="check-square" style="width: 14px; height: 14px; color: var(--primary);"></i> Routine Compliance
                        </span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.72rem; font-weight: 700; background: var(--sidebar-active-bg); color: var(--primary); padding: 2px 8px; border-radius: 10px;">${completedCount} / ${totalCount}</span>
                            <i data-lucide="chevron-down" id="compliance-chevron" style="width: 14px; height: 14px; color: var(--text-muted); transition: transform 0.2s;"></i>
                        </div>
                    </button>
                    <div id="routine-compliance-content" style="display: none; padding: 0 1rem 0.75rem;">
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            ${habitSummaryHtml}
                        </div>
                    </div>
                </div>

            </div>

            <!-- Toast Success Popup -->
            <div id="save-toast" class="glass-card animate-slide-up" style="position: fixed; bottom: 2rem; right: 2rem; background: var(--grad-success); color: #ffffff; padding: 0.75rem 1.5rem; border-radius: var(--radius-sm); box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3); z-index: 10000; border: none; display: none;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
                    <i data-lucide="check-circle" style="width: 20px; height: 20px;"></i>
                    <span id="toast-message-span">Reflection Log Saved! +2 Coins 🪙</span>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
        this._initAutoGrow();
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

        const moodLabels = ['', 'Rough', 'Meh', 'Okay', 'Good', 'Great'];
        const moodButtons = this.container.querySelectorAll('#mood-row .mood-btn');
        const moodLabel = this.container.querySelector('#mood-label');
        moodButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                moodButtons.forEach(b => b.classList.remove('sel'));
                btn.classList.add('sel');
                this.activeMood = parseInt(btn.getAttribute('data-mood'));
                if (moodLabel) moodLabel.textContent = moodLabels[this.activeMood] || '—';
            });
        });

        const energyLabels = ['', 'Drained', 'Low', 'Balanced', 'Charged', 'Peak'];
        const energyButtons = this.container.querySelectorAll('#nrg-row .energy-btn');
        const energyLabel = this.container.querySelector('#energy-label');
        energyButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                energyButtons.forEach(b => b.classList.remove('sel'));
                btn.classList.add('sel');
                this.activeEnergy = parseInt(btn.getAttribute('data-energy'));
                if (energyLabel) energyLabel.textContent = energyLabels[this.activeEnergy] || '—';
            });
        });

        // Collapsible Routine Compliance
        const toggleBtn = this.container.querySelector('#toggle-routine-compliance');
        const complianceContent = this.container.querySelector('#routine-compliance-content');
        const complianceChevron = this.container.querySelector('#compliance-chevron');
        if (toggleBtn && complianceContent) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = complianceContent.style.display !== 'none';
                complianceContent.style.display = isOpen ? 'none' : 'block';
                if (complianceChevron) {
                    complianceChevron.style.transform = isOpen ? '' : 'rotate(180deg)';
                }
            });
        }

        this.container.querySelector('#btn-save-journal').addEventListener('click', () => {
            const existingLog = db.logs[this.selectedDate];
            const isFirstSave = !existingLog || !existingLog.journalSaveBonusAwarded;
            
            const winsVal = this.container.querySelector('#j-wins').value.trim();
            const hardVal = this.container.querySelector('#j-hard').value.trim();
            const anxietyVal = this.container.querySelector('#j-anxiety').value.trim();
            const tomorrowVal = this.container.querySelector('#j-tomorrow').value.trim();
            const freeVal = this.container.querySelector('#reflections-textarea').value.trim();

            const logData = {
                mood: this.activeMood,
                energy: this.activeEnergy || 3,
                wins: winsVal ? winsVal.split('\n').map(w => w.trim()).filter(Boolean) : [],
                hard: hardVal,
                anxiety: anxietyVal,
                tomorrow: tomorrowVal,
                improvement: tomorrowVal, // compatibility
                free: freeVal,
                journalNotes: freeVal, // compatibility
                journalSaveBonusAwarded: (existingLog && existingLog.journalSaveBonusAwarded) || isFirstSave
            };

            db.saveLogForDate(this.selectedDate, logData);
            
            let gainedText = "Reflection Log Saved!";
            if (isFirstSave) {
                db.addCoins(2);
                gainedText = "Reflection Log Saved! +2 Coins 🪙";
            }
            this._showToast(gainedText);
            
            // Re-render to reflect new summary/compliance states
            this.loadDateLog();
        });
    },

    _initAutoGrow() {
        const textareas = this.container.querySelectorAll('.j-auto-grow');
        textareas.forEach(ta => {
            // Set initial height based on content
            ta.style.height = 'auto';
            if (ta.scrollHeight > ta.clientHeight) {
                ta.style.height = ta.scrollHeight + 'px';
            }
            // Grow on input
            ta.addEventListener('input', () => {
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
            });
            // Subtle focus glow
            ta.addEventListener('focus', () => {
                ta.style.borderColor = 'var(--primary)';
                ta.style.boxShadow = '0 0 0 2px rgba(184, 240, 100, 0.12)';
            });
            ta.addEventListener('blur', () => {
                ta.style.borderColor = '';
                ta.style.boxShadow = '';
            });
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
// 4b. DEDICATED FOCUS TASKS VIEW COMPONENT [NEW]
// =========================================================================
const FocusTasks = {
    selectedDate: new Date().toISOString().split('T')[0],

    render(container) {
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.container = container;
        this.updateView();
    },

    updateView() {
        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%; box-sizing: border-box;">
                <div class="view-grid">
                    <!-- Main Checklist Card -->
                    <div class="column-main" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        
                        <!-- Date selector card -->
                        <div class="glass-card" style="padding: 0.75rem 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <h3 style="margin: 0; font-size: 1.15rem; font-weight: 500; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                                        <i data-lucide="check-square" style="color: var(--primary); width: 22px; height: 22px;"></i> Focus Tasks
                                    </h3>
                                    <span class="badge" id="tasks-count-badge" style="font-size: 0.72rem; font-weight: 700; background: var(--sidebar-active-bg); color: var(--primary); padding: 2px 8px; border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.15);">0 / 0 Done</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.25rem;">
                                    <button class="btn btn-secondary" id="btn-prev-task-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-left" style="width: 16px; height: 16px;"></i></button>
                                    <input type="date" id="tasks-date-picker" class="form-control" value="${this.selectedDate}" style="padding: 0.3rem 0.5rem; font-size: 0.85rem; width: 130px; border-radius: 16px; height: auto; text-align: center; border: 1px solid var(--border-color);">
                                    <button class="btn btn-secondary" id="btn-next-task-day" style="padding: 0.3rem 0.5rem; border: none; background: transparent;"><i data-lucide="chevron-right" style="width: 16px; height: 16px;"></i></button>
                                </div>
                            </div>
                        </div>

                        <!-- Tasks List and Input Form -->
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            
                            <!-- Add task form -->
                            <form id="new-task-form" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
                                <div style="display: flex; gap: 0.75rem;">
                                    <input type="text" id="task-input-text" class="form-control" placeholder="What is your focus right now? e.g. Buy groceries, Read 5 pages..." style="flex: 1; font-size: 0.85rem; border-radius: 20px; padding: 0.6rem 1rem;" required>
                                    <button type="button" id="btn-toggle-subtasks" class="btn btn-secondary" style="border-radius: 20px; padding: 0.6rem 1rem; font-size: 0.82rem; font-weight: 600;" title="Split into subtasks">
                                        <i data-lucide="list-plus" style="width: 16px; height: 16px;"></i> Break Down
                                    </button>
                                    <button type="submit" class="btn btn-primary" style="border-radius: 20px; padding: 0.6rem 1.25rem; font-size: 0.82rem; font-weight: 600;">
                                        <i data-lucide="plus" style="width: 16px; height: 16px;"></i> Add Focus
                                    </button>
                                </div>
                                <div id="subtasks-input-group" style="display: none; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border-color); border-radius: 12px; padding: 0.75rem; margin-top: 0.25rem;">
                                    <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); display: block; margin-bottom: 0.4rem;">
                                        Micro-steps / Subtasks (Optional — enter one per line or use commas):
                                    </label>
                                    <textarea id="task-subtasks-text" class="form-control" placeholder="e.g.&#10;Clean bedroom&#10;Clean kitchen&#10;Vacuum hallway" style="width: 100%; min-height: 80px; font-size: 0.8rem; border-radius: 8px; padding: 0.5rem; font-family: inherit; resize: vertical; background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary);"></textarea>
                                    <span style="font-size: 0.68rem; color: var(--text-muted); display: block; margin-top: 4px;">
                                        💡 Tip: Ticking each subtask completed awards +1 Coin 🪙!
                                    </span>
                                </div>
                            </form>

                            <!-- Tasks list container -->
                            <div id="tasks-list-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <!-- Dynamic task rows go here -->
                            </div>

                        </div>
                    </div>

                    <!-- Sidebar info card -->
                    <div class="column-sidebar" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        <div class="glass-card" style="padding: 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <h4 style="font-size: 0.95rem; font-weight: 500; margin-bottom: 0.75rem; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                                <i data-lucide="target" style="color: var(--primary); width: 18px; height: 18px;"></i> Carry Forward System
                            </h4>
                            <p style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.5; margin: 0 0 0.75rem 0;">
                                Uncompleted tasks will automatically carry forward to subsequent days. This prevents them from slipping through the cracks until they are checked off or deleted.
                            </p>
                            <div style="background: rgba(251, 191, 36, 0.05); border: 1px solid rgba(251, 191, 36, 0.15); border-radius: 8px; padding: 0.75rem; font-size: 0.75rem; color: #fbbf24;">
                                <span style="font-weight: 600; display: block; margin-bottom: 2px;">🪙 Earn Coins!</span>
                                Completing focus tasks awards you +1 Coin 🪙. Spend your saved coins to redeem exciting incentives in the Rewards Shop!
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
        this._refreshTasksList();
    },

    _setupListeners() {
        const picker = this.container.querySelector('#tasks-date-picker');
        picker.addEventListener('change', (e) => {
            this.selectedDate = e.target.value;
            this._refreshTasksList();
        });

        // Chevron date controls
        this.container.querySelector('#btn-prev-task-day').addEventListener('click', () => {
            const current = new Date(this.selectedDate);
            current.setDate(current.getDate() - 1);
            this.selectedDate = current.toISOString().split('T')[0];
            this.container.querySelector('#tasks-date-picker').value = this.selectedDate;
            this._refreshTasksList();
        });

        this.container.querySelector('#btn-next-task-day').addEventListener('click', () => {
            const current = new Date(this.selectedDate);
            current.setDate(current.getDate() + 1);
            this.selectedDate = current.toISOString().split('T')[0];
            this.container.querySelector('#tasks-date-picker').value = this.selectedDate;
            this._refreshTasksList();
        });

        // New task form submission
        const taskForm = this.container.querySelector('#new-task-form');
        if (taskForm) {
            const toggleBtn = this.container.querySelector('#btn-toggle-subtasks');
            const subtasksGroup = this.container.querySelector('#subtasks-input-group');
            const subtaskTextArea = this.container.querySelector('#task-subtasks-text');

            if (toggleBtn && subtasksGroup) {
                toggleBtn.addEventListener('click', () => {
                    const isHidden = subtasksGroup.style.display === 'none';
                    subtasksGroup.style.display = isHidden ? 'block' : 'none';
                    if (isHidden && subtaskTextArea) {
                        subtaskTextArea.focus();
                    }
                });
            }

            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = this.container.querySelector('#task-input-text');
                const val = input.value.trim();
                const subtasksVal = subtaskTextArea ? subtaskTextArea.value.trim() : '';

                if (val) {
                    const subtasks = [];
                    if (subtasksVal) {
                        let lines = subtasksVal.split(/\r?\n/);
                        if (lines.length === 1 && lines[0].includes(',')) {
                            lines = lines[0].split(',');
                        }
                        lines.forEach((line, idx) => {
                            const cleanLine = line.trim();
                            if (cleanLine) {
                                subtasks.push({
                                    id: 'sub_' + Date.now() + '_' + idx,
                                    text: cleanLine,
                                    completed: false
                                });
                            }
                        });
                    }

                    db.saveTask({
                        text: val,
                        date: this.selectedDate,
                        subtasks: subtasks.length > 0 ? subtasks : undefined
                    });

                    input.value = '';
                    if (subtaskTextArea) subtaskTextArea.value = '';
                    if (subtasksGroup) subtasksGroup.style.display = 'none';

                    this._refreshTasksList();
                    this._updateSidebarProgress();
                }
            });
        }
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
        const badge = this.container.querySelector('#tasks-count-badge');
        if (badge) {
            badge.innerText = `${completed} / ${tasks.length} Done`;
        }

        return tasks.map(task => {
            const hasSubtasks = task.subtasks && task.subtasks.length > 0;
            const completedSubtasksCount = hasSubtasks ? task.subtasks.filter(s => s.completed).length : 0;
            const subtaskProgressPct = hasSubtasks ? Math.round((completedSubtasksCount / task.subtasks.length) * 100) : 0;

            return `
                <div class="animate-fade-in task-item-row" data-id="${task.id}" style="display: flex; flex-direction: column; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px; padding: 0.5rem 0.75rem; transition: background 0.2s, opacity 0.5s, transform 0.5s; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <div class="task-reorder-buttons" style="display: flex; flex-direction: column; gap: 2px; margin-right: 6px; flex-shrink: 0;">
                            <button class="btn-task-up" style="background: transparent; border: none; padding: 1px; color: var(--text-muted); cursor: pointer; height: auto;" title="Move Up"><i data-lucide="chevron-up" style="width: 12px; height: 12px;"></i></button>
                            <button class="btn-task-down" style="background: transparent; border: none; padding: 1px; color: var(--text-muted); cursor: pointer; height: auto;" title="Move Down"><i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i></button>
                        </div>

                        <label class="checkbox-wrapper" style="width: 20px; height: 20px; margin-bottom: 0; flex-shrink: 0;">
                            <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}>
                            <span class="checkmark" style="width: 20px; height: 20px; border-radius: 4px; border-width: 1px;"><i data-lucide="check" style="width: 10px; height: 10px;"></i></span>
                        </label>
                        
                        <div style="flex: 1; display: flex; flex-direction: column; margin-left: 0.75rem; min-width: 0;">
                            <span class="task-text" style="font-size: 0.85rem; font-weight: 500; color: ${task.completed ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${task.completed ? 'line-through' : 'none'}; transition: color 0.2s;">
                                ${task.text}
                            </span>
                            ${hasSubtasks ? `
                                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                                    <div style="flex: 1; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                                        <div style="width: ${subtaskProgressPct}%; height: 100%; background: var(--primary); transition: width 0.3s ease;"></div>
                                    </div>
                                    <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; white-space: nowrap;">
                                        ${completedSubtasksCount} / ${task.subtasks.length} Steps (${subtaskProgressPct}%)
                                    </span>
                                </div>
                            ` : ''}
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 0.5rem;">
                            ${task.completed ? `
                                <span style="font-size: 0.65rem; font-weight: 700; color: #fbbf24; background: rgba(251,191,36,0.05); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(251,191,36,0.15);">
                                    Done 🪙
                                </span>
                            ` : ''}
                            <button class="btn-delete-task" style="background: transparent; border: none; cursor: pointer; color: var(--text-muted); padding: 2px;" title="Delete Task"><i data-lucide="trash-2" style="width: 14px; height: 14px;"></i></button>
                        </div>
                    </div>

                    ${hasSubtasks ? `
                        <div class="subtasks-container" style="display: flex; flex-direction: column; gap: 0.4rem; padding-left: 2.25rem; border-left: 1px solid var(--border-color); margin-left: 0.75rem; margin-top: 0.25rem; margin-bottom: 0.25rem;">
                            ${task.subtasks.map(subtask => `
                                <div class="subtask-row" data-sub-id="${subtask.id}" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                                    <label class="checkbox-wrapper" style="width: 16px; height: 16px; margin-bottom: 0; flex-shrink: 0;">
                                        <input type="checkbox" class="subtask-check" ${subtask.completed ? 'checked' : ''} ${task.completed ? 'disabled' : ''}>
                                        <span class="checkmark" style="width: 16px; height: 16px; border-radius: 3px; border-width: 1px;"><i data-lucide="check" style="width: 8px; height: 8px;"></i></span>
                                    </label>
                                    <span style="flex: 1; font-size: 0.78rem; color: ${subtask.completed ? 'var(--text-muted)' : 'var(--text-secondary)'}; text-decoration: ${subtask.completed ? 'line-through' : 'none'}; transition: color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        ${subtask.text}
                                    </span>
                                    ${subtask.completed ? `
                                        <span style="font-size: 0.6rem; color: #fbbf24; font-weight: 600; flex-shrink: 0; margin-left: 4px;">+1 🪙</span>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
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
            const upBtn = row.querySelector('.btn-task-up');
            const downBtn = row.querySelector('.btn-task-down');
            const subchecks = row.querySelectorAll('.subtask-check');

            if (upBtn) {
                upBtn.addEventListener('click', () => {
                    this._reorderTask(taskId, 'up');
                });
            }

            if (downBtn) {
                downBtn.addEventListener('click', () => {
                    this._reorderTask(taskId, 'down');
                });
            }
            
            if (check) {
                check.addEventListener('change', (e) => {
                    const tasks = db.getTasks();
                    const task = tasks.find(t => t.id === taskId);
                    if (task) {
                        const isChecking = e.target.checked;
                        let coinsGained = 0;

                        if (task.subtasks && task.subtasks.length > 0) {
                            task.subtasks.forEach(s => {
                                if (isChecking && !s.completed) {
                                    s.completed = true;
                                    coinsGained++;
                                } else if (!isChecking && s.completed) {
                                    s.completed = false;
                                    coinsGained--;
                                }
                            });
                        } else {
                            coinsGained = isChecking ? 1 : -1;
                        }

                        task.completed = isChecking;
                        db.saveTask(task);
                        db.addCoins(coinsGained);
                        
                        if (task.completed) {
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

            subchecks.forEach(subcheck => {
                subcheck.addEventListener('change', (e) => {
                    const subRow = subcheck.closest('.subtask-row');
                    const subId = subRow.getAttribute('data-sub-id');
                    const tasks = db.getTasks();
                    const task = tasks.find(t => t.id === taskId);
                    if (task && task.subtasks) {
                        const subtask = task.subtasks.find(s => s.id === subId);
                        if (subtask) {
                            const isChecking = e.target.checked;
                            subtask.completed = isChecking;

                            db.addCoins(isChecking ? 1 : -1);
                            if (isChecking) {
                                this._playConfetti();
                            }

                            const allCompleted = task.subtasks.every(s => s.completed);
                            if (allCompleted) {
                                task.completed = true;
                                db.saveTask(task);

                                row.style.opacity = '0.5';
                                row.style.transform = 'translateX(10px)';
                                row.style.pointerEvents = 'none';

                                setTimeout(() => {
                                    db.deleteTask(taskId);
                                    this._refreshTasksList();
                                    this._updateSidebarProgress();
                                }, 1000);
                            } else {
                                db.saveTask(task);
                                this._refreshTasksList();
                                this._updateSidebarProgress();
                            }
                        }
                    }
                });
            });

            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    db.deleteTask(taskId);
                    this._refreshTasksList();
                    this._updateSidebarProgress();
                });
            }
        });
    },

    _reorderTask(taskId, direction) {
        const tasks = db.getTasks();
        const visibleTasks = tasks.filter(t => {
            if (!t.completed) {
                return t.date <= this.selectedDate;
            } else {
                return t.date === this.selectedDate;
            }
        });

        const index = visibleTasks.findIndex(t => t.id === taskId);
        if (index === -1) return;

        let targetIndex = -1;
        if (direction === 'up' && index > 0) {
            targetIndex = index - 1;
        } else if (direction === 'down' && index < visibleTasks.length - 1) {
            targetIndex = index + 1;
        }

        if (targetIndex !== -1) {
            const currentTask = visibleTasks[index];
            const targetTask = visibleTasks[targetIndex];

            const globalCurrentIndex = db.tasks.findIndex(t => t.id === currentTask.id);
            const globalTargetIndex = db.tasks.findIndex(t => t.id === targetTask.id);

            if (globalCurrentIndex !== -1 && globalTargetIndex !== -1) {
                const temp = db.tasks[globalCurrentIndex];
                db.tasks[globalCurrentIndex] = db.tasks[globalTargetIndex];
                db.tasks[globalTargetIndex] = temp;

                db._save('tasks', db.tasks);
                this._refreshTasksList();
            }
        }
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
                particleCount: 50,
                spread: 45,
                origin: { y: 0.75, x: 0.5 },
                colors: ['#6366f1', '#a855f7', '#10b981']
            });
        }
    }
};

// =========================================================================
// 4c. DEDICATED REWARDS SHOP VIEW COMPONENT [NEW]
// =========================================================================
const Rewards = {
    container: null,

    render(container) {
        this.container = container;
        this.updateView();
    },

    updateView() {
        const blueprints = db.getBlueprints();
        const coins = blueprints.coins || 0;
        const rewardsList = blueprints.customRewards || [];
        const redeemedList = blueprints.redeemedRewards || [];

        // Build list of rewards cards HTML
        const rewardsCardsHtml = rewardsList.map(r => {
            const canRedeem = coins >= r.cost;
            const btnClass = canRedeem ? 'btn-primary' : 'btn-secondary';
            const btnStyle = canRedeem 
                ? 'background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: #000; border: none; font-weight: 700;' 
                : 'opacity: 0.4; cursor: not-allowed;';

            return `
                <div class="glass-card reward-item-card" style="display: flex; flex-direction: column; justify-content: space-between; padding: 1.25rem; border-radius: var(--radius-md); transition: transform 0.2s, box-shadow 0.2s; position: relative;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 8px; padding: 0.5rem; display: flex; align-items: center; justify-content: center; color: #fbbf24;">
                            <i data-lucide="${r.icon || 'gift'}" style="width: 20px; height: 20px;"></i>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
                            <span style="font-size: 0.9rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.name}">${r.name}</span>
                            <span style="font-size: 0.78rem; font-weight: 700; color: #fbbf24; display: flex; align-items: center; gap: 4px;">
                                🪙 ${r.cost} Coins
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; gap: 8px;">
                        <button class="btn btn-delete-reward" data-id="${r.id}" style="padding: 0.3rem 0.5rem; font-size: 0.7rem; border-color: rgba(239, 68, 68, 0.15); color: #ef4444; background: transparent;" title="Remove Reward">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button class="btn ${btnClass} btn-redeem-reward" data-id="${r.id}" style="padding: 0.4rem 1rem; font-size: 0.78rem; border-radius: var(--radius-sm); flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px; ${btnStyle}" ${!canRedeem ? 'disabled' : ''}>
                            <i data-lucide="sparkles" style="width: 12px; height: 12px;"></i> Redeem
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Build redemption history HTML (last 10 redemptions)
        const sortedRedemptions = [...redeemedList].sort((a,b) => b.timestamp - a.timestamp);
        const redemptionsHtml = sortedRedemptions.length > 0
            ? sortedRedemptions.slice(0, 10).map(item => {
                const timeStr = this.formatTimeAgo(item.timestamp);
                const isAward = item.cost < 0;
                return `
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; padding: 0.5rem 0; border-bottom: 1px dashed var(--border-color);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.1rem;">${isAward ? '🪙' : '🎉'}</span>
                            <div style="display: flex; flex-direction: column;">
                                <span style="font-weight: 600; color: var(--text-primary);">${item.name}</span>
                                <span style="font-size: 0.68rem; color: var(--text-muted);">${timeStr}</span>
                            </div>
                        </div>
                        <span style="font-size: 0.75rem; font-weight: 700; color: ${isAward ? '#b8f064' : '#ef4444'};">
                            ${isAward ? '+' : '-'}🪙 ${Math.abs(item.cost)}
                        </span>
                    </div>
                `;
            }).join('')
            : `<div style="font-size: 0.78rem; color: var(--text-muted); text-align: center; font-style: italic; padding: 1rem 0;">No rewards redeemed yet. Complete routines to earn coins!</div>`;

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%;">
                
                <!-- Page Header & Stats Row -->
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; align-items: stretch; flex-wrap: wrap;">
                    
                    <!-- Welcome Card with instructions -->
                    <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); display: flex; flex-direction: column; justify-content: center;">
                        <h2 style="font-size: 1.35rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="gift" style="color: #fbbf24;"></i> Rewards Shop
                        </h2>
                        <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin: 0;">
                            Turn your consistency into motivation! Earn coins by checking off habits (+1 coin), completing all routines in a section (+3 bonus), logging sleep (+2), and finishing focus tasks (+1). Spend your coins here to redeem fun rewards.
                        </p>
                    </div>

                    <!-- Large Coin Balance Card -->
                    <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(251, 191, 36, 0.02) 100%); border: 1px solid rgba(251, 191, 36, 0.15);">
                        <span style="font-size: 2.2rem; margin-bottom: 4px; display: inline-block; animation: float 3s ease-in-out infinite;">🪙</span>
                        <h3 id="shop-coin-balance" style="font-size: 1.85rem; font-weight: 900; color: #fbbf24; margin: 0; text-shadow: 0 0 15px rgba(251, 191, 36, 0.3);">${coins}</h3>
                        <p style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.05em;">Current Balance</p>
                    </div>
                </div>

                <div class="view-grid">
                    <!-- Left: Rewards Catalog -->
                    <div class="column-main" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        
                        <!-- Catalog Header & Grid -->
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <h3 class="card-title" style="font-size: 1.1rem; font-weight: 500; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="shopping-bag" style="color: var(--primary); width: 18px; height: 18px;"></i> Available Rewards
                            </h3>

                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem;">
                                ${rewardsList.length > 0 ? rewardsCardsHtml : `
                                    <div style="grid-column: span -1; text-align: center; padding: 2rem; color: var(--text-secondary); border: 1px dashed var(--border-color); border-radius: var(--radius-md); font-size: 0.8rem; font-style: italic;">
                                        No rewards defined. Add a custom reward below!
                                    </div>
                                `}
                            </div>
                        </div>

                        <!-- Add Custom Reward Card -->
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <h3 class="card-title" style="font-size: 1.1rem; font-weight: 500; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="plus-circle" style="color: var(--primary); width: 18px; height: 18px;"></i> Add Custom Reward
                            </h3>
                            
                            <form id="new-reward-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
                                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.85rem; flex-wrap: wrap;">
                                    <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Reward Title / Activity</label>
                                        <input type="text" id="reward-name-input" class="form-control" placeholder="e.g. Order Pizza, Go to movies, Sleep in..." style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" required>
                                    </div>
                                    <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Coin Cost</label>
                                        <input type="number" id="reward-cost-input" class="form-control" min="1" max="1000" value="10" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" required>
                                    </div>
                                    <div class="form-group" style="margin-bottom: 0; gap: 4px;">
                                        <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">Choose Icon</label>
                                        <select id="reward-icon-select" class="form-control" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" required>
                                            <option value="gift" selected>🎁 Gift</option>
                                            <option value="tv">📺 TV / Show</option>
                                            <option value="gamepad-2">🎮 Game</option>
                                            <option value="pizza">🍕 Pizza / Meal</option>
                                            <option value="coffee">☕ Coffee</option>
                                            <option value="cookie">🍪 Treat</option>
                                            <option value="shopping-cart">🛒 Shop</option>
                                            <option value="moon">😴 Sleep</option>
                                            <option value="smartphone">📱 Phone</option>
                                            <option value="book">📖 Read</option>
                                            <option value="heart">💖 Self-care</option>
                                            <option value="sparkles">✨ Sparkles</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-primary" style="align-self: flex-end; padding: 0.45rem 1.25rem; font-size: 0.8rem; border-radius: 12px; font-weight: 600;"><i data-lucide="plus"></i> Add Reward</button>
                            </form>
                        </div>
                    </div>

                    <!-- Right: Redemption History -->
                    <div class="column-sidebar" style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        
                        <div class="glass-card" style="padding: 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
                                <h4 style="font-size: 1rem; font-weight: 500; display: flex; align-items: center; gap: 6px; margin: 0; color: var(--text-primary);">
                                    <i data-lucide="history" style="color: var(--primary); width: 18px; height: 18px;"></i> Redemption History
                                </h4>
                                ${sortedRedemptions.length > 0 ? `
                                    <button id="btn-clear-redemptions" style="background: transparent; border: none; font-size: 0.68rem; color: var(--text-muted); cursor: pointer; font-weight: 600; padding: 0;">Clear</button>
                                ` : ''}
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                ${redemptionsHtml}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Toast Success Popup -->
                <div id="shop-toast" class="glass-card animate-slide-up" style="position: fixed; bottom: 2rem; right: 2rem; background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%); color: #000; padding: 0.75rem 1.5rem; border-radius: var(--radius-sm); box-shadow: 0 10px 25px rgba(245, 158, 11, 0.3); z-index: 10000; border: none; display: none;">
                    <div style="display: flex; align-items: center; gap: 8px; font-weight: 700;">
                        <i data-lucide="party-popper" style="width: 20px; height: 20px;"></i>
                        <span id="shop-toast-msg">Reward Redeemed! Enjoy! 🎉</span>
                    </div>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
    },

    _setupListeners() {
        // Form submission for adding custom rewards
        const form = this.container.querySelector('#new-reward-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = this.container.querySelector('#reward-name-input').value.trim();
                const cost = parseInt(this.container.querySelector('#reward-cost-input').value);
                const icon = this.container.querySelector('#reward-icon-select').value;

                if (name && cost > 0) {
                    const blueprints = db.getBlueprints();
                    const list = blueprints.customRewards || [];
                    const newReward = {
                        id: 'r_' + Date.now(),
                        name: name,
                        cost: cost,
                        icon: icon,
                        system: false
                    };
                    list.push(newReward);
                    blueprints.customRewards = list;
                    db.saveBlueprints(blueprints);
                    this.updateView();
                    
                    // Reset inputs
                    this.container.querySelector('#reward-name-input').value = '';
                    this.container.querySelector('#reward-cost-input').value = 10;
                    this.container.querySelector('#reward-icon-select').value = 'gift';
                }
            });
        }

        // Redeem button clicks
        const redeemBtns = this.container.querySelectorAll('.btn-redeem-reward');
        redeemBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const blueprints = db.getBlueprints();
                const reward = blueprints.customRewards.find(r => r.id === id);

                if (reward && (blueprints.coins || 0) >= reward.cost) {
                    // Deduct coins
                    db.addCoins(-reward.cost);

                    // Add redemption history log (refetch to get updated coins)
                    const updatedBlueprints = db.getBlueprints();
                    const redeemed = updatedBlueprints.redeemedRewards || [];
                    redeemed.push({
                        id: 'red_' + Date.now(),
                        rewardId: reward.id,
                        name: reward.name,
                        cost: reward.cost,
                        timestamp: Date.now()
                    });
                    updatedBlueprints.redeemedRewards = redeemed;
                    db.saveBlueprints(updatedBlueprints);

                    // Confetti and notification
                    this._playConfetti();
                    this._showToast(`Redeemed: ${reward.name}! 🎉`);

                    // Re-render
                    this.updateView();
                }
            });
        });

        // Delete reward button clicks
        const deleteBtns = this.container.querySelectorAll('.btn-delete-reward');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this reward?")) {
                    const blueprints = db.getBlueprints();
                    blueprints.customRewards = (blueprints.customRewards || []).filter(r => r.id !== id);
                    db.saveBlueprints(blueprints);
                    this.updateView();
                }
            });
        });

        // Clear redemption history
        const clearBtn = this.container.querySelector('#btn-clear-redemptions');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm("Clear your redemption history log?")) {
                    const blueprints = db.getBlueprints();
                    blueprints.redeemedRewards = [];
                    db.saveBlueprints(blueprints);
                    this.updateView();
                }
            });
        }
    },

    _playConfetti() {
        if (window.confetti) {
            window.confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#fbbf24', '#f59e0b', '#d97706', '#6366f1', '#a855f7']
            });
        }
    },

    _showToast(msg) {
        const toast = this.container.querySelector('#shop-toast');
        const span = this.container.querySelector('#shop-toast-msg');
        if (toast && span) {
            span.innerText = msg;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
    },

    formatTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
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
            <div class="animate-fade-in" style="width: 100%; box-sizing: border-box;">
                <div class="glass-card" style="margin-bottom: 1.5rem; background: var(--grad-glow); border-color: rgba(26, 115, 232, 0.05); border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                    <h3 style="font-size: 1.15rem; font-weight: 500; color: var(--primary); display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="award"></i> Atomic Blueprint
                    </h3>
                    <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin-top: 0.4rem;">
                        Define who you want to become, then forge habits that prove that identity every day.
                    </p>
                </div>

                <div class="view-grid">
                    <!-- Left: Identity Pillars -->
                    <div class="column-half" style="grid-column: span 6; display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        <div class="glass-card" style="padding: 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <h3 class="card-title" style="margin-bottom: 0.4rem; font-weight: 500;">
                                <i data-lucide="fingerprint" style="color: var(--primary);"></i> Identity Pillars
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1.25rem; font-size: 0.78rem;">Define who you want to become and the daily proof.</p>

                            <form id="identity-form" style="display: flex; flex-direction: column; gap: 0.75rem; background: var(--bg-primary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 1.25rem;">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem;">I want to become...</label>
                                    <input type="text" id="identity-title-input" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" placeholder="e.g. Prolific writer, healthy athlete" required>
                                </div>
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem;">Daily proof action:</label>
                                    <input type="text" id="identity-action-input" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" placeholder="e.g. Writing 100 words daily" required>
                                </div>
                                <button type="submit" class="btn btn-primary" style="align-self: flex-end; padding: 0.4rem 1rem; font-size: 0.78rem; border-radius: 12px;"><i data-lucide="plus"></i> Add Pillar</button>
                            </form>

                            <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.6rem; color: var(--text-secondary);">Your Pillars</h4>
                            <div id="identities-container" style="display: flex; flex-direction: column; gap: 0.6rem;">
                                ${this._renderIdentitiesList(blueprints.identities)}
                            </div>
                        </div>
                    </div>

                    <!-- Right: Forge & Link a New Habit -->
                    <div class="column-half" style="grid-column: span 6; display: flex; flex-direction: column; gap: 1.5rem; width: 100%; box-sizing: border-box;">
                        <div class="glass-card" style="padding: 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                            <h3 class="card-title" style="margin-bottom: 0.4rem; font-weight: 500;">
                                <i data-lucide="sparkles" style="color: var(--primary); width: 18px; height: 18px;"></i> Forge a New Habit
                            </h3>
                            <p class="card-subtitle" style="margin-bottom: 1rem; font-size: 0.78rem;">Create a habit linked to an identity pillar with all 4 Atomic Laws.</p>

                            <form id="new-habit-form" style="display: flex; flex-direction: column; gap: 1rem; background: var(--bg-primary); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="activity" style="width: 13px; height: 13px; color: var(--primary);"></i> Habit Name
                                    </label>
                                    <input type="text" id="new-habit-name" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" placeholder="e.g. Read 5 pages" required>
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="fingerprint" style="width: 13px; height: 13px; color: var(--primary);"></i> Identity Pillar
                                    </label>
                                    <select id="new-habit-identity" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" required>
                                        ${blueprints.identities.map(id => `<option value="${id.title}">${id.title}</option>`).join('') || '<option value="">(Create an Identity Pillar first!)</option>'}
                                    </select>
                                </div>

                                <div style="display: flex; gap: 0.75rem;">
                                    <div class="form-group" style="flex: 1; margin-bottom: 0;">
                                        <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="palette" style="width: 13px; height: 13px; color: var(--primary);"></i> Color
                                        </label>
                                        <div id="color-picker-row" style="display: flex; gap: 8px; padding: 6px 0; flex-wrap: wrap;">
                                            <button type="button" class="color-pick-btn active" data-color="health" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--primary); background: #b8f064; cursor: pointer; transition: all 0.15s;" title="Health"></button>
                                            <button type="button" class="color-pick-btn" data-color="mind" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; background: #64b0f0; cursor: pointer; transition: all 0.15s;" title="Mind"></button>
                                            <button type="button" class="color-pick-btn" data-color="career" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; background: #a78bfa; cursor: pointer; transition: all 0.15s;" title="Career"></button>
                                            <button type="button" class="color-pick-btn" data-color="other" style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; background: #f5b942; cursor: pointer; transition: all 0.15s;" title="General"></button>
                                        </div>
                                        <span id="color-legend-label" style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500; display: block; margin-top: 4px;">Active: Health (Green)</span>
                                        <input type="hidden" id="new-habit-category" value="health">
                                    </div>

                                    <div class="form-group" style="flex: 1; margin-bottom: 0;">
                                        <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="clock" style="width: 13px; height: 13px; color: var(--primary);"></i> Timing
                                        </label>
                                        <select id="new-habit-time" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                                            <option value="morning">🌅 Morning</option>
                                            <option value="daytime">☀️ Daytime</option>
                                            <option value="evening">🌙 Evening</option>
                                            <option value="night">🌃 Night</option>
                                        </select>
                                    </div>
                                </div>

                                <div style="display: flex; gap: 0.75rem;">
                                    <div class="form-group" style="flex: 1; margin-bottom: 0;">
                                        <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="calendar" style="width: 13px; height: 13px; color: var(--primary);"></i> Frequency
                                        </label>
                                        <select id="new-habit-frequency" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                                            <option value="daily">Everyday</option>
                                            <option value="weekdays">Weekdays (Mon-Fri)</option>
                                            <option value="weekends">Weekends (Sat-Sun)</option>
                                            <option value="weekly">Weekly</option>
                                        </select>
                                    </div>
                                    <div class="form-group" id="new-habit-weekly-day-group" style="flex: 1; margin-bottom: 0; display: none;">
                                        <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                            <i data-lucide="calendar-days" style="width: 13px; height: 13px; color: var(--primary);"></i> On Day
                                        </label>
                                        <select id="new-habit-weekly-day" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;">
                                            <option value="0">Sunday</option>
                                            <option value="1">Monday</option>
                                            <option value="2">Tuesday</option>
                                            <option value="3">Wednesday</option>
                                            <option value="4">Thursday</option>
                                            <option value="5">Friday</option>
                                            <option value="6">Saturday</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="layers" style="width: 13px; height: 13px; color: var(--color-warning);"></i> Habit Stack Trigger
                                    </label>
                                    <input type="text" id="new-habit-trigger" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" placeholder="After I step out of bed..." required>
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="eye" style="width: 13px; height: 13px; color: var(--color-info);"></i> Obvious Cue
                                    </label>
                                    <input type="text" id="new-habit-cue" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" placeholder="Clean towel on counter" required>
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="zap" style="width: 13px; height: 13px; color: var(--color-success);"></i> 2-Minute Version (Optional)
                                    </label>
                                    <input type="text" id="new-habit-twomin" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" placeholder="Leave blank if already < 2m (e.g. drink water)">
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="gift" style="width: 13px; height: 13px; color: var(--primary);"></i> Immediate Reward
                                    </label>
                                    <input type="text" id="new-habit-reward" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem;" placeholder="Feeling fresh and clean" required>
                                </div>

                                <div class="form-group" style="margin-bottom: 0;">
                                    <label style="font-size: 0.78rem; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="list-todo" style="width: 13px; height: 13px; color: var(--primary);"></i> Sub-actions / Checklist (Optional, one per line)
                                    </label>
                                    <textarea id="new-habit-subactions" class="form-control" style="font-size: 0.82rem; padding: 0.45rem 0.65rem; height: 60px; resize: vertical;" placeholder="e.g. Supplement A&#10;Supplement B"></textarea>
                                </div>

                                <button type="submit" class="btn btn-primary" style="align-self: flex-end; padding: 0.5rem 1.25rem; font-size: 0.82rem; border-radius: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                                    <i data-lucide="plus-circle" style="width: 15px; height: 15px;"></i> Forge Habit
                                </button>
                            </form>
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

    _setupListeners() {
        // Identity Pillar form
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

        // Color Picker
        const colorBtns = this.container.querySelectorAll('.color-pick-btn');
        const categoryInput = this.container.querySelector('#new-habit-category');
        const colorLegend = this.container.querySelector('#color-legend-label');
        const colorNames = { health: 'Health (Green)', mind: 'Mind (Blue)', career: 'Career (Purple)', other: 'General (Orange)' };
        colorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorBtns.forEach(b => {
                    b.style.borderColor = 'transparent';
                    b.classList.remove('active');
                });
                btn.style.borderColor = 'var(--primary)';
                btn.classList.add('active');
                const cat = btn.getAttribute('data-color');
                categoryInput.value = cat;
                if (colorLegend) colorLegend.innerText = `Active: ${colorNames[cat]}`;
            });
        });

        // Forge Habit Form
        const newForm = this.container.querySelector('#new-habit-form');
        if (newForm) {
            const freqSelect = this.container.querySelector('#new-habit-frequency');
            const weeklyDayGroup = this.container.querySelector('#new-habit-weekly-day-group');
            if (freqSelect && weeklyDayGroup) {
                freqSelect.addEventListener('change', (e) => {
                    if (e.target.value === 'weekly') {
                        weeklyDayGroup.style.display = 'block';
                    } else {
                        weeklyDayGroup.style.display = 'none';
                    }
                });
            }

            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const subactionsText = this.container.querySelector('#new-habit-subactions').value.trim();
                const createdHabit = {
                    name: this.container.querySelector('#new-habit-name').value.trim(),
                    category: this.container.querySelector('#new-habit-category').value,
                    timeOfDay: this.container.querySelector('#new-habit-time').value,
                    identity: this.container.querySelector('#new-habit-identity').value,
                    twoMinuteVersion: this.container.querySelector('#new-habit-twomin').value.trim(),
                    stackTrigger: this.container.querySelector('#new-habit-trigger').value.trim(),
                    cue: this.container.querySelector('#new-habit-cue').value.trim(),
                    reward: this.container.querySelector('#new-habit-reward').value.trim(),
                    frequency: this.container.querySelector('#new-habit-frequency').value,
                    weeklyDay: parseInt(this.container.querySelector('#new-habit-weekly-day').value),
                    subactions: subactionsText ? subactionsText.split('\n').map(s => s.trim()).filter(Boolean) : []
                };
                db.saveHabit(createdHabit);
                newForm.reset();
                if (weeklyDayGroup) weeklyDayGroup.style.display = 'none';
                // Reset color picker to first option
                colorBtns.forEach(b => { b.style.borderColor = 'transparent'; b.classList.remove('active'); });
                if (colorBtns[0]) { colorBtns[0].style.borderColor = 'var(--primary)'; colorBtns[0].classList.add('active'); }
                categoryInput.value = 'health';
                if (colorLegend) colorLegend.innerText = `Active: Health (Green)`;
                this.updateView();
                
                if (window.globalAppInstance) {
                    window.globalAppInstance.updateSidebarStats();
                }
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
        let sleepQualityCount = 0;
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
                
                if (log.sleepQuality && log.sleepQuality > 0) {
                    sleepQualitySum += log.sleepQuality;
                    sleepQualityCount++;
                }
                
                const isGoodSleep = duration >= 7.0 && (log.sleepQuality && log.sleepQuality >= 3);
                const completionsCount = log.completions 
                    ? Object.keys(log.completions).filter(hId => habits.some(h => h.id === hId) && log.completions[hId].completed).length 
                    : 0;
                
                const logTime = new Date(dateStr).getTime() + (24 * 60 * 60 * 1000);
                const activeHabitsOnDate = habits.filter(h => h.createdAt <= logTime && isHabitActiveOnDate(h, dateStr));
                
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
        const avgSleepQuality = sleepQualityCount > 0 ? Math.round((sleepQualitySum / sleepQualityCount) * 10) / 10 : 0;
        
        const goodSleepRate = goodSleepPossible > 0 ? Math.round((goodSleepCompletions / goodSleepPossible) * 100) : 0;
        const lowSleepRate = lowSleepPossible > 0 ? Math.round((lowSleepCompletions / lowSleepPossible) * 100) : 0;

        // 2. IDENTITY PILLARS PERFORMANCE MATH
        const identityStats = blueprints.identities.map(idObj => {
            let possible = 0;
            let completed = 0;
            const idHabits = habits.filter(h => h.identity === idObj.title);
            
            Object.keys(logs).forEach(dateStr => {
                const logDate = new Date(dateStr).getTime() + (24 * 60 * 60 * 1000);
                const activeIdHabits = idHabits.filter(h => h.createdAt <= logDate && isHabitActiveOnDate(h, dateStr));
                
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

        // 3. TIME-OF-DAY ROUTINE BREAKDOWN (Morning, Daytime, Evening, Night)
        let morningPossible = 0;
        let morningCompleted = 0;
        let daytimePossible = 0;
        let daytimeCompleted = 0;
        let eveningPossible = 0;
        let eveningCompleted = 0;
        let nightPossible = 0;
        let nightCompleted = 0;

        Object.keys(logs).forEach(dateStr => {
            const logDate = new Date(dateStr).getTime() + (24 * 60 * 60 * 1000);
            const activeMorning = habits.filter(h => h.timeOfDay === 'morning' && h.createdAt <= logDate);
            const activeDaytime = habits.filter(h => h.timeOfDay === 'daytime' && h.createdAt <= logDate);
            const activeEvening = habits.filter(h => h.timeOfDay === 'evening' && h.createdAt <= logDate);
            const activeNight = habits.filter(h => h.timeOfDay === 'night' && h.createdAt <= logDate);
            
            morningPossible += activeMorning.length;
            daytimePossible += activeDaytime.length;
            eveningPossible += activeEvening.length;
            nightPossible += activeNight.length;
            
            if (logs[dateStr].completions) {
                activeMorning.forEach(h => {
                    if (logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                        morningCompleted++;
                    }
                });
                activeDaytime.forEach(h => {
                    if (logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                        daytimeCompleted++;
                    }
                });
                activeEvening.forEach(h => {
                    if (logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                        eveningCompleted++;
                    }
                });
                activeNight.forEach(h => {
                    if (logs[dateStr].completions[h.id] && logs[dateStr].completions[h.id].completed) {
                        nightCompleted++;
                    }
                });
            }
        });

        const morningRate = morningPossible > 0 ? Math.round((morningCompleted / morningPossible) * 100) : 0;
        const daytimeRate = daytimePossible > 0 ? Math.round((daytimeCompleted / daytimePossible) * 100) : 0;
        const eveningRate = eveningPossible > 0 ? Math.round((eveningCompleted / eveningPossible) * 100) : 0;
        const nightRate = nightPossible > 0 ? Math.round((nightCompleted / nightPossible) * 100) : 0;

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
            <div class="animate-fade-in" style="width: 100%; box-sizing: border-box;">
                <div class="view-grid" style="margin-bottom: 2rem;">
                    <div class="glass-card column-quarter" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: var(--sidebar-active-bg); display: flex; align-items: center; justify-content: center; color: var(--primary); border: 1px solid var(--border-color); flex-shrink: 0;">
                            <i data-lucide="percent" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; line-height: 1.2;">Global Consistency</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px; line-height: 1.1;">${stats.consistencyScore}%</h3>
                        </div>
                    </div>

                    <div class="glass-card column-quarter" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(30, 142, 62, 0.08); display: flex; align-items: center; justify-content: center; color: var(--color-success); border: 1px solid rgba(30, 142, 62, 0.15); flex-shrink: 0;">
                            <i data-lucide="check-circle-2" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; line-height: 1.2;">Total Habits Met</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px; line-height: 1.1;">${stats.totalCheckoffs}</h3>
                        </div>
                    </div>

                    <div class="glass-card column-quarter" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(227, 116, 0, 0.08); display: flex; align-items: center; justify-content: center; color: var(--color-warning); border: 1px solid rgba(227, 116, 0, 0.15); flex-shrink: 0;">
                            <i data-lucide="flame" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; line-height: 1.2;">Longest Streak</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px; line-height: 1.1;">${stats.longestStreakGlobal} <span style="font-size: 0.78rem; font-weight: 500; color: var(--text-secondary);">days</span></h3>
                        </div>
                    </div>

                    <div class="glass-card column-quarter" style="grid-column: span 3; display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                        <div style="width: 40px; height: 40px; border-radius: 8px; background: var(--sidebar-active-bg); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--primary); flex-shrink: 0;">
                            <i data-lucide="clock" style="width: 18px; height: 18px;"></i>
                        </div>
                        <div>
                            <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; line-height: 1.2;">2-Min Micro Wins</span>
                            <h3 style="font-size: 1.4rem; font-weight: 700; margin-top: 1px; line-height: 1.1;">${stats.twoMinRuleCount}</h3>
                        </div>
                    </div>
                </div>

                <div class="glass-card" style="margin-bottom: 2rem; padding: 1.25rem 1.5rem; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                    <div class="card-header-flex" style="margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
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
                    <div class="glass-card column-main" style="grid-column: span 8; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
                        <h3 class="card-title" style="margin-bottom: 1.25rem; font-weight: 500;">
                            <i data-lucide="trending-up" style="color: var(--primary);"></i> Habits & Wellbeing Correlation
                        </h3>
                        <div style="position: relative; height: 300px; width: 100%;">
                            <canvas id="correlationChart"></canvas>
                        </div>
                    </div>

                    <div class="glass-card column-sidebar" style="grid-column: span 4; border-radius: var(--radius-md); width: 100%; box-sizing: border-box;">
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
                    <div class="glass-card column-half" style="grid-column: span 6; border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; width: 100%; box-sizing: border-box;">
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
                    <div class="glass-card column-half" style="grid-column: span 6; border-radius: var(--radius-md); padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; width: 100%; box-sizing: border-box;">
                        <h3 class="card-title" style="font-weight: 500; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="fingerprint" style="color: var(--color-warning);"></i> Identity Pillars & Timing Analysis
                        </h3>
                        <p class="card-subtitle" style="font-size: 0.8rem; margin-bottom: 0.25rem;">Percentage of proofs fulfilled for your Identity and success by home timing.</p>

                        <!-- Identity Pillars visual progress -->
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <span style="font-size: 0.7rem; flex-shrink: 0; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Identity Verification Scores:</span>
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
                            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                                <div style="flex: 1; min-width: 100px;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
                                        <span>🌅 Morning</span>
                                        <strong>${morningRate}%</strong>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${morningRate}%; height: 100%; background: #f5b942; border-radius: 4px;"></div>
                                    </div>
                                </div>
                                <div style="flex: 1; min-width: 100px;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
                                        <span>☀️ Daytime</span>
                                        <strong>${daytimeRate}%</strong>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${daytimeRate}%; height: 100%; background: #64b0f0; border-radius: 4px;"></div>
                                    </div>
                                </div>
                                <div style="flex: 1; min-width: 100px;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
                                        <span>🌙 Evening</span>
                                        <strong>${eveningRate}%</strong>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${eveningRate}%; height: 100%; background: #a855f7; border-radius: 4px;"></div>
                                    </div>
                                </div>
                                <div style="flex: 1; min-width: 100px;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; margin-bottom: 2px;">
                                        <span>🌃 Night</span>
                                        <strong>${nightRate}%</strong>
                                    </div>
                                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${nightRate}%; height: 100%; background: #22c55e; border-radius: 4px;"></div>
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
                            const timingTag = hs.habit.timeOfDay === 'morning' 
                                ? '🌅 Morning' 
                                : (hs.habit.timeOfDay === 'daytime' ? '☀️ Daytime' : (hs.habit.timeOfDay === 'night' ? '🌃 Night' : '🌙 Evening'));
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
                                        ${hs.habit.twoMinuteVersion ? `
                                            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden; display: flex;">
                                                <div style="width: ${hs.possible > 0 ? Math.round(((hs.completed - hs.twoMinCount) / hs.possible) * 100) : 0}%; height: 100%; background: linear-gradient(90deg, var(--primary), #b8f064); border-radius: 4px 0 0 4px;" title="Full completions: ${hs.completed - hs.twoMinCount} days"></div>
                                                <div style="width: ${hs.possible > 0 ? Math.round((hs.twoMinCount / hs.possible) * 100) : 0}%; height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8); border-radius: ${(hs.completed - hs.twoMinCount) === 0 ? '4px' : '0'} 4px 4px ${(hs.completed - hs.twoMinCount) === 0 ? '4px' : '0'};" title="2-Min saves: ${hs.twoMinCount} days"></div>
                                            </div>
                                            <div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted); margin-top: 1px; font-weight: 500;">
                                                <span>💪 Full: ${hs.completed - hs.twoMinCount}d (${hs.possible > 0 ? Math.round(((hs.completed - hs.twoMinCount) / hs.possible) * 100) : 0}%)</span>
                                                <span>⚡ 2-Min: ${hs.twoMinCount}d (${hs.possible > 0 ? Math.round((hs.twoMinCount / hs.possible) * 100) : 0}%)</span>
                                            </div>
                                        ` : `
                                            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                                                <div style="width: ${hs.rate}%; height: 100%; background: linear-gradient(90deg, var(--primary), #b8f064); border-radius: 4px;"></div>
                                            </div>
                                        `}
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

            const activeHabitsOnDate = habits.filter(h => h.createdAt <= (d.getTime() + 24 * 60 * 60 * 1000) && isHabitActiveOnDate(h, dateStr));
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
                    labels: ['Health', 'Mind', 'Career', 'Relations'],
                    datasets: [{
                        data: [
                            completionsByCat.health || 0,
                            completionsByCat.mind || 0,
                            completionsByCat.career || 0,
                            completionsByCat.relations || 0
                        ],
                        backgroundColor: ['#1e8e3e', '#1a73e8', '#e37400', '#a855f7'],
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
        const lastSyncTime = settings.lastSyncTime ? new Date(settings.lastSyncTime).toLocaleString() : 'Never';
        const habitCount = db.getHabits().length;
        const logCount = Object.keys(db.logs).length;

        this.container.innerHTML = `
            <div class="animate-fade-in" style="width: 100%; box-sizing: border-box; max-width: 600px; margin: 0 auto;">

                <!-- Profile & Appearance — compact inline -->
                <div class="glass-card" style="padding: 1rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 180px;">
                            <i data-lucide="user" style="width: 16px; height: 16px; color: var(--primary); flex-shrink: 0;"></i>
                            <input type="text" id="username-input" class="form-control" value="${settings.userName}" style="flex: 1; border-radius: 8px; font-size: 0.85rem; padding: 0.4rem 0.65rem;" placeholder="Display name">
                            <button class="btn btn-primary" id="btn-save-username" style="padding: 0.4rem 0.85rem; border-radius: 8px; font-size: 0.78rem; white-space: nowrap;">Save</button>
                        </div>
                        <div class="theme-switch-btn" style="flex-shrink: 0;">
                            <button class="theme-btn ${settings.theme === 'light' ? 'active' : ''}" id="btn-theme-light" title="Light"><i data-lucide="sun"></i></button>
                            <button class="theme-btn ${settings.theme === 'dark' ? 'active' : ''}" id="btn-theme-dark" title="Dark"><i data-lucide="moon"></i></button>
                        </div>
                    </div>
                </div>

                <!-- Google Sheets Cloud Sync -->
                <div class="glass-card" style="padding: 1rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
                    <h3 class="card-title" style="font-weight: 500; margin-bottom: 0.75rem; font-size: 1rem;">
                        <i data-lucide="share-2" style="color: var(--primary); width: 18px; height: 18px;"></i> Google Sheets Sync
                    </h3>

                    <div style="display: flex; flex-direction: column; gap: 0.75rem; background: var(--bg-primary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.75rem; font-weight: 600;">Web App URL</label>
                            <input type="text" id="sheets-url-input" class="form-control" style="border-radius: 8px; font-size: 0.82rem; padding: 0.4rem 0.65rem;" value="${settings.sheetsUrl || ''}" placeholder="https://script.google.com/macros/s/.../exec">
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <label class="checkbox-wrapper" style="width: auto; height: auto; display: flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">
                                    <input type="checkbox" id="auto-sync-checkbox" ${settings.autoSync ? 'checked' : ''}>
                                    <span class="checkmark" style="width: 16px; height: 16px; border-radius: 4px; border-width: 1px;"><i data-lucide="check" style="width: 9px; height: 9px;"></i></span>
                                    <span>Auto-sync on actions</span>
                                </label>
                                <span id="sync-conn-badge" class="badge" style="background: rgba(128, 128, 128, 0.1); color: var(--text-muted); border: 1px solid rgba(128, 128, 128, 0.15); padding: 2px 8px; border-radius: 12px; font-size: 0.68rem; font-weight: 700;">
                                    Not Tested
                                </span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                                <label class="checkbox-wrapper" style="width: auto; height: auto; display: flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary);">
                                    <input type="checkbox" id="proxy-sync-checkbox" ${settings.useNetlifyProxy ? 'checked' : ''}>
                                    <span class="checkmark" style="width: 16px; height: 16px; border-radius: 4px; border-width: 1px;"><i data-lucide="check" style="width: 9px; height: 9px;"></i></span>
                                    <span>Route sync through Netlify Proxy</span>
                                </label>
                            </div>
                        </div>

                        <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                            <i data-lucide="clock" style="width: 11px; height: 11px;"></i>
                            Last synced: <span id="last-sync-time">${lastSyncTime}</span>
                        </div>

                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button class="btn btn-secondary" id="btn-test-sync" style="font-size: 0.78rem; padding: 0.4rem 0.75rem; border-radius: 10px; flex: 1; min-width: 80px;"><i data-lucide="activity" style="width: 13px; height: 13px;"></i> Test</button>
                            <button class="btn btn-secondary" id="btn-pull-sync" style="font-size: 0.78rem; padding: 0.4rem 0.75rem; border-radius: 10px; flex: 1; min-width: 80px;"><i data-lucide="arrow-down-to-line" style="width: 13px; height: 13px;"></i> Pull</button>
                            <button class="btn btn-primary" id="btn-push-sync" style="font-size: 0.78rem; padding: 0.4rem 0.75rem; border-radius: 10px; flex: 1; min-width: 80px;"><i data-lucide="arrow-up-from-line" style="width: 13px; height: 13px;"></i> Push</button>
                        </div>

                        <div style="font-size: 0.68rem; color: var(--text-muted); background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.5rem 0.65rem; line-height: 1.5;">
                            <strong>Pull</strong> = Download cloud → replace local &nbsp;|&nbsp; <strong>Push</strong> = Upload local → overwrite cloud<br>
                            Local: <strong>${habitCount}</strong> habits, <strong>${logCount}</strong> daily logs.
                        </div>
                    </div>
                </div>

                <!-- App Security Lock -->
                <div class="glass-card" style="padding: 1rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
                    <h3 class="card-title" style="font-weight: 500; margin-bottom: 0.75rem; font-size: 1rem;">
                        <i data-lucide="shield-alert" style="color: var(--primary); width: 18px; height: 18px;"></i> App Security Lock
                    </h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem; background: var(--bg-primary); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                        ${settings.passwordHash ? `
                            <!-- Password enabled state -->
                            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <span style="font-size: 0.8rem; color: #137333; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                        <i data-lucide="shield-check" style="width: 15px; height: 15px;"></i> Password Lock Active
                                    </span>
                                    <button class="btn btn-secondary" id="btn-disable-lock" style="font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 6px;">Disable</button>
                                </div>
                                
                                <div class="form-group" style="margin-bottom: 0; margin-top: 0.25rem;">
                                    <label style="font-size: 0.75rem; font-weight: 600;">Auto-Lock Timeout</label>
                                    <select id="lock-timeout-select" class="form-control" style="border-radius: 8px; font-size: 0.82rem; padding: 0.4rem 0.65rem; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color);">
                                        <option value="0" ${settings.lockTimeout == 0 ? 'selected' : ''}>Never auto-lock</option>
                                        <option value="1" ${settings.lockTimeout == 1 ? 'selected' : ''}>1 minute</option>
                                        <option value="5" ${settings.lockTimeout == 5 ? 'selected' : ''}>5 minutes</option>
                                        <option value="15" ${settings.lockTimeout == 15 ? 'selected' : ''}>15 minutes</option>
                                        <option value="30" ${settings.lockTimeout == 30 ? 'selected' : ''}>30 minutes</option>
                                    </select>
                                </div>
                            </div>
                        ` : `
                            <!-- Password disabled state -->
                            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                                <span style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4;">
                                    Secure your habits and reflections. Enable password protection to lock the app on load and inactivity.
                                </span>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.25rem;">
                                    <div class="form-group" style="margin-bottom: 0;">
                                        <input type="password" id="new-password" class="form-control" style="border-radius: 8px; font-size: 0.82rem; padding: 0.4rem 0.65rem;" placeholder="Set password">
                                    </div>
                                    <div class="form-group" style="margin-bottom: 0;">
                                        <input type="password" id="confirm-password" class="form-control" style="border-radius: 8px; font-size: 0.82rem; padding: 0.4rem 0.65rem;" placeholder="Confirm password">
                                    </div>
                                </div>
                                <button class="btn btn-primary" id="btn-enable-lock" style="font-size: 0.78rem; padding: 0.45rem 0.75rem; border-radius: 8px; width: 100%;">Enable Password Lock</button>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Collapsible: Setup Guide -->
                <div class="glass-card" style="padding: 0; border-radius: var(--radius-md); margin-bottom: 0.75rem; overflow: hidden;">
                    <button id="toggle-setup-guide" style="width: 100%; background: transparent; border: none; padding: 0.75rem 1.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: var(--text-primary);">
                        <span style="font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="help-circle" style="width: 15px; height: 15px; color: var(--primary);"></i> Setup Guide (first time only)
                        </span>
                        <i data-lucide="chevron-down" id="setup-guide-chevron" style="width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.2s;"></i>
                    </button>
                    <div id="setup-guide-content" style="display: none; padding: 0 1.25rem 1rem;">
                        <div class="setup-guide" style="margin-top: 0;">
                            <div class="step-card" style="border-radius: 8px;">
                                <div class="step-num">1</div>
                                <div class="step-body">
                                    <h5>Create a Google Spreadsheet</h5>
                                    <p>Go to Google Drive, create a blank spreadsheet named <strong>"My Habits Log"</strong>.</p>
                                </div>
                            </div>
                            <div class="step-card" style="border-radius: 8px;">
                                <div class="step-num">2</div>
                                <div class="step-body">
                                    <h5>Open Apps Script Editor</h5>
                                    <p><strong>Extensions</strong> &rarr; <strong>Apps Script</strong>. Clear existing code.</p>
                                </div>
                            </div>
                            <div class="step-card" style="flex-direction: column; gap: 0.5rem; border-radius: 8px;">
                                <div style="display: flex; gap: 1rem;">
                                    <div class="step-num">3</div>
                                    <div class="step-body">
                                        <h5>Paste Sync Code</h5>
                                        <p>Copy the code below and paste it into the editor.</p>
                                    </div>
                                </div>
                                <div class="code-snippet-box">
                                    <button class="btn-copy" id="btn-copy-code"><i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy</button>
                                    <pre style="max-height: 200px; overflow-y: auto;"><code id="script-code-content">// AtomicFlow Google Apps Script V5
function doGet(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dbSheet = ss.getSheetByName("Database");
    if (!dbSheet) { var sheets = ss.getSheets(); dbSheet = sheets.length > 0 ? sheets[0] : ss.insertSheet("Database"); }
    if (action === 'test') { output.setContent(JSON.stringify({ status: 'ok' })); return output; }
    if (action === 'pull') {
      var rawData = dbSheet.getRange(1, 1).getValue();
      var data = {};
      try { data = rawData ? JSON.parse(rawData) : { habits: [], logs: {}, blueprints: { identities: [], stacks: [] }, tasks: [] }; } catch(err) { data = { habits: [], logs: {}, blueprints: { identities: [], stacks: [] }, tasks: [] }; }
      output.setContent(JSON.stringify(data)); return output;
    }
    output.setContent(JSON.stringify({ error: 'Invalid action' })); return output;
  } catch (err) { output.setContent(JSON.stringify({ error: err.toString(), status: 'error' })); return output; }
}

function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var postData = JSON.parse(e.postData.contents);
    if (postData.action === 'push') {
      var d = { habits: postData.habits||[], logs: postData.logs||{}, blueprints: postData.blueprints||{identities:[],stacks:[]}, tasks: postData.tasks||[], updatedAt: Date.now() };
      var dbSheet = ss.getSheetByName("Database") || ss.insertSheet("Database");
      dbSheet.getRange(1,1).setValue(JSON.stringify(d));
      var hS = ss.getSheetByName("Habits") || ss.insertSheet("Habits"); hS.clear();
      hS.appendRow(["ID","Name","Category","Time","Identity","Cue","Reward","2-Min","Stack Trigger","Active"]);
      hS.getRange(1,1,1,10).setFontWeight("bold").setBackground("#e8f0fe");
      if(d.habits.length>0){var hD=d.habits.map(function(h){return[h.id||"",h.name||"",h.category||"",h.timeOfDay||"",h.identity||"",h.cue||"",h.reward||"",h.twoMinuteVersion||"",h.stackTrigger||"",h.active!==false?"Yes":"No"]});hS.getRange(2,1,hD.length,10).setValues(hD)}
      var tS = ss.getSheetByName("Tasks") || ss.insertSheet("Tasks"); tS.clear();
      tS.appendRow(["ID","Text","Done","Active","Date"]);tS.getRange(1,1,1,5).setFontWeight("bold").setBackground("#e8f0fe");
      if(d.tasks.length>0){var tD=d.tasks.map(function(t){return[t.id||"",t.text||"",t.completed?"Yes":"No",t.active!==false?"Yes":"No",t.date||""]});tS.getRange(2,1,tD.length,5).setValues(tD)}
      var jS = ss.getSheetByName("Journal Logs") || ss.insertSheet("Journal Logs"); jS.clear();
      jS.appendRow(["Date","Mood","Energy","Bedtime","Wakeup","Sleep Quality","Wins","Routines","Hard Parts","Anxiety Parking Lot","Improvement","Notes","Updated At"]);
      jS.getRange(1,1,1,13).setFontWeight("bold").setBackground("#e8f0fe");
      var lD=Object.keys(d.logs).sort().reverse();
      if(lD.length>0){var jD=lD.map(function(dt){var l=d.logs[dt];var cN=[];if(l.completions){Object.keys(l.completions).forEach(function(hId){if(l.completions[hId]&&l.completions[hId].completed){var name=hId;for(var i=0;i<d.habits.length;i++){if(d.habits[i].id===hId){name=d.habits[i].name;break;}}cN.push(name)}})}return[dt,l.mood||"",l.energy||"",l.sleepBedtime||"",l.sleepWakeup||"",l.sleepQuality||"",l.wins?l.wins.join(", "):"",cN.join(", "),l.hard||"",l.anxiety||"",l.improvement||"",l.journalNotes||"",l.updatedAt?new Date(l.updatedAt).toLocaleString():""]});jS.getRange(2,1,jD.length,13).setValues(jD)}
      output.setContent(JSON.stringify({ status: 'success' })); return output;
    }
    output.setContent(JSON.stringify({ error: 'Invalid action' })); return output;
  } catch (err) { output.setContent(JSON.stringify({ error: err.toString(), status: 'error' })); return output; }
}</code></pre>
                                </div>
                            </div>
                            <div class="step-card" style="border-radius: 8px;">
                                <div class="step-num">4</div>
                                <div class="step-body">
                                    <h5>Deploy Web App</h5>
                                    <p><strong>Deploy</strong> &rarr; <strong>New deployment</strong> &rarr; Web app. Execute as: "Me", access: "Anyone".</p>
                                </div>
                            </div>
                            <div class="step-card" style="border-radius: 8px;">
                                <div class="step-num">5</div>
                                <div class="step-body">
                                    <h5>Connect</h5>
                                    <p>Authorize, copy the Web App URL, paste above, click <strong>Test</strong>.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Collapsible: Advanced (Export/Import) -->
                <div class="glass-card" style="padding: 0; border-radius: var(--radius-md); margin-bottom: 0.75rem; overflow: hidden;">
                    <button id="toggle-advanced" style="width: 100%; background: transparent; border: none; padding: 0.75rem 1.25rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; color: var(--text-primary);">
                        <span style="font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i data-lucide="database" style="width: 15px; height: 15px; color: var(--text-muted);"></i> Advanced (Export / Import)
                        </span>
                        <i data-lucide="chevron-down" id="advanced-chevron" style="width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.2s;"></i>
                    </button>
                    <div id="advanced-content" style="display: none; padding: 0 1.25rem 1rem;">
                        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                            <button class="btn btn-secondary" id="btn-export-db" style="justify-content: flex-start; width: 100%; border-radius: 8px; font-size: 0.82rem; padding: 0.45rem 0.85rem;"><i data-lucide="download" style="width: 14px; height: 14px;"></i> Export Database (JSON)</button>
                            
                            <div style="display: flex; flex-direction: column; gap: 0.4rem; background: var(--bg-primary); padding: 0.65rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                                <label style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary);">Import Database String</label>
                                <textarea id="import-json-string" class="form-control" style="font-size: 0.72rem; font-family: monospace; min-height: 40px; border-radius: 8px;" placeholder="Paste exported JSON here..."></textarea>
                                <button class="btn btn-primary" id="btn-import-db" style="font-size: 0.72rem; padding: 0.35rem 0.85rem; align-self: flex-end; border-radius: 8px;"><i data-lucide="upload-cloud" style="width: 12px; height: 12px;"></i> Import</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Toast -->
            <div id="settings-toast" class="glass-card animate-slide-up" style="position: fixed; bottom: 2rem; right: 2rem; background: var(--grad-primary); color: #ffffff; padding: 0.65rem 1.25rem; border-radius: var(--radius-sm); box-shadow: var(--glass-shadow); z-index: 10000; border: none; display: none;">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 0.85rem;">
                    <i data-lucide="check" style="width: 16px; height: 16px;"></i>
                    <span id="settings-toast-msg">Settings saved!</span>
                </div>
            </div>
        `;

        lucide.createIcons();
        this._setupListeners();
    },

    _setupListeners() {
        // Save username
        this.container.querySelector('#btn-save-username').addEventListener('click', () => {
            const name = this.container.querySelector('#username-input').value.trim();
            if (name) {
                db.saveSettings({ userName: name });
                const welcomeTitle = document.querySelector('.welcome-msg h1');
                if (welcomeTitle) {
                    const hr = new Date().getHours();
                    let greet = 'Good morning';
                    if (hr >= 10 && hr < 17) greet = 'Good afternoon';
                    else if (hr >= 17 && hr < 21) greet = 'Good evening';
                    else if (hr >= 21 || hr < 5) greet = 'Good night';
                    welcomeTitle.innerHTML = `${greet}, <span class="text-gradient">${name}</span>!`;
                }
                this._showToast("Username updated!");
            }
        });

        // Theme
        this.container.querySelector('#btn-theme-light').addEventListener('click', () => this._toggleTheme('light'));
        this.container.querySelector('#btn-theme-dark').addEventListener('click', () => this._toggleTheme('dark'));

        // Copy script code
        this.container.querySelector('#btn-copy-code').addEventListener('click', () => {
            const code = this.container.querySelector('#script-code-content').innerText;
            navigator.clipboard.writeText(code).then(() => this._showToast("Code copied!"));
        });

        // Collapsible toggles
        this._setupCollapsible('toggle-setup-guide', 'setup-guide-content', 'setup-guide-chevron');
        this._setupCollapsible('toggle-advanced', 'advanced-content', 'advanced-chevron');

        // Export DB
        this.container.querySelector('#btn-export-db').addEventListener('click', () => {
            const fullDb = { habits: db.habits, logs: db.logs, blueprints: db.blueprints, settings: db.settings, tasks: db.tasks };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullDb, null, 2));
            const dlAnchor = document.createElement('a');
            dlAnchor.setAttribute("href", dataStr);
            dlAnchor.setAttribute("download", `atomicflow_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(dlAnchor);
            dlAnchor.click();
            dlAnchor.remove();
        });

        // Import DB
        this.container.querySelector('#btn-import-db').addEventListener('click', () => {
            const jsonText = this.container.querySelector('#import-json-string').value.trim();
            if (!jsonText) return alert("Please paste database string.");
            try {
                const imported = JSON.parse(jsonText);
                if (imported.habits && imported.logs && imported.blueprints) {
                    if (!confirm(`Import will replace local data with ${imported.habits.length} habits and ${Object.keys(imported.logs).length} logs. Continue?`)) return;
                    db.habits = imported.habits;
                    db.logs = imported.logs;
                    db.blueprints = imported.blueprints;
                    db._save('habits', db.habits);
                    db._save('logs', db.logs);
                    db._save('blueprints', db.blueprints);
                    if (imported.tasks) {
                        db.tasks = imported.tasks;
                        db._save('tasks', db.tasks);
                    }
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

        // Test connection
        this.container.querySelector('#btn-test-sync').addEventListener('click', async () => {
            const url = this.container.querySelector('#sheets-url-input').value.trim();
            if (!url) return alert("Enter URL.");
            const btn = this.container.querySelector('#btn-test-sync');
            btn.innerHTML = `<i data-lucide="loader" class="animate-pulse"></i> ...`;
            lucide.createIcons();
            try {
                const ok = await db.testSheetsConnection(url);
                if (ok) {
                    db.saveSettings({ sheetsUrl: url });
                    this._updateConnectionBadge(true);
                    this._showToast("Connected! Fetching cloud data...");
                    
                    // Pull and overwrite immediately to prevent overwriting cloud data!
                    await db.pullFromGoogleSheets(true);
                    this._showToast("Connected & Sync Complete! Reloading...");
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    this._updateConnectionBadge(false);
                    alert("Invalid sheets script response.");
                }
            } catch (e) {
                this._updateConnectionBadge(false);
                alert("Connection failed! Make sure script is deployed for Anyone.");
            } finally {
                btn.innerHTML = `<i data-lucide="activity" style="width:13px;height:13px;"></i> Test`;
                lucide.createIcons();
            }
        });

        // PULL with confirmation
        this.container.querySelector('#btn-pull-sync').addEventListener('click', async () => {
            const settings = db.getSettings();
            if (!settings.sheetsUrl) return alert("Configure sync sheet first.");
            if (!confirm("PULL will download cloud data and REPLACE all your local data.\n\nYour current local habits & logs will be overwritten.\nContinue?")) return;

            const btn = this.container.querySelector('#btn-pull-sync');
            btn.innerHTML = `<i data-lucide="loader"></i> Pulling...`;
            lucide.createIcons();
            try {
                const ok = await db.pullFromGoogleSheets(true);
                if (ok) {
                    db.saveSettings({ lastSyncTime: Date.now() });
                    alert("Cloud data synchronized! Reloading...");
                    window.location.reload();
                }
            } catch (e) {
                alert("Sync pull failed: " + e.message);
            } finally {
                btn.innerHTML = `<i data-lucide="arrow-down-to-line" style="width:13px;height:13px;"></i> Pull`;
                lucide.createIcons();
            }
        });

        // PUSH with confirmation
        this.container.querySelector('#btn-push-sync').addEventListener('click', async () => {
            const settings = db.getSettings();
            if (!settings.sheetsUrl) return alert("Configure sync sheet first.");
            const hCount = db.getHabits().length;
            const lCount = Object.keys(db.logs).length;
            if (!confirm(`PUSH will OVERWRITE your Google Sheet with local data.\n\nUploading: ${hCount} habits, ${lCount} daily logs.\n\nThis replaces everything on the sheet. Continue?`)) return;

            const btn = this.container.querySelector('#btn-push-sync');
            btn.innerHTML = `<i data-lucide="loader"></i> Pushing...`;
            lucide.createIcons();
            try {
                const ok = await db.pushToGoogleSheets();
                if (ok) {
                    db.saveSettings({ lastSyncTime: Date.now() });
                    const timeSpan = this.container.querySelector('#last-sync-time');
                    if (timeSpan) timeSpan.textContent = new Date().toLocaleString();
                    this._showToast("Spreadsheet backup completed!");
                }
            } catch (e) {
                alert("Sync push failed: " + e.message);
            } finally {
                btn.innerHTML = `<i data-lucide="arrow-up-from-line" style="width:13px;height:13px;"></i> Push`;
                lucide.createIcons();
            }
        });

        // Auto-sync toggle
        this.container.querySelector('#auto-sync-checkbox').addEventListener('change', (e) => {
            db.saveSettings({ autoSync: e.target.checked });
            this._showToast("Auto-sync preferences saved.");
        });

        // Proxy toggle checkbox listener
        const proxyCheckbox = this.container.querySelector('#proxy-sync-checkbox');
        if (proxyCheckbox) {
            proxyCheckbox.addEventListener('change', (e) => {
                db.saveSettings({ useNetlifyProxy: e.target.checked });
                this._showToast(e.target.checked ? "Routing sync through Netlify Proxy." : "Routing sync directly to Google.");
            });
        }

        // Enable Password Lock
        const btnEnable = this.container.querySelector('#btn-enable-lock');
        if (btnEnable) {
            btnEnable.addEventListener('click', async () => {
                const newPwd = this.container.querySelector('#new-password').value.trim();
                const confPwd = this.container.querySelector('#confirm-password').value.trim();
                if (!newPwd || !confPwd) {
                    return alert("Please enter and confirm your password.");
                }
                if (newPwd !== confPwd) {
                    return alert("Passwords do not match.");
                }
                const hash = await hashPassword(newPwd);
                db.saveSettings({ passwordHash: hash });
                this.updateView();
                this._showToast("Password lock enabled!");
                
                // Show quick lock button
                const btnLock = document.getElementById('btn-quick-lock');
                if (btnLock) btnLock.style.display = 'flex';
            });
        }

        // Disable Password Lock
        const btnDisable = this.container.querySelector('#btn-disable-lock');
        if (btnDisable) {
            btnDisable.addEventListener('click', async () => {
                const pwd = prompt("Enter current password to disable lock:");
                if (pwd === null) return;
                const enteredHash = await hashPassword(pwd.trim());
                if (enteredHash === db.settings.passwordHash) {
                    db.saveSettings({ passwordHash: '', lockTimeout: 0 });
                    this.updateView();
                    this._showToast("Password lock disabled.");
                    
                    // Hide quick lock button
                    const btnLock = document.getElementById('btn-quick-lock');
                    if (btnLock) btnLock.style.display = 'none';
                } else {
                    alert("Incorrect password.");
                }
            });
        }

        // Auto-Lock Timeout select
        const timeoutSelect = this.container.querySelector('#lock-timeout-select');
        if (timeoutSelect) {
            timeoutSelect.addEventListener('change', (e) => {
                const mins = parseInt(e.target.value);
                db.saveSettings({ lockTimeout: mins });
                this._showToast(`Auto-lock timeout updated.`);
                if (window.globalAppInstance) {
                    window.globalAppInstance.setupInactivityTimer();
                }
            });
        }
    },

    _setupCollapsible(toggleId, contentId, chevronId) {
        const toggle = this.container.querySelector('#' + toggleId);
        const content = this.container.querySelector('#' + contentId);
        const chevron = this.container.querySelector('#' + chevronId);
        if (toggle && content) {
            toggle.addEventListener('click', () => {
                const isOpen = content.style.display !== 'none';
                content.style.display = isOpen ? 'none' : 'block';
                if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
            });
        }
    },

    _toggleTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        db.saveSettings({ theme });
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'light' ? '#f5f4f0' : '#0d0d0f');
        }
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
            tasks: FocusTasks,
            journal: Journal,
            rewards: Rewards,
            blueprint: Blueprint,
            analytics: Analytics,
            settings: Settings
        };
        this.isLocked = !!db.settings.passwordHash;
        this.idleTimer = null;
        this.lastAutoPullTime = 0;
    }

    async init() {
        window.globalAppInstance = this;
        this.applyTheme();
        this.bindGlobalListeners();
        this.renderGlobalUI();
        
        if (this.isLocked) {
            this.showLockScreen();
        } else {
            this.route();
            this.setupInactivityTimer();
            this.runBackgroundSync();
            this.applyPunishments();
        }
    }

    async runBackgroundSync() {
        const settings = db.getSettings();
        if (settings.sheetsUrl) {
            const now = Date.now();
            if (now - this.lastAutoPullTime < 60000) {
                console.log("[AtomicFlow Sync] Throttling auto-pull. Last pull was less than 60s ago.");
                return;
            }
            this.lastAutoPullTime = now;
            try {
                console.log("[AtomicFlow Sync] Running background cloud pull...");
                const ok = await db.pullFromGoogleSheets();
                if (ok) {
                    console.log("[AtomicFlow Sync] Background startup pull successful! Re-rendering view...");
                    this.renderGlobalUI();
                    this.route();
                }
            } catch (e) {
                console.error("[AtomicFlow Sync] Background startup pull failed:", e);
            }
        }
    }

    applyPunishments() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // 1. Ensure we only run the check once per day locally on this device session
        const settings = db.getSettings();
        settings.punishmentCheckedDates = settings.punishmentCheckedDates || {};
        if (settings.punishmentCheckedDates[yesterdayStr]) return;

        // Mark as checked immediately
        settings.punishmentCheckedDates[yesterdayStr] = true;
        db.saveSettings(settings);

        // 2. Check if user has any habits (so we know it's not a fresh install)
        const habits = db.getHabits();
        if (habits.length === 0) return;

        // Check the earliest habit creation date to avoid punishing them on their first day
        const earliestHabit = habits.reduce((earliest, h) => {
            const hTime = h.createdAt || 0;
            return (hTime > 0 && hTime < earliest) ? hTime : earliest;
        }, Date.now());
        
        // If they created their first habit today or yesterday, don't punish yesterday's lack of logging
        const firstDayThreshold = yesterday.getTime();
        if (earliestHabit > firstDayThreshold) return;

        const log = db.logs[yesterdayStr];
        const blueprints = db.getBlueprints();
        blueprints.redeemedRewards = blueprints.redeemedRewards || [];

        // Check if already punished via cloud synced logs to prevent duplicate penalties
        const alreadyPunishedNoLog = blueprints.redeemedRewards.some(r => r.rewardId === 'system_punishment' && r.punishDate === yesterdayStr && r.id.includes('nolog'));
        const alreadyPunishedSleep = blueprints.redeemedRewards.some(r => r.rewardId === 'system_punishment' && r.punishDate === yesterdayStr && r.id.includes('sleep'));

        // 3. Rule: "Not open/log anything in the app yesterday" (-10 coins)
        const loggedAnything = log && (
            (log.mood !== undefined && log.mood > 0) || 
            (log.journalNotes && log.journalNotes.trim().length > 0) ||
            (log.completions && Object.keys(log.completions).some(hId => log.completions[hId].completed))
        );

        if (!loggedAnything && !alreadyPunishedNoLog) {
            console.log(`[Punishment] User did not log anything yesterday (${yesterdayStr}). Deducting -10 coins.`);
            db.addCoins(-10);
            
            // Log this as a system transaction
            blueprints.redeemedRewards.push({
                id: 'punish_nolog_' + Date.now(),
                rewardId: 'system_punishment',
                name: `Punishment: Forgot to log yesterday (${yesterdayStr})`,
                cost: 10, // positive cost represents deduction
                timestamp: Date.now(),
                punishDate: yesterdayStr
            });
            db.saveBlueprints(blueprints);
            
            setTimeout(() => {
                toast("Deducted -10 Coins: Forgot to log yesterday 💀", "#ea4335", "#fff");
            }, 1500);
            return; // If they didn't log anything, they also didn't log sleep, so we don't double punish
        }

        // 4. Rule: "Slept less than 8 hours yesterday" (-5 coins)
        if (log && log.sleepBedtime && log.sleepWakeup && !alreadyPunishedSleep) {
            const duration = AtomicManager.calculateSleepDuration(log.sleepBedtime, log.sleepWakeup);
            if (duration > 0 && duration < 8.0) {
                console.log(`[Punishment] Sleep yesterday (${yesterdayStr}) was only ${duration.toFixed(1)} hrs. Deducting -5 coins.`);
                db.addCoins(-5);
                
                blueprints.redeemedRewards.push({
                    id: 'punish_sleep_' + Date.now(),
                    rewardId: 'system_punishment',
                    name: `Punishment: Slept ${duration.toFixed(1)} hrs yesterday (Target: 8h)`,
                    cost: 5,
                    timestamp: Date.now(),
                    punishDate: yesterdayStr
                });
                db.saveBlueprints(blueprints);
                
                setTimeout(() => {
                    toast(`Deducted -5 Coins: Slept ${duration.toFixed(1)}h yesterday 😴`, "#ea4335", "#fff");
                }, 1500);
            }
        }
    }

    setupInactivityTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        const settings = db.getSettings();
        const timeoutMins = parseInt(settings.lockTimeout || 0);
        if (timeoutMins <= 0 || this.isLocked) return;

        const timeoutMs = timeoutMins * 60 * 1000;
        this.idleTimer = setTimeout(() => {
            console.log(`[AtomicFlow] Lock due to inactivity (${timeoutMins} min).`);
            this.lock();
        }, timeoutMs);
        
        localStorage.setItem('atomicflow_last_activity', Date.now().toString());
    }

    resetInactivityTimer() {
        if (this.isLocked) return;
        this.setupInactivityTimer();
    }

    checkInactivityOnFocus() {
        if (this.isLocked) return;
        const settings = db.getSettings();
        const timeoutMins = parseInt(settings.lockTimeout || 0);
        if (timeoutMins <= 0) return;

        const lastActivityStr = localStorage.getItem('atomicflow_last_activity');
        if (lastActivityStr) {
            const lastActivity = parseInt(lastActivityStr);
            const elapsedMs = Date.now() - lastActivity;
            const timeoutMs = timeoutMins * 60 * 1000;
            if (elapsedMs >= timeoutMs) {
                console.log("[AtomicFlow] Lock due to elapsed inactivity on tab reactivation.");
                this.lock();
            } else {
                if (this.idleTimer) clearTimeout(this.idleTimer);
                this.idleTimer = setTimeout(() => this.lock(), timeoutMs - elapsedMs);
            }
        }
    }

    lock() {
        if (this.isLocked) return;
        this.isLocked = true;
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.showLockScreen();
    }

    unlock() {
        this.isLocked = false;
        this.hideLockScreen();
        this.route();
        this.setupInactivityTimer();
        this.runBackgroundSync();
        this.applyPunishments();
    }

    showLockScreen() {
        const wrapper = document.querySelector('.app-wrapper');
        if (wrapper) {
            wrapper.style.filter = 'blur(20px)';
            wrapper.style.pointerEvents = 'none';
        }

        let lockOverlay = document.getElementById('app-lock-screen');
        if (lockOverlay) lockOverlay.remove();

        lockOverlay = document.createElement('div');
        lockOverlay.id = 'app-lock-screen';
        lockOverlay.className = 'animate-fade-in';
        lockOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: radial-gradient(circle at center, rgba(20, 20, 25, 0.96) 0%, rgba(10, 10, 12, 0.99) 100%);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: var(--font-family);
            padding: 2rem;
            box-sizing: border-box;
        `;

        lockOverlay.innerHTML = `
            <div class="lock-card" style="
                max-width: 380px;
                width: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 1.5rem;
                text-align: center;
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: var(--radius-lg);
                padding: 2.25rem 1.75rem;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(10px);
                position: relative;
            ">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                    <div style="
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        background: var(--grad-primary);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 0 20px rgba(184, 240, 100, 0.3);
                        margin-bottom: 0.25rem;
                    ">
                        <i data-lucide="lock" style="width: 20px; height: 20px; color: #ffffff;"></i>
                    </div>
                    <h2 style="font-size: 1.35rem; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 6px;">
                        AtomicFlow
                    </h2>
                    <span style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">
                        App Locked
                    </span>
                </div>

                <div style="width: 100%; display: flex; flex-direction: column; gap: 0.5rem;">
                    <input type="password" id="lock-input" placeholder="Enter password" style="
                        width: 100%;
                        background: rgba(255, 255, 255, 0.05);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: var(--radius-sm);
                        color: #ffffff;
                        padding: 0.65rem 1rem;
                        font-size: 0.95rem;
                        text-align: center;
                        outline: none;
                        transition: border-color 0.2s, box-shadow 0.2s;
                        box-sizing: border-box;
                    ">
                    <div id="lock-error" style="color: #ff5252; font-size: 0.72rem; font-weight: 600; height: 14px; display: none;">
                        Incorrect password
                    </div>
                </div>

                <div class="lock-numpad" style="
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.6rem;
                    width: 100%;
                    max-width: 280px;
                ">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `
                        <button class="numpad-btn" data-val="${n}" style="
                            background: rgba(255, 255, 255, 0.03);
                            border: 1px solid rgba(255, 255, 255, 0.05);
                            border-radius: 50%;
                            width: 54px;
                            height: 54px;
                            color: #ffffff;
                            font-size: 1.25rem;
                            font-weight: 500;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            justify-self: center;
                            outline: none;
                            transition: background 0.2s, transform 0.1s;
                        ">${n}</button>
                    `).join('')}
                    <button class="numpad-btn numpad-clear" style="
                        background: transparent;
                        border: none;
                        width: 54px;
                        height: 54px;
                        color: var(--text-muted);
                        font-size: 0.78rem;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        justify-self: center;
                        outline: none;
                    ">Clear</button>
                    <button class="numpad-btn" data-val="0" style="
                        background: rgba(255, 255, 255, 0.03);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        border-radius: 50%;
                        width: 54px;
                        height: 54px;
                        color: #ffffff;
                        font-size: 1.25rem;
                        font-weight: 500;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        justify-self: center;
                        outline: none;
                        transition: background 0.2s, transform 0.1s;
                    ">0</button>
                    <button class="numpad-btn numpad-back" style="
                        background: transparent;
                        border: none;
                        width: 54px;
                        height: 54px;
                        color: var(--text-muted);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        justify-self: center;
                        outline: none;
                    "><i data-lucide="delete" style="width: 18px; height: 18px;"></i></button>
                </div>

                <button id="btn-unlock" class="btn btn-primary" style="
                    width: 100%;
                    padding: 0.65rem;
                    border-radius: var(--radius-sm);
                    font-size: 0.88rem;
                    font-weight: 600;
                    margin-top: 0.25rem;
                ">Unlock Application</button>
            </div>
        `;

        document.body.appendChild(lockOverlay);
        lucide.createIcons();

        const input = lockOverlay.querySelector('#lock-input');
        if (window.innerWidth > 768) {
            setTimeout(() => input.focus(), 100);
        }

        const numpadBtns = lockOverlay.querySelectorAll('.numpad-btn[data-val]');
        numpadBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                input.value += btn.getAttribute('data-val');
                input.dispatchEvent(new Event('input'));
            });
            btn.addEventListener('mousedown', () => btn.style.transform = 'scale(0.92)');
            btn.addEventListener('mouseup', () => btn.style.transform = '');
            btn.addEventListener('touchstart', () => btn.style.transform = 'scale(0.92)');
            btn.addEventListener('touchend', () => btn.style.transform = '');
        });

        lockOverlay.querySelector('.numpad-clear').addEventListener('click', () => {
            input.value = '';
            input.dispatchEvent(new Event('input'));
        });

        lockOverlay.querySelector('.numpad-back').addEventListener('click', () => {
            input.value = input.value.slice(0, -1);
            input.dispatchEvent(new Event('input'));
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleUnlockAttempt();
            }
        });

        lockOverlay.querySelector('#btn-unlock').addEventListener('click', () => {
            this.handleUnlockAttempt();
        });
    }

    async handleUnlockAttempt() {
        const overlay = document.getElementById('app-lock-screen');
        if (!overlay) return;

        const input = overlay.querySelector('#lock-input');
        const errorDiv = overlay.querySelector('#lock-error');
        const card = overlay.querySelector('.lock-card');
        const password = input.value;

        const enteredHash = await hashPassword(password);
        if (enteredHash === db.settings.passwordHash) {
            this.unlock();
        } else {
            card.classList.add('shake-anim');
            errorDiv.style.display = 'block';
            input.value = '';
            setTimeout(() => {
                card.classList.remove('shake-anim');
            }, 500);
        }
    }

    hideLockScreen() {
        const lockOverlay = document.getElementById('app-lock-screen');
        if (lockOverlay) {
            lockOverlay.classList.add('animate-fade-out');
            setTimeout(() => {
                lockOverlay.remove();
            }, 300);
        }

        const wrapper = document.querySelector('.app-wrapper');
        if (wrapper) {
            wrapper.style.filter = '';
            wrapper.style.pointerEvents = '';
        }
    }

    applyTheme() {
        const settings = db.getSettings();
        const theme = settings.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', theme === 'light' ? '#f5f4f0' : '#0d0d0f');
        }
    }

    bindGlobalListeners() {
        window.addEventListener('hashchange', () => this.route());

        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isLocked) return;
                const view = link.getAttribute('data-view');
                window.location.hash = `#${view}`;
            });
        });

        const quickLockBtn = document.getElementById('btn-quick-lock');
        if (quickLockBtn) {
            quickLockBtn.addEventListener('click', () => {
                this.lock();
            });
        }

        const activityEvents = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        activityEvents.forEach(evt => {
            window.addEventListener(evt, () => this.resetInactivityTimer(), { passive: true });
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkInactivityOnFocus();
            }
        });

        const coinCard = document.getElementById('sidebar-coin-container');
        if (coinCard) {
            coinCard.addEventListener('click', () => {
                if (this.isLocked) return;
                window.location.hash = '#rewards';
            });
        }
    }

    renderGlobalUI() {
        const settings = db.getSettings();
        
        const welcomeTitle = document.querySelector('.welcome-msg h1');
        if (welcomeTitle) {
            const hr = new Date().getHours();
            let greeting = 'Good morning';
            if (hr >= 10 && hr < 17) greeting = 'Good afternoon';
            else if (hr >= 17 && hr < 21) greeting = 'Good evening';
            else if (hr >= 21 || hr < 5) greeting = 'Good night';
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

        // Lock button visibility
        const btnLock = document.getElementById('btn-quick-lock');
        if (btnLock) {
            btnLock.style.display = settings.passwordHash ? 'flex' : 'none';
        }

        this.updateSidebarStats();
    }

    updateSidebarStats() {
        const habits = db.getHabits();
        const todayStr = new Date().toISOString().split('T')[0];
        const activeHabitsToday = habits.filter(h => isHabitActiveOnDate(h, todayStr));
        const log = db.getLogForDate(todayStr);
        
        const done = Object.keys(log.completions || {}).filter(hId => {
            return activeHabitsToday.some(h => h.id === hId) && log.completions[hId].completed;
        }).length;
        
        const pct = activeHabitsToday.length > 0 ? Math.round((done / activeHabitsToday.length) * 100) : 0;
        
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
            sidebarSubtitle.innerText = `${done} of ${activeHabitsToday.length} routines met today`;
        }

        this.updateSidebarCoinWidget();
    }

    updateSidebarCoinWidget() {
        const blueprints = db.getBlueprints();
        const coins = blueprints.coins || 0;
        const coinText = document.getElementById('sidebar-coin-text');
        if (coinText) {
            coinText.innerText = `${coins} Coin${coins !== 1 ? 's' : ''}`;
        }
    }

    route() {
        if (this.isLocked) return;
        const hash = window.location.hash.substring(1) || 'dashboard';
        const activeView = this.views[hash];

        if (!activeView) {
            window.location.hash = '#dashboard';
            return;
        }

        if (this.currentView === Dashboard) {
            Dashboard.clearAllTimers();
        }

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
