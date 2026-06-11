/* ============================================================
   i18n.js — Internationalization (Chinese / English)
   ============================================================ */

const I18N = {
    currentLang: 'zh',

    strings: {
        zh: {
            title: '世界地图挑战',
            mode_name_to_country: '点名找国',
            mode_capital_to_country: '首都找国',
            mode_outline_to_name: '轮廓猜名',
            mode_highlight_to_name: '高亮猜名',
            mode_time_challenge: '限时挑战',
            difficulty: '难度',
            diff_easy: '简单',
            diff_medium: '中等',
            diff_hard: '困难',
            mode: '模式',
            mode_normal: '计分模式',
            mode_practice: '练习模式',
            score: '得分',
            combo: '连击',
            round: '题数',
            start: '开始游戏',
            end: '结束游戏',
            next: '下一题',
            submit: '确认',
            close: '关闭',
            new_game: '再来一局',
            stats_title: '游戏统计',
            result_title: '游戏结束',
            hints_title: '提示',
            input_placeholder: '输入国家名称...',
            click_map_hint: '👆 点击地图上的目标国家',
            question_name_to_country: '📍 请在地图上点击：',
            question_capital_to_country: '🏙️ 这个首都属于哪个国家？点击地图：',
            question_outline_to_name: '🗺️ 这是哪个国家的轮廓？请输入名称：',
            question_highlight_to_name: '🎯 高亮的国家是？请输入名称：',
            question_time_challenge: '⏱ 限时挑战！点击/输入：',
            feedback_correct: '✅ 正确！',
            feedback_wrong: '❌ 不对哦',
            feedback_wrong_country: '你点击的是：<b>{country}</b>',
            feedback_answer: '正确答案是：<b>{country}</b>',
            feedback_click_sea: '请点击一个国家，不要点击海洋区域',
            hint_try_again: '再试一次！',
            hint_continent: '位于<b>{continent}</b>',
            hint_first_letter: '首字母：<b>{letter}</b>',
            hint_zoom: '地图已缩放到目标区域',
            hint_reveal: '正确答案是：<b>{country}</b>',
            stat_total_games: '总局数',
            stat_high_score: '最高分',
            stat_best_combo: '最佳连击',
            stat_total_correct: '总答对',
            stat_accuracy: '正确率',
            stat_weak_countries: '薄弱国家',
            no_data: '暂无数据',
            practice_mode: '练习模式',
            // Continent names in Chinese
            continent_AS: '亚洲',
            continent_EU: '欧洲',
            continent_AF: '非洲',
            continent_NA: '北美洲',
            continent_SA: '南美洲',
            continent_OC: '大洋洲',
        },
        en: {
            title: 'World Map Challenge',
            mode_name_to_country: 'Find Country',
            mode_capital_to_country: 'Find Capital',
            mode_outline_to_name: 'Guess Outline',
            mode_highlight_to_name: 'Name Country',
            mode_time_challenge: 'Timed',
            difficulty: 'Difficulty',
            diff_easy: 'Easy',
            diff_medium: 'Medium',
            diff_hard: 'Hard',
            mode: 'Mode',
            mode_normal: 'Scored',
            mode_practice: 'Practice',
            score: 'Score',
            combo: 'Combo',
            round: 'Round',
            start: 'Start Game',
            end: 'End Game',
            next: 'Next',
            submit: 'Submit',
            close: 'Close',
            new_game: 'New Game',
            stats_title: 'Statistics',
            result_title: 'Game Over',
            hints_title: 'Hints',
            input_placeholder: 'Enter country name...',
            click_map_hint: '👆 Click the target country on the map',
            question_name_to_country: '📍 Click this country on the map:',
            question_capital_to_country: '🏙️ Which country has this capital? Click it:',
            question_outline_to_name: '🗺️ Which country has this outline? Type the name:',
            question_highlight_to_name: '🎯 What country is highlighted? Type the name:',
            question_time_challenge: '⏱ Timed challenge! Click/type:',
            feedback_correct: '✅ Correct!',
            feedback_wrong: '❌ Incorrect',
            feedback_wrong_country: 'You clicked: <b>{country}</b>',
            feedback_answer: 'The answer is: <b>{country}</b>',
            feedback_click_sea: 'Please click a country, not the ocean',
            hint_try_again: 'Try again!',
            hint_continent: 'Located in <b>{continent}</b>',
            hint_first_letter: 'First letter: <b>{letter}</b>',
            hint_zoom: 'Map zoomed to target area',
            hint_reveal: 'The answer is: <b>{country}</b>',
            stat_total_games: 'Total Games',
            stat_high_score: 'High Score',
            stat_best_combo: 'Best Combo',
            stat_total_correct: 'Total Correct',
            stat_accuracy: 'Accuracy',
            stat_weak_countries: 'Weak Countries',
            no_data: 'No data yet',
            practice_mode: 'Practice Mode',
            // Continent names in English
            continent_AS: 'Asia',
            continent_EU: 'Europe',
            continent_AF: 'Africa',
            continent_NA: 'North America',
            continent_SA: 'South America',
            continent_OC: 'Oceania',
        }
    },

    /** Get a translated string by key */
    t(key, replacements) {
        let str = this.strings[this.currentLang][key] || this.strings['zh'][key] || key;
        if (replacements) {
            for (const [k, v] of Object.entries(replacements)) {
                str = str.replace(`{${k}}`, v);
            }
        }
        return str;
    },

    /** Switch language and update all UI elements */
    switchLang() {
        this.currentLang = this.currentLang === 'zh' ? 'en' : 'zh';
        this.updateUI();
        // Save preference
        if (typeof Storage !== 'undefined') {
            Storage.saveSettings({ language: this.currentLang });
        }
    },

    /** Update all data-i18n elements */
    updateUI() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = text;
            } else if (el.tagName === 'OPTION') {
                el.textContent = text;
            } else {
                el.textContent = text;
            }
        });
        // Update placeholder attributes
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });
        // Notify game to refresh question text
        if (typeof Game !== 'undefined' && Game.onLanguageChange) {
            Game.onLanguageChange();
        }
    },

    /** Get country display name in current language */
    countryName(feature) {
        if (!feature || !feature.properties) return '';
        const p = feature.properties;
        if (this.currentLang === 'zh') {
            return p.name || '';
        }
        return p.name_en || p.name || '';
    },

    /** Get capital display name in current language */
    capitalName(feature) {
        if (!feature || !feature.properties) return '';
        const p = feature.properties;
        if (this.currentLang === 'zh') {
            return p.capital_zh || '';
        }
        return p.capital_en || '';
    },

    /** Get continent display name in current language */
    continentName(code) {
        if (this.currentLang === 'zh') {
            return this.strings.zh['continent_' + code] || code;
        }
        return this.strings.en['continent_' + code] || code;
    }
};
