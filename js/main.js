// ===============================================
// DİL (i18n) AYARLARI
// ===============================================

let translations = {};
const supportedLanguages = ['en', 'de', 'zh'];
let currentLanguage = 'en'; // Varsayılan dil

// Dil dosyasını yükleyen fonksiyon
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

// Sayfadaki metinleri güncelleyen fonksiyon
function translatePage() {
    if (!translations[currentLanguage]) {
        console.warn(`No translations found for language: ${currentLanguage}`);
        return;
    }
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        if (translations[currentLanguage][key]) {
            element.innerHTML = translations[currentLanguage][key];
        }
    });
    // Sayfanın dilini güncelle (SEO ve erişilebilirlik için önemli)
    document.documentElement.lang = currentLanguage;

    // Aktif dil butonunu güncelle
    document.querySelectorAll('.lang-link').forEach(link => {
        link.classList.toggle('active', link.dataset.lang === currentLanguage);
    });
}

// main.js'teki setLanguage fonksiyonunu güncelleyin
function setLanguage(lang) {
    if (supportedLanguages.includes(lang)) {
        currentLanguage = lang;
        localStorage.setItem('selectedLanguage', lang);
        translatePage(); // async/await'e gerek yok
    }
}

// Sayfa ilk yüklendiğinde çalışacak fonksiyon
async function initializeI18n() {
    await loadTranslations();
    const savedLang = localStorage.getItem('selectedLanguage');
    const browserLang = navigator.language.split('-')[0];

    let initialLang = 'en'; // Varsayılan
    if (savedLang && supportedLanguages.includes(savedLang)) {
        initialLang = savedLang;
    } else if (supportedLanguages.includes(browserLang)) {
        initialLang = browserLang;
    }
    
    await setLanguage(initialLang);

    // Dropdown menü yönetimi
    const switcherBtn = document.getElementById('lang-switcher-btn');
    const dropdown = document.getElementById('language-dropdown');

    switcherBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Click olayının body'e yayılmasını engelle
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });

    // Dropdown içindeki linklere tıklama
    document.querySelectorAll('.lang-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            setLanguage(e.target.dataset.lang);
            dropdown.style.display = 'none';
        });
    });

    // Dışarıya tıklandığında menüyü kapat
    document.addEventListener('click', () => {
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
        }
    });
}

let fileQueue = []; 
// --- YENİ ---
const DEFAULT_QUALITY_SETTINGS = {
    jpeg: { default: 85, min: 50, max: 95 },
    png: { default: 90, min: 60, max: 100 },
    webp: { default: 80, min: 50, max: 95 },
    avif: { default: 60, min: 30, max: 80 },
    heic: { default: 80, min: 50, max: 95 }
};
let cropper = null;
let currentCropTarget = null;
let cropHistory = []; // Kırpma geçmişini tutacak dizi
let ultimateOriginalUrl = null; // En baştaki orijinal URL'yi saklayacak

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');
const initialUploadAreaHTML = uploadArea.innerHTML;

// ===============================================
// OLAY DİNLEYİCİLERİ (EVENT LISTENERS)
// ===============================================

fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) { handleFiles(files); }
});

uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.classList.remove('drag-over'); });
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) { handleFiles(files); }
});

