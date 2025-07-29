
let fileQueue = []; 
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
    const targetButton = e.target.closest('button');

    // Tıklanan bir buton değilse veya modal kapatma değilse, işlemi durdur
    if (!targetButton && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('modal-close-btn')) {
        return;
    }

    // --- DÜZELTME BURADA ---
    // Butonu ID ile değil, metin içeriği ile tanıyoruz.
    if (targetButton && targetButton.textContent.includes('Choose File')) {
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
// "Undo" butonuna basıldığında
    if (targetButton && targetButton.id === 'crop-undo-btn') {
        if (cropHistory.length > 0) {
            // Geçmişten son durumu al ve kaldır
            const lastState = cropHistory.pop();

            // --- YENİ VE GÜVENİLİR MANTIK ---
            const image = document.getElementById('image-to-crop');
            
            // 1. Mevcut cropper'ı yok et.
            cropper.destroy();

            // 2. Resmin "onload" olayını tanımla. Resim yüklendiğinde yeni cropper'ı oluştur.
            // Bu, görsel hataları ve zamanlama sorunlarını engeller.
            image.onload = () => {
                cropper = new Cropper(image, {
                    viewMode: 1,
                    background: false,
                    autoCropArea: 0.8,
                    // "ready" callback'ine gerek yok çünkü sadece resmi değiştiriyoruz.
                });
            };

            // 3. Resim kaynağını bir önceki durumdaki URL ile değiştirerek yüklemeyi başlat.
            image.src = lastState.optimized;
            // --- YENİ MANTIK SONU ---

            // Ana ekrandaki butonların durumunu bir önceki hale geri döndür
            const compareButton = currentCropTarget.querySelector('.btn-compare');
            const cropButton = currentCropTarget.querySelector('.btn-crop');
            const copyButton = currentCropTarget.querySelector('.btn-copy');
            const base64Button = currentCropTarget.querySelector('.btn-base64');
            const downloadLink = currentCropTarget.querySelector('.btn-download-item');

            if (compareButton) {
                compareButton.dataset.optimizedUrl = lastState.optimized;
                compareButton.dataset.originalUrl = lastState.original;
            }
            if (cropButton) {
                cropButton.dataset.optimizedUrl = lastState.optimized;
            }
            // Diğer butonları da geri almamız gerekebilir, şimdilik bu şekilde bırakalım.
            // Gerekirse bu kısma copy, base64 ve download butonlarını da ekleriz.

            // Eğer geçmiş boşaldıysa, "Undo" butonunu tekrar pasif yap
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
    
    // Compare ve Crop Modallarını kapatma
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-btn')) {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            if (cropper) { cropper.destroy(); cropper = null; }
            modal.remove();
        }
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
        
        // --- DEĞİŞİKLİK BURADA ---
        // Orijinal URL'yi, referansı hiç değişmeyen crop butonunun kendisinden alıyoruz.
        const originalUrl = targetButton.dataset.originalUrl;
        const optimizedUrl = targetButton.dataset.optimizedUrl;
        
        showCropModal(originalUrl, optimizedUrl);
    }
// "Apply Crop" butonuna basıldığında ("Akıllı Karşılaştırma" mantığı ile)
    if (targetButton && targetButton.id === 'apply-crop-btn') {
        if (!cropper) return;

        // --- YENİ: Geçmişi Kaydet ---
        // İşleme başlamadan önce, o anki durumu geçmişe ekle.
        const currentState = {
            optimized: currentCropTarget.querySelector('.btn-crop').dataset.optimizedUrl,
            original: currentCropTarget.querySelector('.btn-compare').dataset.originalUrl
        };
        cropHistory.push(currentState);
        
        // "Undo" butonunu aktif et
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
        
        // --- DEĞİŞİKLİK 1: DOĞRU REFERANSI AL ---
        // Kırpılacak orijinal resim olarak, "compare" butonunda saklanan en güncel versiyonu kullan.
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
            // --- DEĞİŞİKLİK 2: DOĞRU KAYNAĞI KULLAN ---
            originalImage.src = sourceForOriginalCrop;
        });

        const newOptimizedUrl = URL.createObjectURL(optimizedCroppedBlob);
        const newOriginalUrl = URL.createObjectURL(originalCroppedBlob);

        const downloadLink = currentCropTarget.querySelector('.btn-download-item');
        const compareButton = currentCropTarget.querySelector('.btn-compare');
        const cropButton = currentCropTarget.querySelector('.btn-crop');
        const copyButton = currentCropTarget.querySelector('.btn-copy');

        if(downloadLink) downloadLink.href = newOptimizedUrl;

        // Compare butonunu yeni kırpılmış alanlarla güncelle
        if(compareButton) {
            compareButton.dataset.optimizedUrl = newOptimizedUrl;
            compareButton.dataset.originalUrl = newOriginalUrl; 
        }

        // Crop butonu sadece optimize edilmiş URL'yi günceller.
        if(cropButton) {
            cropButton.dataset.optimizedUrl = newOptimizedUrl;
        }
        
        if(copyButton) {
            copyButton.dataset.optimizedUrl = newOptimizedUrl;
        }
        const base64Button = currentCropTarget.querySelector('.btn-base64');
        if (base64Button) {
            base64Button.dataset.optimizedUrl = newOptimizedUrl;
        }
        
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            cropper.destroy()
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

        // --- BÖLÜM 1: ANA EKRANDAKİ BUTONLARIN DURUMUNU SIFIRLA ---
        // Bu işlem, Kırpma penceresi açıldığında saklanan `currentCropTarget` referansı üzerinden yapılır.
        if (currentCropTarget) {
            const cropButton = currentCropTarget.querySelector('.btn-crop');
            const compareButton = currentCropTarget.querySelector('.btn-compare');
            const copyButton = currentCropTarget.querySelector('.btn-copy');
            const base64Button = currentCropTarget.querySelector('.btn-base64');
            const downloadLink = currentCropTarget.querySelector('.btn-download-item');

            // Sakladığımız en baştaki URL'leri alıyoruz.
            const initialOriginalUrl = cropButton.dataset.originalUrl; // En baştaki orijinal.
            const initialOptimizedUrl = cropButton.dataset.initialOptimizedUrl; // En baştaki optimize edilmiş.

            // Tüm butonların URL'lerini bu başlangıç değerlerine geri döndür.
            if (cropButton) cropButton.dataset.optimizedUrl = initialOptimizedUrl;
            if (compareButton) {
                compareButton.dataset.originalUrl = initialOriginalUrl;
                compareButton.dataset.optimizedUrl = initialOptimizedUrl;
            }
            if (copyButton) copyButton.dataset.optimizedUrl = initialOptimizedUrl;
            if (base64Button) base64Button.dataset.optimizedUrl = initialOptimizedUrl;
            if (downloadLink) downloadLink.href = initialOptimizedUrl;
        }

        // --- BÖLÜM 2: KIRPMA PENCERESİNİN GÖRÜNÜMÜNÜ SIFIRLA ---
        const image = document.getElementById('image-to-crop');
        const ultimateOriginalUrl = image.dataset.originalUrl;
        
        // Önce mevcut cropper'ı yok et.
        cropper.destroy();

        // Resim yüklendiğinde yeni cropper'ı başlat.
        image.onload = () => {
            cropper = new Cropper(image, {
                viewMode: 1,
                background: false,
                autoCropArea: 0.8,
                ready: function () {
                    // Araç hazır olduğunda, şekil butonlarını varsayılana döndür.
                    document.querySelectorAll('.crop-shape-btn').forEach(btn => btn.classList.remove('active'));
                    document.querySelector('.crop-shape-btn[data-shape="rectangle"]').classList.add('active');
                }
            });
        };
        
        // Yüklemeyi başlat.
        image.src = ultimateOriginalUrl;

        // --- BÖLÜM 3: "UNDO" BUTONUNU VE GEÇMİŞİ SIFIRLA ---
        const undoBtn = document.getElementById('crop-undo-btn');
        if (undoBtn) {
            undoBtn.disabled = true;
            cropHistory = []; // Kırpma geçmişini temizle.
        }
    }
}); 

