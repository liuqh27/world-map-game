/* ============================================================
   app.js — Application entry point, module initialization
   ============================================================ */

(function () {
    'use strict';

    // ── Initialize on DOM ready ───────────────────────
    function init() {
        // 1. Restore settings
        const data = Storage.load();
        if (data.settings.language) {
            I18N.currentLang = data.settings.language;
        }
        if (data.settings.difficulty) {
            document.getElementById('difficulty-select').value = data.settings.difficulty;
        }

        // 1b. Restore tooltip preference
        const tooltipsPref = localStorage.getItem('world_map_tooltips');
        if (tooltipsPref === '0') {
            MapEngine.tooltipsUserEnabled = false;
            document.getElementById('btn-tooltip').classList.remove('active');
        }

        // 2. Update language button text
        updateLangButton();

        // 3. Initialize i18n UI
        I18N.updateUI();

        // 4. Initialize map
        MapEngine.init();

        // 5. Initialize game
        Game.init();

        // 6. Tooltip toggle button
        document.getElementById('btn-tooltip').addEventListener('click', function () {
            const enabled = MapEngine.toggleUserTooltips();
            if (enabled) {
                this.classList.add('active');
            } else {
                this.classList.remove('active');
            }
        });

        // 7. Keyboard shortcut for language switch
        document.addEventListener('keydown', function (e) {
            if (e.key === 'l' && e.ctrlKey) {
                e.preventDefault();
                I18N.switchLang();
                updateLangButton();
            }
        });

        // 8. Adjust map size on window resize
        window.addEventListener('resize', function () {
            if (MapEngine.map) {
                MapEngine.map.invalidateSize();
            }
        });

        console.log('🌍 World Map Challenge initialized!');
        console.log('   Modes:', ['点名找国', '首都找国', '轮廓猜名', '高亮猜名', '限时挑战']);
        console.log('   Ctrl+L to switch language');
    }

    function updateLangButton() {
        const btn = document.getElementById('btn-lang');
        btn.textContent = I18N.currentLang === 'zh' ? '中/EN' : 'EN/中';
    }

    // ── Start ─────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