document.body.addEventListener('click', async (e) => {
    // Tıklanan elementin en yakınındaki butonu buluyoruz. Bu, SVG'ye tıklandığında bile butonu hedef almamızı sağlar.
    const targetButton = e.target.closest('button');

    // --- DEĞİŞİKLİK: Olay dinleyici yeni butona göre güncellendi ---
    // Artık ayrı bir if bloğuna gerek yok, targetButton kontrolü ile birleşti.
    if (targetButton && targetButton.id === 'advanced-options-btn') {
        e.preventDefault();
        const slider = document.querySelector('.advanced-slider');
        const isHidden = slider.style.display === 'none';
        slider.style.display = isHidden ? 'flex' : 'none';
        return; 
    }

    // Tıklanan bir buton değilse VEYA modal kapatma elemanları değilse, işlemi durdur
    if (!targetButton && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('modal-close-btn')) {
        return;
    }

    // Kapatma tuşuna veya pencere dışına tıklandığında
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-btn')) {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            modal.remove();
        }
        return;
    }

    // Ana ekrandaki "Choose File" butonu
    if (targetButton && targetButton.id === 'choose-file-btn') {
        e.preventDefault();
        fileInput.click();
    }
    // Optimizasyon butonu
    if (targetButton && targetButton.id === 'optimize-all-btn') {
        startBatchOptimization();
    }
    // Hepsini indir butonu
    if (targetButton && targetButton.id === 'download-all-btn') {
        handleZipDownload();
    }
    // Yeniden başlat butonu
    if (targetButton && targetButton.id === 'clear-all-btn') {
        resetUI();
    }

    // "Undo" butonuna basıldığında
    if (targetButton && targetButton.id === 'crop-undo-btn') {
        if (cropHistory.length > 0) {
            const lastState = cropHistory.pop();
            const image = document.getElementById('image-to-crop');
            
            cropper.destroy();
            image.onload = () => {
                cropper = new Cropper(image, {
                    viewMode: 1,
                    background: false,
                    autoCropArea: 0.8,
                });
            };
            image.src = lastState.optimized;

            const compareButton = currentCropTarget.querySelector('.btn-compare');
            const cropButton = currentCropTarget.querySelector('.btn-crop');
            if (compareButton) {
                compareButton.dataset.optimizedUrl = lastState.optimized;
                compareButton.dataset.originalUrl = lastState.original;
            }
            if (cropButton) {
                cropButton.dataset.optimizedUrl = lastState.optimized;
            }
            if (cropHistory.length === 0) {
                targetButton.disabled = true;
            }
        }
    }

    // Silme butonuna basıldığında
    if (targetButton && targetButton.classList.contains('btn-delete-item')) {
        const indexToRemove = parseInt(targetButton.dataset.fileIndex, 10);
        fileQueue.splice(indexToRemove, 1);
        if (fileQueue.length === 0) {
            resetUI();
        } else {
            updateUIForFileList();
        }
        return; 
    }
    
    // "Copy" butonuna basıldığında
    if (targetButton && targetButton.classList.contains('btn-copy')) {
        const copyBtn = targetButton;
        const imageUrl = copyBtn.dataset.optimizedUrl;
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = await createImageBitmap(blob);
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(async (pngBlob) => {
                await navigator.clipboard.write([ new ClipboardItem({ 'image/png': pngBlob }) ]);
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = `✓`;
                copyBtn.classList.add('copied');
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.classList.remove('copied');
                }, 2000);
            }, 'image/png');
        } catch (error) {
            console.error('Failed to copy image:', error);
            alert('Failed to copy image. Your browser might not fully support this action.');
        }
    }

    // Compare butonuna basıldığında
    if (targetButton && targetButton.classList.contains('btn-compare')) {
        const originalUrl = targetButton.dataset.originalUrl;
        const optimizedUrl = targetButton.dataset.optimizedUrl;
        showComparisonModal(originalUrl, optimizedUrl);
    }

    // "Edit & Crop" butonuna basıldığında
    if (targetButton && targetButton.classList.contains('btn-crop')) {
        currentCropTarget = targetButton.closest('.action-icon-group');
        const originalUrl = targetButton.dataset.originalUrl;
        const optimizedUrl = targetButton.dataset.optimizedUrl;
        showCropModal(originalUrl, optimizedUrl);
    }

    // "Apply Crop" butonuna basıldığında
    if (targetButton && targetButton.id === 'apply-crop-btn') {
        if (!cropper) return;

        const currentState = {
            optimized: currentCropTarget.querySelector('.btn-crop').dataset.optimizedUrl,
            original: currentCropTarget.querySelector('.btn-compare').dataset.originalUrl
        };
        cropHistory.push(currentState);
        
        const undoBtn = document.getElementById('crop-undo-btn');
        if (undoBtn) undoBtn.disabled = false;
        
        let isCircle = document.querySelector('.crop-shape-btn[data-shape="circle"]').classList.contains('active');
        let croppedCanvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });

        if (isCircle) {
            const circleCanvas = document.createElement('canvas');
            const context = circleCanvas.getContext('2d');
            const size = Math.min(croppedCanvas.width, croppedCanvas.height);
            circleCanvas.width = size;
            circleCanvas.height = size;
            context.beginPath();
            context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
            context.closePath();
            context.clip();
            context.drawImage(croppedCanvas, 0, 0);
            croppedCanvas = circleCanvas;
        }

        const optimizedCroppedBlob = await new Promise(resolve => croppedCanvas.toBlob(resolve, 'image/png'));
        
        const sourceForOriginalCrop = currentCropTarget.querySelector('.btn-compare').dataset.originalUrl;
        
        const originalCroppedBlob = await new Promise((resolve, reject) => {
            const originalImage = new Image();
            originalImage.crossOrigin = "anonymous";
            originalImage.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const cropBoxData = cropper.getData(true);
                const scaleX = originalImage.naturalWidth / cropper.getImageData().naturalWidth;
                const scaleY = originalImage.naturalHeight / cropper.getImageData().naturalHeight;
                canvas.width = cropBoxData.width * scaleX;
                canvas.height = cropBoxData.height * scaleY;
                ctx.drawImage(originalImage, cropBoxData.x * scaleX, cropBoxData.y * scaleY, cropBoxData.width * scaleX, cropBoxData.height * scaleY, 0, 0, canvas.width, canvas.height);
                
                if(isCircle) {
                    const circleCanvas = document.createElement('canvas');
                    const context = circleCanvas.getContext('2d');
                    const size = Math.min(canvas.width, canvas.height);
                    circleCanvas.width = size;
                    circleCanvas.height = size;
                    context.beginPath();
                    context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
                    context.closePath();
                    context.clip();
                    context.drawImage(canvas, 0, 0);
                    circleCanvas.toBlob(resolve, 'image/png');
                } else {
                    canvas.toBlob(resolve, 'image/png');
                }
            };
            originalImage.onerror = reject;
            originalImage.src = sourceForOriginalCrop;
        });

        const newOptimizedUrl = URL.createObjectURL(optimizedCroppedBlob);
        const newOriginalUrl = URL.createObjectURL(originalCroppedBlob);

        const downloadLink = currentCropTarget.querySelector('.btn-download-item');
        const compareButton = currentCropTarget.querySelector('.btn-compare');
        const cropButton = currentCropTarget.querySelector('.btn-crop');
        const copyButton = currentCropTarget.querySelector('.btn-copy');
        const base64Button = currentCropTarget.querySelector('.btn-base64');

        if(downloadLink) downloadLink.href = newOptimizedUrl;

        if(compareButton) {
            compareButton.dataset.optimizedUrl = newOptimizedUrl;
            compareButton.dataset.originalUrl = newOriginalUrl; 
        }

        if(cropButton) {
            cropButton.dataset.optimizedUrl = newOptimizedUrl;
        }
        
        if(copyButton) {
            copyButton.dataset.optimizedUrl = newOptimizedUrl;
        }
        
        if (base64Button) {
            base64Button.dataset.optimizedUrl = newOptimizedUrl;
        }

        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            cropper.destroy();
            cropper = null;
            modal.remove();
        }
    }
    
    // Kırpma şekli butonlarına basıldığında
    if (targetButton && targetButton.classList.contains('crop-shape-btn')) {
        if (!cropper) return;
        const shape = targetButton.dataset.shape;
        const cropBox = document.querySelector('.cropper-view-box');
        const cropFace = document.querySelector('.cropper-face');
        
        if (shape === 'circle') {
            cropper.setAspectRatio(1/1);
            if (cropBox) cropBox.style.borderRadius = '50%';
            if (cropFace) cropFace.style.borderRadius = '50%';
        } else {
            cropper.setAspectRatio(NaN);
            if (cropBox) cropBox.style.borderRadius = '0';
            if (cropFace) cropFace.style.borderRadius = '0';
        }
        
        document.querySelectorAll('.crop-shape-btn').forEach(btn => btn.classList.remove('active'));
        targetButton.classList.add('active');
    }

    // "Get Base64" butonuna basıldığında
    if (targetButton && targetButton.classList.contains('btn-base64')) {
        const imageUrl = targetButton.dataset.optimizedUrl;
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            const reader = new FileReader();
            reader.onloadend = () => {
                showBase64Modal(reader.result);
            };
            reader.readAsDataURL(blob);

        } catch (error) {
            console.error('Failed to get Base64 data:', error);
            alert('Could not generate Base64 code.');
        }
    }
    
    // Kırpma penceresindeki "Reset" butonuna basıldığında
    if (targetButton && targetButton.id === 'crop-reset-btn') {
        if (!cropper) return;

        if (currentCropTarget) {
            const cropButton = currentCropTarget.querySelector('.btn-crop');
            const compareButton = currentCropTarget.querySelector('.btn-compare');
            const copyButton = currentCropTarget.querySelector('.btn-copy');
            const base64Button = currentCropTarget.querySelector('.btn-base64');
            const downloadLink = currentCropTarget.querySelector('.btn-download-item');

            const initialOriginalUrl = cropButton.dataset.originalUrl;
            const initialOptimizedUrl = cropButton.dataset.initialOptimizedUrl;

            if (cropButton) cropButton.dataset.optimizedUrl = initialOptimizedUrl;
            if (compareButton) {
                compareButton.dataset.originalUrl = initialOriginalUrl;
                compareButton.dataset.optimizedUrl = initialOptimizedUrl;
            }
            if (copyButton) copyButton.dataset.optimizedUrl = initialOptimizedUrl;
            if (base64Button) base64Button.dataset.optimizedUrl = initialOptimizedUrl;
            if (downloadLink) downloadLink.href = initialOptimizedUrl;
        }

        const undoBtn = document.getElementById('crop-undo-btn');
        if (undoBtn) {
            undoBtn.disabled = true;
            cropHistory = [];
        }

        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            cropper.destroy();
            cropper = null;
            modal.remove();
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initializeI18n(); // DİL FONKSİYONUNU BAŞLAT

    const menuToggle = document.getElementById('mobile-menu-toggle');
    if (!menuToggle) return;
    const mainNav = document.querySelector('.main-nav');
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
});

