/* ============================================================
   scoring.js — Score calculation, combo tracking
   ============================================================ */

const Scoring = {
    // Current round state
    score: 0,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    wrong: 0,
    roundNumber: 0,
    totalRounds: 10,
    questionStartTime: 0,
    mastery: {},        // { iso_a2: { seen, correct } }

    // Settings
    basePoints: 100,
    speedBonus5s: 50,
    speedBonus10s: 30,
    hintPenalty: 20,
    comboBonus: 10,
    difficultyMultiplier: { easy: 1.0, medium: 1.3, hard: 1.5 },
    smallCountryMultiplier: 1.5,
    smallCountryThreshold: 40,  // area_rank > 40 = small country

    /** Reset for new game */
    reset(totalRounds) {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.correct = 0;
        this.wrong = 0;
        this.roundNumber = 0;
        this.totalRounds = totalRounds || 10;
        this.mastery = {};
    },

    /** Start timing a question */
    startQuestion() {
        this.questionStartTime = Date.now();
        this.roundNumber++;
    },

    /** Calculate score for a correct answer */
    calculateCorrect(hintsUsed, difficulty, countryFeature) {
        const elapsed = (Date.now() - this.questionStartTime) / 1000;
        this.combo++;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
        this.correct++;

        let points = this.basePoints;

        // Speed bonus
        if (elapsed <= 5) points += this.speedBonus5s;
        else if (elapsed <= 10) points += this.speedBonus10s;

        // Combo bonus
        points += this.combo * this.comboBonus;

        // Hint penalty
        points -= hintsUsed * this.hintPenalty;
        if (points < 0) points = 0;

        // Difficulty multiplier
        const diffMult = this.difficultyMultiplier[difficulty] || 1.0;
        points = Math.round(points * diffMult);

        // Small country bonus
        const areaRank = countryFeature?.properties?.area_rank || 1;
        if (areaRank > this.smallCountryThreshold) {
            points = Math.round(points * this.smallCountryMultiplier);
        }

        this.score += points;

        // Track mastery
        const iso = countryFeature?.properties?.iso_a2;
        if (iso) {
            if (!this.mastery[iso]) this.mastery[iso] = { seen: 0, correct: 0 };
            this.mastery[iso].seen++;
            this.mastery[iso].correct++;
        }

        return {
            points,
            totalScore: this.score,
            combo: this.combo,
            elapsed: Math.round(elapsed * 10) / 10,
        };
    },

    /** Record a wrong answer */
    recordWrong(countryFeature) {
        this.combo = 0;
        this.wrong++;

        const iso = countryFeature?.properties?.iso_a2;
        if (iso) {
            if (!this.mastery[iso]) this.mastery[iso] = { seen: 0, correct: 0 };
            this.mastery[iso].seen++;
        }
    },

    /** Get result summary */
    getResult() {
        return {
            score: this.score,
            correct: this.correct,
            wrong: this.wrong,
            maxCombo: this.maxCombo,
            totalRounds: this.totalRounds,
            mastery: this.mastery,
        };
    },

    /** Get current state for display */
    getDisplay() {
        return {
            score: this.score,
            combo: this.combo,
            round: `${this.roundNumber}/${this.totalRounds}`,
        };
    },
};
