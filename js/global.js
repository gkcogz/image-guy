// ===============================================
// LANGUAGE (i18n) SETTINGS - FOR ALL PAGES
// ===============================================

let translations = {};
const supportedLanguages = ['en', 'de', 'zh', 'tr'];
let currentLanguage = 'en';

// ... (loadTranslations, translatePage, setLanguage, initializeI18n fonksiyonları aynı kalacak) ...
async function loadTranslations() {
    try {
        const response = await fetch('/languages.json');
        if (!response.ok) {
            throw new Error('Failed to load language file.');
        }
        const data = await response.json();
        if (typeof data !== 'object' || data === null) {
            throw new Error('Language file format is invalid.');
        }
        translations = data;
        console.log("Translations loaded successfully.");
    } catch (error) {
        console.error(error);
    }
}

function translatePage() {
    if (!translations[currentLanguage]) {
        console.warn(`No translations found for language: ${currentLanguage}`);
        document.body.classList.remove('untranslated');
        return;
    }
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        if (translations[currentLanguage][key]) {
            element.textContent = translations[currentLanguage][key];
        }
    });
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll('.lang-link').forEach(link => {
        link.classList.toggle('active', link.dataset.lang === currentLanguage);
    });
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

// ===============================================
// YENİ FONKSİYON: Performans için Fontları Asenkron Yükleme
// ===============================================
function loadGoogleFonts() {
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap';
  // Stil dosyasını render-bloklayıcı olmayacak şekilde yükle
  fontLink.media = 'print';
  // Yükleme tamamlandığında tüm medya türleri için geçerli kıl
  fontLink.onload = () => {
    fontLink.media = 'all';
  };
  // Oluşturulan link etiketini head'e ekle
  document.head.appendChild(fontLink);
}


// ===============================================
// SAYFA YÜKLENDİĞİNDE ÇALIŞACAK GENEL KODLAR
// ===============================================
document.addEventListener('DOMContentLoaded', () => {
    // Dil fonksiyonlarını başlat
    initializeI18n();

    // YENİ: Fontları güvenli ve asenkron bir şekilde yükle
    loadGoogleFonts();

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