document.addEventListener('DOMContentLoaded', () => {
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

// ===============================================
// ARAYÜZ VE YARDIMCI FONKSİYONLAR
// ===============================================

// main.js dosyanızdaki handleFiles fonksiyonunu bununla değiştirin
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

function updateUIForFileList() {
    uploadArea.innerHTML = '';
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';
    
    let containsPng = false;

    // Her dosyayı index'i ile birlikte döngüye alıyoruz
    fileQueue.forEach((file, index) => {
        if (file.name.toLowerCase().endsWith('.png')) {
            containsPng = true;
        }
        const formattedSize = formatFileSize(file.size);
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        
        // Her dosya satırına bir "sil" butonu ekliyoruz.
        // data-file-index özelliği, hangi dosyanın silineceğini bilmemizi sağlar.
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
    
    const formatOptionsHTML = `
        <div class="format-options-header">
            <span class="format-label">Output Format:</span>
            <div class="tooltip-container">
                <span class="info-icon">?</span>
                <div class="tooltip-content">
                    <h4>JPEG (.jpg)</h4><p>Best for photographs.</p><hr>
                    <h4>PNG</h4><p>Best for graphics with transparency.</p><hr>
                    <h4>WebP</h4><p>Modern format for web use.</p><hr>
                    <h4>AVIF</h4><p>Newest format with highest compression.</p><hr>
                    <h4>Favicon (PNG/ICO)</h4><p>Converts your image to a website icon.</p>
                </div>
            </div>
        </div>
        <div class="format-options">
            <div class="radio-group"><input type="radio" id="jpeg" name="format" value="jpeg" checked><label for="jpeg">JPG</label></div>
            <div class="radio-group"><input type="radio" id="png" name="format" value="png"><label for="png">PNG</label></div>
            <div class="radio-group"><input type="radio" id="webp" name="format" value="webp"><label for="webp">WebP</label></div>
            <div class="radio-group"><input type="radio" id="avif" name="format" value="avif"><label for="avif">AVIF</label></div>
            <div class="radio-group"><input type="radio" id="favicon-png" name="format" value="favicon-png"><label for="favicon-png">Favicon (PNG)</label></div>
            <div class="radio-group"><input type="radio" id="favicon-ico" name="format" value="favicon-ico"><label for="favicon-ico">Favicon (ICO)</label></div>
        </div>
    `;

    let smartTipHTML = '';
    if (containsPng) {
        smartTipHTML = `
            <div class="smart-tip">
                💡 <strong>Pro Tip:</strong> For photos or images without transparency, choosing the <strong>JPG</strong> format often provides the smallest file size.
            </div>
        `;
    }
    
    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';

    // Butonları bir konteyner içine alarak "Start Over" butonunu ekliyoruz.
    // id="clear-all-btn" mevcut resetleme fonksiyonunu tetikleyecektir.
    actionArea.innerHTML = formatOptionsHTML + `
        <div class="action-buttons-container initial-actions">
            <button class="btn btn-secondary" id="clear-all-btn">Start Over</button>
            <button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>
        </div>
    ` + smartTipHTML;
    
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);
    uploadArea.classList.add("file-selected");
}

// main.js dosyanızdaki mevcut processSingleFile fonksiyonunu bununla değiştirin
async function processSingleFile(file, listItem) {
    const statusElement = listItem.querySelector('.file-item-status');
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    const originalObjectUrl = URL.createObjectURL(file);

    try {
        statusElement.textContent = 'Getting link...';
        const linkResponse = await fetch('/.netlify/functions/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, fileType: file.type }),
        });
        if (!linkResponse.ok) throw new Error('Could not get upload link.');
        const { uploadUrl, key } = await linkResponse.json();

        const progressBarContainer = `<div class="progress-bar-container"><div class="progress-bar-fill" style="width: 0%;"></div><span class="progress-bar-text">Uploading 0%</span></div>`;
        statusElement.innerHTML = progressBarContainer;
        const progressBarFill = listItem.querySelector('.progress-bar-fill');
        const progressBarText = listItem.querySelector('.progress-bar-text');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        await uploadWithProgress(uploadUrl, file, (percent) => {
            progressBarFill.style.width = `${percent.toFixed(0)}%`;
            progressBarText.textContent = `Uploading ${percent.toFixed(0)}%`;
        });
        await new Promise(resolve => setTimeout(resolve, 400));
        
        statusElement.innerHTML = `<div class="spinner-small"></div>`;
        const optimizeResponse = await fetch('/.netlify/functions/optimize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: key, outputFormat: selectedFormat }),
        });
        if (!optimizeResponse.ok) {
             const errorData = await optimizeResponse.json().catch(() => ({ error: "Optimization failed." }));
             throw new Error(errorData.error);
        }
        const data = await optimizeResponse.json();

        // --- DEĞİŞİKLİK BURADA: Yeni İkonlu Buton Grubu Oluşturuluyor ---
// main.js, processSingleFile fonksiyonu içindeki resultActions değişkenini güncelleyin
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
                <a href="${data.downloadUrl}" download="optimized-${data.originalFilename}" class="btn btn-download-item">Download</a>
            </div>
        `;

        let successHTML;
        const savings = ((data.originalSize - data.optimizedSize) / data.originalSize * 100);
        if (savings >= 0) {
            successHTML = `<span class="savings">✓ ${savings.toFixed(0)}% Saved</span> ${resultActions}`;
        } else {
            const increase = Math.abs(savings);
            successHTML = `<span class="savings-increase">⚠️ +${increase.toFixed(0)}% Increased</span> ${resultActions}`;
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

async function handleZipDownload() {
    const downloadAllBtn = document.getElementById('download-all-btn');
    if (!downloadAllBtn) return;
    console.log('Starting ZIP download process...');
    downloadAllBtn.textContent = 'Zipping...';
    downloadAllBtn.disabled = true;
    try {
        const zip = new JSZip();
        const downloadLinks = document.querySelectorAll('a.btn-download-item');
        const fetchPromises = Array.from(downloadLinks).map(link => 
            fetch(link.href)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch ${link.href}`);
                    return response.blob();
                })
                .then(blob => ({ name: link.getAttribute('download'), blob: blob }))
        );
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

// main.js dosyanızdaki mevcut showCropModal fonksiyonunu bununla değiştirin
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
    const modalContent = document.querySelector('.crop-modal-content');
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