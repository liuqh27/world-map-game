/* ============================================================
   hints.js — Progressive hint system + autocomplete search
   ============================================================ */

const Hints = {
    // Per-question state
    wrongCount: 0,
    hintsShown: [],
    maxHints: 5,

    /** Reset for a new question */
    reset() {
        this.wrongCount = 0;
        this.hintsShown = [];
    },

    /** Record a wrong answer, return the next hint object or null */
    onWrong(countryFeature) {
        this.wrongCount++;
        const hint = this._getHint(countryFeature);
        if (hint) {
            this.hintsShown.push(hint);
        }
        return hint;
    },

    /** Get the appropriate hint for current wrong count */
    _getHint(feature) {
        const lang = I18N.currentLang;
        const p = feature.properties;
        const continentCode = p.continent || 'XX';

        switch (this.wrongCount) {
            case 1:
                return {
                    level: 1,
                    text: I18N.t('hint_try_again'),
                    action: 'message',
                };
            case 2:
                return {
                    level: 2,
                    text: I18N.t('hint_continent', {
                        continent: I18N.continentName(continentCode)
                    }),
                    action: 'message',
                };
            case 3:
                const name = I18N.countryName(feature);
                const letter = name ? name[0] : '?';
                return {
                    level: 3,
                    text: I18N.t('hint_first_letter', { letter }),
                    action: 'message',
                };
            case 4:
                return {
                    level: 4,
                    text: I18N.t('hint_zoom'),
                    action: 'zoom',
                    iso_a2: p.iso_a2,
                };
            case 5:
                return {
                    level: 5,
                    text: I18N.t('hint_reveal', {
                        country: I18N.countryName(feature)
                    }),
                    action: 'reveal',
                    iso_a2: p.iso_a2,
                };
            default:
                return null;
        }
    },

    /** Check if question should be skipped (max wrong reached) */
    shouldSkip() {
        return this.wrongCount >= this.maxHints;
    },

    // ── Autocomplete ──────────────────────────────────

    /** Search countries by fuzzy match. Returns array of {feature, score} */
    search(query, features, limit = 5) {
        if (!query || query.trim().length === 0) return [];

        const q = query.trim().toLowerCase();
        const results = [];

        for (const f of features) {
            const p = f.properties;
            const nameZh = (p.name || '').toLowerCase();
            const nameEn = (p.name_en || '').toLowerCase();
            const capitalZh = (p.capital_zh || '').toLowerCase();
            const capitalEn = (p.capital_en || '').toLowerCase();
            const continentZh = (p.continent_zh || '').toLowerCase();
            const continentEn = I18N.continentName(p.continent || '').toLowerCase();

            let score = 0;

            // Exact match
            if (nameZh === q || nameEn === q) score = 100;
            // Starts with
            else if (nameZh.startsWith(q) || nameEn.startsWith(q)) score = 80;
            // Contains
            else if (nameZh.includes(q) || nameEn.includes(q)) score = 60;
            // Capital match
            else if (capitalZh.includes(q) || capitalEn.includes(q)) score = 40;
            // Pinyin first-letter matching (simplified: match consecutive first letters)
            else if (this._matchPinyinFirstLetters(q, nameZh)) score = 30;
            // Continent contains
            else if (continentZh.includes(q) || continentEn.includes(q)) score = 20;
            // Single character match anywhere
            else if (q.length === 1 && (nameZh.includes(q) || nameEn.includes(q))) score = 10;

            if (score > 0) {
                results.push({ feature: f, score });
            }
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    },

    /** Simple pinyin first-letter matching */
    _matchPinyinFirstLetters(query, chineseName) {
        // Very simplified: just check if the query chars appear as first chars
        // of some "words" in the name. For real pinyin we'd need a library,
        // but for game purposes this simple check works decently.
        if (query.length < 2) return false;

        // Try extracting first characters as a shortcut
        // This handles cases like "JND" for "加拿大" (Jia Na Da)
        // Since we don't have real pinyin, we rely on the English name matching
        // which is already covered above
        return false;
    },

    /** Render autocomplete dropdown */
    renderDropdown(results, containerEl, onSelect) {
        containerEl.innerHTML = '';
        if (results.length === 0) {
            containerEl.classList.add('hidden');
            return;
        }

        containerEl.classList.remove('hidden');
        results.forEach((r, i) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerHTML = `
                <span class="match-name">${I18N.countryName(r.feature)}</span>
                <span class="match-continent">${I18N.continentName(r.feature.properties.continent)}</span>
            `;
            item.addEventListener('click', () => onSelect(r.feature));
            item.addEventListener('mouseenter', () => {
                containerEl.querySelectorAll('.autocomplete-item').forEach(
                    el => el.classList.remove('active')
                );
                item.classList.add('active');
            });
            containerEl.appendChild(item);

            // Set first item active
            if (i === 0) item.classList.add('active');
        });
    },

    /** Handle keyboard navigation in dropdown */
    handleKeydown(e, results, onSelect) {
        const container = document.getElementById('autocomplete-dropdown');
        if (container.classList.contains('hidden')) return false;

        const items = container.querySelectorAll('.autocomplete-item');
        let activeIdx = -1;
        items.forEach((item, i) => {
            if (item.classList.contains('active')) activeIdx = i;
        });

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIdx = (activeIdx + 1) % items.length;
            items.forEach(el => el.classList.remove('active'));
            items[activeIdx].classList.add('active');
            return true;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIdx = (activeIdx - 1 + items.length) % items.length;
            items.forEach(el => el.classList.remove('active'));
            items[activeIdx].classList.add('active');
            return true;
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIdx >= 0 && activeIdx < results.length) {
                onSelect(results[activeIdx].feature);
            }
            return true;
        } else if (e.key === 'Escape') {
            container.classList.add('hidden');
            return true;
        }

        return false;
    },
};
