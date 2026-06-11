/* ============================================================
   storage.js — localStorage persistence
   ============================================================ */

const Storage = {
    STORAGE_KEY: 'world_map_game',

    /** Load all saved data */
    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : this.defaults();
        } catch (e) {
            return this.defaults();
        }
    },

    /** Default data structure */
    defaults() {
        return {
            gameStats: {
                totalGames: 0,
                highScore: 0,
                bestCombo: 0,
                totalCorrect: 0,
                totalWrong: 0,
            },
            countryMastery: {},
            settings: {
                language: 'zh',
                difficulty: 'medium',
            }
        };
    },

    /** Save all data */
    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // localStorage full or unavailable
        }
    },

    /** Update game stats after a round */
    updateStats(gameResult) {
        const data = this.load();
        const s = data.gameStats;
        s.totalGames++;
        s.totalCorrect += gameResult.correct;
        s.totalWrong += gameResult.wrong;
        if (gameResult.score > s.highScore) s.highScore = gameResult.score;
        if (gameResult.maxCombo > s.bestCombo) s.bestCombo = gameResult.maxCombo;

        // Update country mastery
        if (gameResult.mastery) {
            for (const [iso, m] of Object.entries(gameResult.mastery)) {
                if (!data.countryMastery[iso]) {
                    data.countryMastery[iso] = { seen: 0, correct: 0 };
                }
                data.countryMastery[iso].seen += m.seen || 0;
                data.countryMastery[iso].correct += m.correct || 0;
                data.countryMastery[iso].lastSeen = new Date().toISOString().slice(0, 10);
            }
        }

        this.save(data);
    },

    /** Save a setting value */
    saveSettings(settings) {
        const data = this.load();
        Object.assign(data.settings, settings);
        this.save(data);
    },

    /** Get weak countries (error rate > 50%, seen >= 3 times) */
    getWeakCountries() {
        const data = this.load();
        const weak = [];
        for (const [iso, m] of Object.entries(data.countryMastery)) {
            if (m.seen >= 3) {
                const errorRate = 1 - (m.correct / m.seen);
                if (errorRate > 0.5) {
                    weak.push({ iso, errorRate, ...m });
                }
            }
        }
        weak.sort((a, b) => b.errorRate - a.errorRate);
        return weak;
    },

    /** Get country accuracy stats */
    getCountryStats() {
        const data = this.load();
        const stats = {};
        for (const [iso, m] of Object.entries(data.countryMastery)) {
            if (m.seen > 0) {
                stats[iso] = {
                    ...m,
                    accuracy: Math.round((m.correct / m.seen) * 100),
                };
            }
        }
        return stats;
    },

    /** Get formatted stats for display */
    getFormattedStats() {
        const data = this.load();
        const s = data.gameStats;
        const total = s.totalCorrect + s.totalWrong;
        const accuracy = total > 0 ? Math.round((s.totalCorrect / total) * 100) : 0;
        return {
            totalGames: s.totalGames,
            highScore: s.highScore,
            bestCombo: s.bestCombo,
            totalCorrect: s.totalCorrect,
            accuracy,
            totalCountriesSeen: Object.keys(data.countryMastery).length,
        };
    }
};