// BU YENİ OLAY DİNLEYİCİSİNİ EKLEYİN
// --- YENİ ---
document.body.addEventListener('change', (e) => {
    // Format radio butonları değiştiğinde
    if (e.target.name === 'format') {
        updateQualitySlider();
    }
    // Kalite slider'ı değiştiğinde
    if (e.target.id === 'quality-slider') {
        document.getElementById('quality-output').textContent = e.target.value;
    }
});
// --- YENİ KISIM SONU ---
// ===============================================
// ARAYÜZ VE YARDIMCI FONKSİYONLAR
// ===============================================

// main.js dosyanızdaki handleFiles fonksiyonunu bununla değiştirin
// main.js dosyanızın sonuna, diğer yardımcı fonksiyonların yanına ekleyin

// main.js dosyanızdaki mevcut sanitizeFilename fonksiyonunu bununla değiştirin

function sanitizeFilename(filename) {
    const extension = filename.slice(filename.lastIndexOf('.'));
    let baseName = filename.slice(0, filename.lastIndexOf('.'));

    baseName = baseName.toLowerCase();
    baseName = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    baseName = baseName.replace(/\s+/g, '-').replace(/-+/g, '-');
    
    // --- FIX IS ON THIS LINE ---
    // Corrected the regex from [^a-z0--9-] to [^a-z0-9-]
    baseName = baseName.replace(/[^a-z0-9-]/g, '');

    // EĞER temizlikten sonra dosya adı boş kalırsa, varsayılan bir isim ata
    if (!baseName) {
        baseName = `file-${Date.now()}`;
    }

    return baseName + extension;
}

