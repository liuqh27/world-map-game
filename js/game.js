/* ============================================================
   game.js — Game state machine, modes, question/answer logic
   ============================================================ */

const Game = {
    // State
    state: 'idle',              // idle | playing | answering | feedback
    mode: 'name_to_country',    // name_to_country | capital_to_country | outline_to_name | highlight_to_name | time_challenge
    difficulty: 'medium',
    playMode: 'normal',         // normal | practice
    currentCountry: null,       // Current target country feature
    usedCountries: null,        // Set of iso_a2 already used this game
    roundTimer: null,           // setTimeout for auto-advance
    countdownTimer: null,       // setInterval for timed challenge
    timeRemaining: 0,
    totalTime: 60,
    autocompleteResults: [],
    hintsUsedThisRound: 0,

    /** Initialize game — called once from app.js */
    init() {
        this.bindUI();
        this.setState('idle');
    },

    /** Start a new game */
    startGame() {
        // Check data is loaded
        if (!MapEngine.dataReady) {
            alert('地图数据加载中，请稍后再试...\nMap data is still loading, please wait...');
            return;
        }

        // If a game is already running, end it silently first
        if (this.state !== 'idle') {
            this.endGame(true);
        }

        // Read mode from currently active tab
        const activeTab = document.querySelector('.mode-tab.active');
        if (activeTab) {
            this.mode = activeTab.dataset.mode;
        }
        const diffSelect = document.getElementById('difficulty-select');
        const modeSelect = document.getElementById('mode-select');

        this.difficulty = diffSelect?.value || 'medium';
        this.playMode = modeSelect?.value || 'normal';
        this.usedCountries = new Set();

        const totalRounds = this.mode === 'time_challenge' ? Infinity : 10;
        Scoring.reset(totalRounds);
        Hints.reset();
        this.hintsUsedThisRound = 0;

        // Update UI
        document.getElementById('btn-start').classList.add('hidden');
        document.getElementById('btn-end').classList.remove('hidden');

        if (this.mode === 'time_challenge') {
            this.totalTime = this.difficulty === 'easy' ? 120 : this.difficulty === 'medium' ? 90 : 60;
            this.timeRemaining = this.totalTime;
            document.getElementById('timer-display').classList.remove('hidden');
            document.getElementById('timer-value').textContent = this.timeRemaining;
            this.startCountdown();
        }

        // Disable country name tooltips during gameplay
        MapEngine.disableTooltips();

        this.updateScoreDisplay();
        this.setState('playing');
        this.nextQuestion();
    },

    /** End the current game
     * @param {boolean} silent - if true, skip showing the result modal */
    endGame(silent = false) {
        this.cleanup();
        if (!silent) {
            this.showResult();
        }
        this.setState('idle');

        document.getElementById('btn-start').classList.remove('hidden');
        document.getElementById('btn-end').classList.add('hidden');
        document.getElementById('timer-display').classList.add('hidden');

        MapEngine.disableClickMode();
        MapEngine.resetHighlight();
        MapEngine.clearOutlineMode();
        MapEngine.enableTooltips();
        document.getElementById('map-overlay').classList.add('hidden');
        document.getElementById('input-area').classList.add('hidden');
        document.getElementById('feedback-area').classList.add('hidden');
        document.getElementById('hints-area').classList.add('hidden');
        // Clear child elements safely without destroying them
        const prompt = document.getElementById('question-prompt');
        const content = document.getElementById('question-content');
        if (prompt) prompt.textContent = '';
        if (content) content.textContent = '';
    },

    /** Clean up timers */
    cleanup() {
        if (this.roundTimer) clearTimeout(this.roundTimer);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.roundTimer = null;
        this.countdownTimer = null;
    },

    /** Set game state */
    setState(newState) {
        this.state = newState;
    },

    // ── Question Generation ──────────────────────────

    /** Generate and display a new question */
    nextQuestion() {
        if (this.state !== 'playing') return;

        this.setState('answering');
        Hints.reset();
        this.hintsUsedThisRound = 0;

        // For non-timed modes, check if we've done enough rounds
        if (this.mode !== 'time_challenge' && Scoring.roundNumber >= Scoring.totalRounds) {
            this.endGame();
            return;
        }

        // Pick a random country
        this.currentCountry = MapEngine.getRandomCountry(this.difficulty, this.usedCountries);
        if (!this.currentCountry) {
            this.endGame();
            return;
        }
        this.usedCountries.add(this.currentCountry.properties.iso_a2);

        // Update UI for question
        MapEngine.resetHighlight();
        MapEngine.clearOutlineMode();
        document.getElementById('feedback-area').classList.add('hidden');
        document.getElementById('hints-area').classList.add('hidden');
        document.getElementById('input-area').classList.add('hidden');

        Scoring.startQuestion();

        // Mode-specific setup
        switch (this.mode) {
            case 'name_to_country':
                this.setupNameToCountry();
                break;
            case 'capital_to_country':
                this.setupCapitalToCountry();
                break;
            case 'outline_to_name':
                this.setupOutlineToName();
                break;
            case 'highlight_to_name':
                this.setupHighlightToName();
                break;
            case 'time_challenge':
                // Randomly pick between name and capital modes
                Math.random() < 0.5 ? this.setupNameToCountry() : this.setupCapitalToCountry();
                break;
        }

        this.updateScoreDisplay();
    },

    setupNameToCountry() {
        const name = I18N.countryName(this.currentCountry);
        document.getElementById('question-prompt').textContent = I18N.t('question_name_to_country');
        document.getElementById('question-content').innerHTML =
            `<span style="font-size:28px">${name}</span>`;
        document.getElementById('input-area').classList.add('hidden');
        document.getElementById('map-overlay').classList.remove('hidden');
        MapEngine.enableClickMode(this.currentCountry.properties.iso_a2, this.handleMapClick.bind(this));
    },

    setupCapitalToCountry() {
        const capital = I18N.capitalName(this.currentCountry);
        document.getElementById('question-prompt').textContent = I18N.t('question_capital_to_country');
        document.getElementById('question-content').innerHTML =
            `<span style="font-size:28px">${capital}</span>`;
        document.getElementById('input-area').classList.add('hidden');
        document.getElementById('map-overlay').classList.remove('hidden');
        MapEngine.enableClickMode(this.currentCountry.properties.iso_a2, this.handleMapClick.bind(this));
    },

    setupOutlineToName() {
        document.getElementById('question-prompt').textContent = I18N.t('question_outline_to_name');
        document.getElementById('question-content').textContent = '';
        document.getElementById('map-overlay').classList.add('hidden');
        MapEngine.disableClickMode();
        MapEngine.setOutlineMode(this.currentCountry.properties.iso_a2);

        // Show input area
        document.getElementById('input-area').classList.remove('hidden');
        const input = document.getElementById('country-input');
        input.value = '';
        input.focus();
        document.getElementById('autocomplete-dropdown').classList.add('hidden');
        document.getElementById('btn-submit').disabled = false;
    },

    setupHighlightToName() {
        document.getElementById('question-prompt').textContent = I18N.t('question_highlight_to_name');
        document.getElementById('question-content').textContent = '';
        document.getElementById('map-overlay').classList.add('hidden');
        MapEngine.disableClickMode();
        MapEngine.highlightCountry(this.currentCountry.properties.iso_a2);
        MapEngine.flyToCountry(this.currentCountry.properties.iso_a2);

        // Show input area
        document.getElementById('input-area').classList.remove('hidden');
        const input = document.getElementById('country-input');
        input.value = '';
        input.focus();
        document.getElementById('autocomplete-dropdown').classList.add('hidden');
        document.getElementById('btn-submit').disabled = false;
    },

    // ── Answer Handling ───────────────────────────────

    /** Handle map click in click-based modes */
    handleMapClick(clickedIso, clickedFeature) {
        if (this.state !== 'answering') return;

        const targetIso = this.currentCountry.properties.iso_a2;
        if (clickedIso === targetIso) {
            this.onCorrectAnswer();
        } else {
            this.onWrongAnswer(clickedFeature);
        }
    },

    /** Handle text submission in text-based modes */
    handleTextSubmit(submittedText) {
        if (this.state !== 'answering') return;

        const targetIso = this.currentCountry.properties.iso_a2;
        const submittedFeature = this.findCountryByText(submittedText);

        if (submittedFeature && submittedFeature.properties.iso_a2 === targetIso) {
            this.onCorrectAnswer();
        } else {
            this.onWrongAnswer(submittedFeature);
        }
    },

    /** Find a country feature from user text input */
    findCountryByText(text) {
        if (!text || !text.trim()) return null;
        const q = text.trim().toLowerCase();
        const features = MapEngine.countryFeatures;

        // Try exact match first (in current language)
        for (const f of features) {
            if (I18N.countryName(f).toLowerCase() === q) return f;
        }
        // Try English name
        for (const f of features) {
            if ((f.properties.name_en || '').toLowerCase() === q) return f;
        }
        // Try Chinese name
        for (const f of features) {
            if ((f.properties.name || '').toLowerCase() === q) return f;
        }
        // Try ISO codes
        for (const f of features) {
            if (f.properties.iso_a2.toLowerCase() === q ||
                f.properties.iso_a3.toLowerCase() === q) return f;
        }
        return null;
    },

    // ── Answer Feedback ───────────────────────────────

    onCorrectAnswer() {
        this.setState('feedback');
        MapEngine.disableClickMode();
        MapEngine.clearOutlineMode();
        document.getElementById('map-overlay').classList.add('hidden');
        document.getElementById('input-area').classList.add('hidden');

        const result = Scoring.calculateCorrect(
            this.hintsUsedThisRound,
            this.difficulty,
            this.currentCountry
        );

        MapEngine.highlightCountry(this.currentCountry.properties.iso_a2);
        MapEngine.flyToCountry(this.currentCountry.properties.iso_a2);

        this.showFeedback(true, result);
        this.updateScoreDisplay();

        // Auto-advance after delay
        this.roundTimer = setTimeout(() => {
            if (this.state === 'feedback') {
                this.setState('playing');
                this.nextQuestion();
            }
        }, 1800);
    },

    onWrongAnswer(clickedFeature) {
        this.setState('feedback');

        if (clickedFeature) {
            Scoring.recordWrong(this.currentCountry);
        }

        const hint = Hints.onWrong(this.currentCountry);
        this.hintsUsedThisRound = Math.max(this.hintsUsedThisRound, Hints.wrongCount);

        // Show feedback
        this.showFeedback(false, null, clickedFeature);

        // Show hints if in practice mode or if hints are available
        if (hint) {
            this.showHints();
        }

        // Handle hint actions
        if (hint && hint.action === 'zoom') {
            MapEngine.flyToCountry(hint.iso_a2);
            MapEngine.flashCountry(hint.iso_a2, 1500);
        }

        if (Hints.shouldSkip()) {
            // Reveal answer and move on
            MapEngine.highlightCountry(this.currentCountry.properties.iso_a2);
            MapEngine.flyToCountry(this.currentCountry.properties.iso_a2);

            if (this.playMode === 'practice') {
                this.roundTimer = setTimeout(() => {
                    if (this.state === 'feedback') {
                        this.setState('playing');
                        this.nextQuestion();
                    }
                }, 2500);
            } else {
                // In scored mode, just move on after reveal
                this.roundTimer = setTimeout(() => {
                    if (this.state === 'feedback') {
                        this.setState('playing');
                        this.nextQuestion();
                    }
                }, 2000);
            }
        } else if (this.playMode === 'normal' && !hint) {
            // In scored mode with no hint, move on after wrong answer
            MapEngine.highlightCountry(this.currentCountry.properties.iso_a2);
            this.roundTimer = setTimeout(() => {
                if (this.state === 'feedback') {
                    this.setState('playing');
                    this.nextQuestion();
                }
            }, 2000);
        } else {
            // In practice mode, let player try again
            this.setState('answering');

            // Re-enable the appropriate input method
            if (this.mode === 'outline_to_name' || this.mode === 'highlight_to_name') {
                document.getElementById('input-area').classList.remove('hidden');
                document.getElementById('country-input').value = '';
                document.getElementById('country-input').focus();
                document.getElementById('btn-submit').disabled = false;
            } else {
                MapEngine.enableClickMode(
                    this.currentCountry.properties.iso_a2,
                    this.handleMapClick.bind(this)
                );
                document.getElementById('map-overlay').classList.remove('hidden');
            }
        }

        this.updateScoreDisplay();
    },

    /** Show feedback message */
    showFeedback(isCorrect, result, clickedFeature) {
        const area = document.getElementById('feedback-area');
        const content = document.getElementById('feedback-content');
        area.classList.remove('hidden');

        if (isCorrect) {
            let msg = I18N.t('feedback_correct');
            if (result && this.playMode !== 'practice') {
                msg += `<br><small>+${result.points} 分 | ${result.elapsed}秒 | 连击×${result.combo}</small>`;
            }
            content.innerHTML = msg;
            content.className = 'feedback-correct';
        } else {
            const targetName = I18N.countryName(this.currentCountry);
            let msg = I18N.t('feedback_wrong');
            if (clickedFeature) {
                msg += '<br>' + I18N.t('feedback_wrong_country', {
                    country: I18N.countryName(clickedFeature)
                });
            }
            content.innerHTML = msg;
            content.className = 'feedback-wrong';
        }
    },

    /** Show hints area */
    showHints() {
        const area = document.getElementById('hints-area');
        const content = document.getElementById('hints-content');
        area.classList.remove('hidden');

        content.innerHTML = Hints.hintsShown.map((h, i) =>
            `<div class="hint-item">${h.text}</div>`
        ).join('');
    },

    /** Update score display in sidebar */
    updateScoreDisplay() {
        const display = Scoring.getDisplay();
        document.getElementById('score-value').textContent = display.score;
        document.getElementById('combo-value').textContent = display.combo;
        document.getElementById('round-value').textContent = display.round;
    },

    // ── Timed Challenge ───────────────────────────────

    startCountdown() {
        this.countdownTimer = setInterval(() => {
            this.timeRemaining--;
            const display = document.getElementById('timer-value');
            display.textContent = this.timeRemaining;

            if (this.timeRemaining <= 10) {
                document.getElementById('timer-display').classList.add('warning');
            }

            if (this.timeRemaining <= 0) {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                this.endGame();
            }
        }, 1000);
    },

    // ── Result Display ────────────────────────────────

    showResult() {
        const result = Scoring.getResult();
        const accuracy = result.correct + result.wrong > 0
            ? Math.round((result.correct / (result.correct + result.wrong)) * 100)
            : 0;

        document.getElementById('result-content').innerHTML = `
            <div class="result-score">${result.score}</div>
            <div class="result-detail">
                ${I18N.t('stat_total_correct')}: ${result.correct}<br>
                ${I18N.t('stat_accuracy')}: ${accuracy}%<br>
                ${I18N.t('stat_best_combo')}: ${result.maxCombo}
            </div>`;

        document.getElementById('result-modal').classList.remove('hidden');

        // Save to storage (non-practice)
        if (this.playMode !== 'practice') {
            Storage.updateStats(result);
        }
    },

    // ── Language Change Handler ───────────────────────

    onLanguageChange() {
        if (this.state === 'answering' || this.state === 'feedback') {
            // Refresh the question text
            this.refreshQuestionDisplay();
        }
    },

    refreshQuestionDisplay() {
        if (!this.currentCountry) return;
        const name = I18N.countryName(this.currentCountry);
        const capital = I18N.capitalName(this.currentCountry);

        // Update question content based on mode
        switch (this.mode) {
            case 'name_to_country':
                document.getElementById('question-prompt').textContent = I18N.t('question_name_to_country');
                document.getElementById('question-content').innerHTML =
                    `<span style="font-size:28px">${name}</span>`;
                break;
            case 'capital_to_country':
                document.getElementById('question-prompt').textContent = I18N.t('question_capital_to_country');
                document.getElementById('question-content').innerHTML =
                    `<span style="font-size:28px">${capital}</span>`;
                break;
            case 'outline_to_name':
                document.getElementById('question-prompt').textContent = I18N.t('question_outline_to_name');
                break;
            case 'highlight_to_name':
                document.getElementById('question-prompt').textContent = I18N.t('question_highlight_to_name');
                break;
        }
    },

    // ── UI Bindings ───────────────────────────────────

    bindUI() {
        // Mode tabs — only update visual state; actual mode switch happens in startGame()
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (this.state !== 'idle') {
                    // Game is active: only update the highlighted tab, don't change anything
                    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    return;
                }
                // Idle: update visual and set mode
                document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.mode = tab.dataset.mode;
            });
        });

        // Start button
        document.getElementById('btn-start').addEventListener('click', () => this.startGame());

        // End button
        document.getElementById('btn-end').addEventListener('click', () => this.endGame());

        // Submit button (text modes)
        document.getElementById('btn-submit').addEventListener('click', () => {
            const input = document.getElementById('country-input');
            this.handleTextSubmit(input.value);
        });

        // Country input - autocomplete
        const input = document.getElementById('country-input');
        input.addEventListener('input', () => {
            const results = Hints.search(input.value, MapEngine.countryFeatures, 5);
            this.autocompleteResults = results;
            Hints.renderDropdown(
                results,
                document.getElementById('autocomplete-dropdown'),
                (feature) => {
                    input.value = I18N.countryName(feature);
                    document.getElementById('autocomplete-dropdown').classList.add('hidden');
                    this.handleTextSubmit(I18N.countryName(feature));
                }
            );
        });

        input.addEventListener('keydown', (e) => {
            const handled = Hints.handleKeydown(e, this.autocompleteResults, (feature) => {
                input.value = I18N.countryName(feature);
                document.getElementById('autocomplete-dropdown').classList.add('hidden');
                this.handleTextSubmit(I18N.countryName(feature));
            });
            if (!handled && e.key === 'Enter') {
                document.getElementById('autocomplete-dropdown').classList.add('hidden');
                this.handleTextSubmit(input.value);
            }
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('autocomplete-dropdown');
            const input = document.getElementById('country-input');
            if (e.target !== input && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // New game button (result modal)
        document.getElementById('btn-new-game').addEventListener('click', () => {
            document.getElementById('result-modal').classList.add('hidden');
            this.startGame();
        });

        // Language button
        document.getElementById('btn-lang').addEventListener('click', () => I18N.switchLang());

        // Stats button
        document.getElementById('btn-stats').addEventListener('click', () => this.showStats());
        document.getElementById('btn-close-stats').addEventListener('click', () => {
            document.getElementById('stats-modal').classList.add('hidden');
        });
        // Close modals on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(bd => {
            bd.addEventListener('click', () => {
                document.getElementById('stats-modal').classList.add('hidden');
                document.getElementById('result-modal').classList.add('hidden');
            });
        });
    },

    /** Show statistics modal */
    showStats() {
        const stats = Storage.getFormattedStats();
        const weak = Storage.getWeakCountries();
        let weakStr = '';
        if (weak.length > 0) {
            const names = weak.slice(0, 10).map(w => {
                const f = MapEngine.getFeature(w.iso);
                return f ? I18N.countryName(f) : w.iso;
            }).join(', ');
            weakStr = `<div class="stat-row"><span class="stat-label">${I18N.t('stat_weak_countries')}</span><span class="stat-value">${names}</span></div>`;
        }

        document.getElementById('stats-content').innerHTML = `
            <div class="stat-row"><span class="stat-label">${I18N.t('stat_total_games')}</span><span class="stat-value">${stats.totalGames}</span></div>
            <div class="stat-row"><span class="stat-label">${I18N.t('stat_high_score')}</span><span class="stat-value">${stats.highScore}</span></div>
            <div class="stat-row"><span class="stat-label">${I18N.t('stat_best_combo')}</span><span class="stat-value">${stats.bestCombo}</span></div>
            <div class="stat-row"><span class="stat-label">${I18N.t('stat_total_correct')}</span><span class="stat-value">${stats.totalCorrect}</span></div>
            <div class="stat-row"><span class="stat-label">${I18N.t('stat_accuracy')}</span><span class="stat-value">${stats.accuracy}%</span></div>
            ${weakStr}`;

        document.getElementById('stats-modal').classList.remove('hidden');
    },
};
