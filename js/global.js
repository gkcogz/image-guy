// ===============================================
// DİL (i18n) AYARLARI - TÜM SAYFALAR İÇİN
// ===============================================

let translations = {};
const supportedLanguages = ['en', 'de', 'zh', 'tr'];
let currentLanguage = 'en';

async function loadTranslations() {
    try {
        const response = await fetch('/languages.json');
        if (!response.ok) {
            throw new Error('Failed to load language file.');
        }
        translations = await response.json();
        console.log("Translations loaded successfully.");
    } catch (error) {
        console.error(error);
    }
}

function translatePage() {
    if (!translations[currentLanguage]) {
        console.warn(`No translations found for language: ${currentLanguage}`);
        // Çeviri olmasa bile içeriği görünür yap, sayfa boş kalmasın.
        document.body.classList.remove('untranslated');
        return;
    }
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        if (translations[currentLanguage][key]) {
            element.innerHTML = translations[currentLanguage][key];
        }
    });
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll('.lang-link').forEach(link => {
        link.classList.toggle('active', link.dataset.lang === currentLanguage);
    });

    // === YENİ EKLENEN SATIR ===
    // Çeviri bitti, şimdi gövdeyi (body) görünür yap.
    document.body.classList.remove('untranslated');
}

function setLanguage(lang) {
    if (supportedLanguages.includes(lang)) {
        currentLanguage = lang;
        localStorage.setItem('selectedLanguage', lang);
        translatePage();
    }
}

async function initializeI18n() {
    await loadTranslations();
    const savedLang = localStorage.getItem('selectedLanguage');
    const browserLang = navigator.language.split('-')[0];

    let initialLang = 'en';
    if (savedLang && supportedLanguages.includes(savedLang)) {
        initialLang = savedLang;
    } else if (supportedLanguages.includes(browserLang)) {
        initialLang = browserLang;
    }
    
    setLanguage(initialLang); // await'e gerek yok

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


// ===============================================
// SAYFA YÜKLENDİĞİNDE ÇALIŞACAK GENEL KODLAR
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    // Dil fonksiyonlarını başlat
    initializeI18n();

    // Mobil menü fonksiyonunu başlat
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    if (menuToggle && mainNav) {
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
});