function handleFiles(files) {
    fileQueue = [];
    cropHistory = []; // Yeni dosya yüklendiğinde geçmişi sıfırla
    for (const file of files) { 
        fileQueue.push(file); 
    }
    updateUIForFileList();
    
    fileInput.value = null; 
}

function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const createProgressBarHTML = (text) => `
    <div class="progress-bar-container">
        <div class="progress-bar-fill progress-bar-fill-indeterminate"></div>
        <span class="progress-bar-text">${text}</span>
    </div>
`;

function uploadWithProgress(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url, true);
        xhr.setRequestHeader('Content-Type', file.type);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percentComplete = (event.loaded / event.total) * 100;
                onProgress(percentComplete);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during upload.'));
        };

        xhr.send(file);
    });
}

// ... (your existing updateUIForFileList function and other functions) ...
// main.js dosyanızdaki mevcut updateUIForFileList fonksiyonunu bununla değiştirin

// main.js - updateUIForFileList fonksiyonu

function updateUIForFileList() {
    uploadArea.innerHTML = '';
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';

    let containsPng = false;

    fileQueue.forEach((file, index) => {
        if (file.name.toLowerCase().endsWith('.png')) {
            containsPng = true;
        }
        const formattedSize = formatFileSize(file.size);
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';

        // --- YENİ EKLENEN SATIR ---
        // Orijinal dosya adını daha sonra kullanmak üzere data niteliğinde saklıyoruz.
        listItem.dataset.originalFilename = file.name;

        listItem.innerHTML = `
            <div class="file-info">
                <span class="file-icon">📄</span>
                <div class="file-details">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formattedSize}</span>
                </div>
            </div>
            <div class="file-item-status">
                <span>Ready</span>
                <button class="icon-btn btn-delete-item" data-file-index="${index}" title="Remove file">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>`;
        fileListElement.appendChild(listItem);
    });
    
// main.js - updateUIForFileList fonksiyonu içindeki formatOptionsHTML değişkeni

const formatOptionsHTML = `
    <div class="format-options-header">
        <span class="format-label">Output Format:</span>
        <div class="tooltip-container">
            <span class="info-icon">?</span>
            
            <div class="tooltip-content">
                <div class="tooltip-grid-item">
                    <h4>JPEG (.jpg)</h4>
                    <p>Best for photographs.</p>
                </div>
                <div class="tooltip-grid-item">
                    <h4>PNG</h4>
                    <p>Best for graphics with transparency.</p>
                </div>
                <div class="tooltip-grid-item">
                    <h4>WebP</h4>
                    <p>Modern format for web use.</p>
                </div>
                <div class="tooltip-grid-item">
                    <h4>AVIF</h4>
                    <p>Newest format with highest compression.</p>
                </div>
                <div class="tooltip-grid-item">
                    <h4>HEIC</h4>
                    <p>Modern format by Apple, great for photos.</p>
                </div>
                <div class="tooltip-grid-item">
                    <h4>Favicon (PNG/ICO)</h4>
                    <p>Converts your image to a website icon.</p>
                </div>
            </div>
            </div>
    </div>
    <div class="format-options">
        <div class="radio-group"><input type="radio" id="jpeg" name="format" value="jpeg" checked><label for="jpeg">JPG</label></div>
        <div class="radio-group"><input type="radio" id="png" name="format" value="png"><label for="png">PNG</label></div>
        <div class="radio-group"><input type="radio" id="webp" name="format" value="webp"><label for="webp">WebP</label></div>
        <div class="radio-group"><input type="radio" id="avif" name="format" value="avif"><label for="avif">AVIF</label></div>
        <div class="radio-group"><input type="radio" id="heic" name="format" value="heic"><label for="heic">HEIC</label></div>
        <div class="radio-group"><input type="radio" id="favicon-png" name="format" value="favicon-png"><label for="favicon-png">Favicon (PNG)</label></div>
        <div class="radio-group"><input type="radio" id="favicon-ico" name="format" value="favicon-ico"><label for="favicon-ico">Favicon (ICO)</label></div>
    </div>
`;

    // --- YENİ: Kalite kaydırıcısı, artık butonların üzerinde yer alacak ---
    const advancedSliderHTML = `
        <div class="advanced-slider" style="display: none;">
            <label for="quality-slider">Quality:</label>
            <input type="range" id="quality-slider" name="quality" min="50" max="95" value="85">
            <output for="quality-slider" id="quality-output">85</output>
        </div>
    `;
    
    let smartTipHTML = '';
    if (containsPng) {
        smartTipHTML = `<div class="smart-tip">💡 <strong>Pro Tip:</strong> For photos or images without transparency, choosing the <strong>JPG</strong> format often provides the smallest file size.</div>`;
    }
    
    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';

    // --- DEĞİŞİKLİK: HTML yapısı güncellendi ---
    actionArea.innerHTML = formatOptionsHTML + advancedSliderHTML + `
        <div class="action-buttons-container initial-actions">
            <button class="btn btn-secondary" id="clear-all-btn">Start Over</button>
            <button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>
            
            <button class="icon-btn" id="advanced-options-btn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <span class="icon-tooltip">Advanced Settings</span>
            </button>
        </div>
    ` + smartTipHTML;
    
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);
    uploadArea.classList.add("file-selected");

    updateQualitySlider();
}

