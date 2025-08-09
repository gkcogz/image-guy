import initHelpWidget from './help-widget.js';

const appState = {
    translations: {},
    currentLanguage: 'en',
};
const SUPPORTED_LANGUAGES = ['en', 'de', 'zh', 'tr'];

async function loadTranslations() {
    try {
        const response = await fetch('/languages.json');
        if (!response.ok) throw new Error('Failed to load language file.');
        const data = await response.json();
        if (typeof data !== 'object' || data === null) throw new Error('Language file format is invalid.');
        appState.translations = data;
        console.log("Translations loaded successfully.");
    } catch (error) {
        console.error(error);
    }
}

function translatePage() {
    if (!appState.translations[appState.currentLanguage]) {
        document.documentElement.classList.remove('untranslated');
        return;
    }
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        if (appState.translations[appState.currentLanguage][key]) {
            element.textContent = appState.translations[appState.currentLanguage][key];
        }
    });
    document.documentElement.lang = appState.currentLanguage;
    document.querySelectorAll('.lang-link').forEach(link => {
        link.classList.toggle('active', link.dataset.lang === appState.currentLanguage);
    });
    document.documentElement.classList.remove('untranslated');
}

function setLanguage(lang) {
    if (SUPPORTED_LANGUAGES.includes(lang)) {
        appState.currentLanguage = lang;
        localStorage.setItem('selectedLanguage', lang);
        translatePage();
    }
}

async function initializeI18n() {
    await loadTranslations();
    const savedLang = localStorage.getItem('selectedLanguage');
    const browserLang = navigator.language.split('-')[0];
    let initialLang = 'en';
    if (savedLang && SUPPORTED_LANGUAGES.includes(savedLang)) {
        initialLang = savedLang;
    } else if (SUPPORTED_LANGUAGES.includes(browserLang)) {
        initialLang = browserLang;
    }
    setLanguage(initialLang);

    const switcherBtn = document.getElementById('lang-switcher-btn');
    const dropdown = document.getElementById('language-dropdown');
    if (switcherBtn && dropdown) {
        switcherBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });
        document.querySelectorAll('.lang-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                setLanguage(e.target.dataset.lang);
                dropdown.style.display = 'none';
            });
        });
        document.addEventListener('click', () => {
            if (dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            }
        });
    }
}

function initializeMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    if (!menuToggle || !mainNav) return;

    const openIcon = document.getElementById('menu-open-icon');
    const closeIcon = document.getElementById('menu-close-icon');
    const body = document.body;
    menuToggle.addEventListener('click', () => {
        const isActive = mainNav.classList.toggle('mobile-active');
        body.classList.toggle('mobile-menu-active');
        if (openIcon && closeIcon) {
            openIcon.style.display = isActive ? 'none' : 'block';
            closeIcon.style.display = isActive ? 'block' : 'none';
        }
    });
}

// Sayfa yüklendiğinde tüm genel fonksiyonları başlat
document.addEventListener('DOMContentLoaded', () => {
    initializeI18n(); 
    initHelpWidget(); 
    initializeMobileMenu();
});