// BU YENİ FONKSİYONU EKLEYİN
// --- YENİ ---
function updateQualitySlider() {
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    const advancedContainer = document.querySelector('.advanced-slider');
    
    if (DEFAULT_QUALITY_SETTINGS[selectedFormat]) {
        const settings = DEFAULT_QUALITY_SETTINGS[selectedFormat];
        const qualitySlider = document.getElementById('quality-slider');
        const qualityOutput = document.getElementById('quality-output');
        
        qualitySlider.min = settings.min;
        qualitySlider.max = settings.max;
        qualitySlider.value = settings.default;
        qualityOutput.textContent = settings.default;
        
        advancedContainer.style.visibility = 'visible';
    } else {
        // favicon gibi formatlar için slider alanını gizle
        advancedContainer.style.visibility = 'hidden';
    }
}
// --- YENİ KISIM SONU ---

async function processSingleFile(file, listItem) {
    const statusElement = listItem.querySelector('.file-item-status');
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = qualitySlider ? qualitySlider.value : null;
    const originalObjectUrl = URL.createObjectURL(file);

    try {
        statusElement.innerHTML = createProgressBarHTML('Preparing...');
        
        const safeFilename = sanitizeFilename(file.name);
        const linkResponse = await fetch('/.netlify/functions/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: safeFilename, fileType: file.type }),
        });
        if (!linkResponse.ok) throw new Error('Could not get upload link.');
        const { uploadUrl, key } = await linkResponse.json();

        const uploadProgressBarContainer = `<div class="progress-bar-container"><div class="progress-bar-fill" style="width: 0%;"></div><span class="progress-bar-text">Uploading 0%</span></div>`;
        statusElement.innerHTML = uploadProgressBarContainer;
        const progressBarFill = listItem.querySelector('.progress-bar-fill');
        const progressBarText = listItem.querySelector('.progress-bar-text');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        await uploadWithProgress(uploadUrl, file, (percent) => {
            progressBarFill.style.width = `${percent.toFixed(0)}%`;
            progressBarText.textContent = `Uploading ${percent.toFixed(0)}%`;
        });
        await new Promise(resolve => setTimeout(resolve, 400));
        
        statusElement.innerHTML = createProgressBarHTML('Optimizing...');
        
        const optimizePayload = { key: key, outputFormat: selectedFormat };
        if (qualityValue) {
            optimizePayload.quality = qualityValue;
        }

        const optimizeResponse = await fetch('/.netlify/functions/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(optimizePayload),
        });
        if (!optimizeResponse.ok) {
             const errorData = await optimizeResponse.json().catch(() => ({ error: "Optimization failed." }));
             throw new Error(errorData.error);
        }
        const data = await optimizeResponse.json();

        // --- DÜZELTME BURADA: İndirme Adı Yeniden Oluşturuluyor ---
        // 1. Sakladığımız orijinal tam adı al. (örn: "你好世界.jpg")
        const originalFullName = listItem.dataset.originalFilename;
        // 2. Orijinal adın uzantısız kısmını al. (örn: "你好世界")
        const originalBaseName = originalFullName.slice(0, originalFullName.lastIndexOf('.'));
        // 3. Sunucudan gelen yeni dosyanın uzantısını al. (örn: ".webp")
        const newExtension = data.newFilename.slice(data.newFilename.lastIndexOf('.'));
        // 4. Kullanıcıya gösterilecek son indirme adını oluştur. (örn: "你好世界.webp")
        const finalDownloadName = originalBaseName + newExtension;

        const resultActions = `
            <div class="action-icon-group">
                <button class="icon-btn btn-compare" data-original-url="${originalObjectUrl}" data-optimized-url="${data.downloadUrl}" title="Compare">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3m-6 18v-5"></path><path d="M6 3h12"></path></svg>
                </button>
                <button 
                    class="icon-btn btn-crop" 
                    data-original-url="${originalObjectUrl}" 
                    data-optimized-url="${data.downloadUrl}" 
                    data-initial-optimized-url="${data.downloadUrl}"
                    title="Edit & Crop">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>
                </button>
                <button class="icon-btn btn-copy" data-optimized-url="${data.downloadUrl}" title="Copy Image">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <button class="icon-btn btn-base64" data-optimized-url="${data.downloadUrl}" title="Get Base64 Code">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                </button>
                <a href="${data.downloadUrl}" download="${finalDownloadName}" class="btn btn-download-item">Download</a>
            </div>
        `;
        const savings = ((data.originalSize - data.optimizedSize) / data.originalSize * 100);

        let successHTML;
        if (savings >= 1) {
            successHTML = `<span class="savings">✓ ${savings.toFixed(0)}% Saved</span> ${resultActions}`;
        } else {
            successHTML = `<span class="savings-info">✓ Already Optimized</span> ${resultActions}`;
        }
        statusElement.innerHTML = successHTML;

    } catch (error) {
        console.error('Processing failed for', file.name, ':', error);
        statusElement.innerHTML = `<span style="color: red;">Failed! ${error.message}</span>`;
        URL.revokeObjectURL(originalObjectUrl);
    }
}

async function startBatchOptimization() {
    console.log(`Starting optimization for ${fileQueue.length} files...`);
    const optimizeBtn = document.getElementById('optimize-all-btn');
    if (optimizeBtn) {
        optimizeBtn.textContent = 'Processing...';
        optimizeBtn.disabled = true;
    }
    const listItems = document.querySelectorAll('.file-list-item');
    const optimizationPromises = fileQueue.map((file, index) => {
        const listItem = listItems[index];
        return processSingleFile(file, listItem);
    });
    await Promise.all(optimizationPromises);
    updateMainButtonAfterCompletion();
}

function updateMainButtonAfterCompletion() {
    const actionArea = document.querySelector('.action-area');
    if (actionArea) {
        actionArea.innerHTML = `
            <div class="action-buttons-container">
                <button class="btn btn-primary" id="download-all-btn">Download All as .ZIP</button>
                <button class="btn btn-secondary" id="clear-all-btn">Start Over</button>
            </div>
        `;
    }
}

// main.js dosyanızdaki mevcut handleZipDownload fonksiyonunu bununla değiştirin
async function handleZipDownload() {
    const downloadAllBtn = document.getElementById('download-all-btn');
    if (!downloadAllBtn) return;
    console.log('Starting ZIP download process...');
    downloadAllBtn.textContent = 'Zipping...';
    downloadAllBtn.disabled = true;

    try {
        const zip = new JSZip();
        // --- DEĞİŞİKLİK BURADA BAŞLIYOR ---
        
        // Tüm dosya satırlarını (list items) alıyoruz.
        const listItems = document.querySelectorAll('.file-list-item');

        const fetchPromises = Array.from(listItems).map(item => {
            // Her satırdaki indirme linkini ve copy butonunu buluyoruz.
            const link = item.querySelector('a.btn-download-item');
            const copyButton = item.querySelector('.btn-copy');

            // En güncel URL için copy butonunun data niteliğini,
            // Dosya adı için ise indirme linkinin download niteliğini kullanıyoruz.
            const fileUrl = copyButton.dataset.optimizedUrl;
            const fileName = link.getAttribute('download');

            return fetch(fileUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch ${fileUrl}`);
                    return response.blob();
                })
                .then(blob => ({
                    name: fileName,
                    blob: blob
                }));
        });
        
        // --- DEĞİŞİKLİK BURADA BİTİYOR ---

        const files = await Promise.all(fetchPromises);
        files.forEach(file => { zip.file(file.name, file.blob); });
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const tempUrl = URL.createObjectURL(zipBlob);
        const tempLink = document.createElement('a');
        tempLink.href = tempUrl;
        tempLink.setAttribute('download', 'image-guy-optimized.zip');
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        URL.revokeObjectURL(tempUrl);

        downloadAllBtn.textContent = 'Download All as .ZIP';
        downloadAllBtn.disabled = false;

    } catch (error) {
        console.error('Failed to create ZIP file:', error);
        alert('An error occurred while creating the ZIP file. Please try downloading files individually.');
        downloadAllBtn.textContent = 'Download All as .ZIP';
        downloadAllBtn.disabled = false;
    }
}

// main.js dosyanızdaki resetUI fonksiyonunu bununla değiştirin
function resetUI() {
    console.log('Resetting UI to initial state.');
    fileQueue = [];
    cropHistory = []; // Arayüz sıfırlandığında geçmişi sıfırla
    uploadArea.innerHTML = initialUploadAreaHTML;
    uploadArea.classList.remove('file-selected');
}

function showComparisonModal(originalUrl, optimizedUrl) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <button class="modal-close-btn">&times;</button>
                <img-comparison-slider>
                    <img slot="first" src="${originalUrl}" />
                    <img slot="second" src="${optimizedUrl}" />
                </img-comparison-slider>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showCropModal(originalUrl, optimizedUrl) {
    // Geçmişi temizle ve en baştaki orijinali sakla
    // cropHistory = []; SILINDI
    ultimateOriginalUrl = originalUrl; 

    const modalHTML = `
        <div class="modal-overlay">
            <div class="crop-modal-content">
                <button class="modal-close-btn">&times;</button>
                <h2>Edit & Crop Image</h2>
                <div class="crop-image-container">
                    <img id="image-to-crop" src="${optimizedUrl}" data-original-url="${originalUrl}">
                </div>
                <div class="crop-actions">
                    <button class="btn btn-secondary crop-shape-btn" data-shape="rectangle">Rectangle</button>
                    <button class="btn btn-secondary crop-shape-btn" data-shape="circle">Circle</button>
                    
                    <button class="btn btn-secondary" id="crop-undo-btn" disabled>Undo</button>

                    <button class="btn btn-secondary" id="crop-reset-btn">
                        Reset All
                        <span class="tooltip-text">
                            Warning: All changes will be reset. You will revert to the initial optimized image.
                        </span>
                    </button>
                    <button class="btn btn-primary" id="apply-crop-btn">Apply Crop</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const image = document.getElementById('image-to-crop');
    const modalContent = document.querySelector('.crop-modal-content'); // Referans burada alınıyor
    image.crossOrigin = "anonymous";

    image.onload = () => {
         if (cropper) {
            cropper.destroy();
         }
         cropper = new Cropper(image, {
            viewMode: 1,
            background: false,
            autoCropArea: 0.8,
            ready: function () {
                // --- DÜZELTME BURADA ---
                // Elementi tekrar aramak yerine, zaten var olan referansı kullan.
                modalContent.classList.add('ready');
                document.querySelector('.crop-shape-btn[data-shape="rectangle"]').classList.add('active');
            }
        });
    };
    if (image.complete) {
        image.onload();
    }
}

// main.js dosyanızdaki mevcut showBase64Modal fonksiyonunu bununla değiştirin
function showBase64Modal(base64String) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content base64-modal-content">
                <button class="modal-close-btn">&times;</button>
                <h2>Base64 Code</h2>
                <p>You can use this code directly in your CSS or HTML.</p>
                <div class="base64-container">
                    <textarea class="base64-textarea" readonly>${base64String}</textarea>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="check-base64-btn">
                        <span>Check Code</span>
                    </button>
                    <button class="btn btn-primary" id="copy-base64-btn">
                        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        <span>Copy to Clipboard</span>
                    </button>
                    <span class="copy-success-msg">Copied!</span>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const textarea = document.querySelector('.base64-textarea');
    textarea.select();

    const copyBtn = document.getElementById('copy-base64-btn');
    const checkBtn = document.getElementById('check-base64-btn');
    const successMsg = document.querySelector('.copy-success-msg');

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(base64String).then(() => {
            successMsg.classList.add('visible');
            setTimeout(() => {
                successMsg.classList.remove('visible');
            }, 2000);
        });
    });

    checkBtn.addEventListener('click', () => {
        window.open(base64String, '_blank');
    });
}