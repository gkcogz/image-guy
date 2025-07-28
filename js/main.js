let fileQueue = []; 
let cropper = null;
let currentCropTarget = null;

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');
const initialUploadAreaHTML = uploadArea.innerHTML;

// ===============================================
// OLAY DİNLEYİCİLERİ (EVENT LISTENERS)
// ===============================================

uploadArea.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
        e.preventDefault();
        fileInput.click();
    }
    if (e.target.id === 'optimize-all-btn') {
        startBatchOptimization();
    }
    if (e.target.id === 'download-all-btn') {
        handleZipDownload();
    }
    if (e.target.id === 'clear-all-btn') {
        resetUI();
    }
});

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

// main.js dosyanızdaki mevcut document.body.addEventListener fonksiyonunu bununla değiştirin
document.body.addEventListener('click', async (e) => {
    const targetButton = e.target.closest('button');
    if (!targetButton && !e.target.classList.contains('modal-overlay') && !e.target.classList.contains('modal-close-btn')) return;

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
        const originalUrl = currentCropTarget.querySelector('.btn-compare').dataset.originalUrl;
        const optimizedUrl = targetButton.dataset.optimizedUrl;
        showCropModal(originalUrl, optimizedUrl);
    }
    // "Apply Crop" butonuna basıldığında ("Akıllı Karşılaştırma" mantığı ile)
    if (targetButton && targetButton.id === 'apply-crop-btn') {
        if (!cropper) return;
        
        let isCircle = document.querySelector('.crop-shape-btn[data-shape="circle"]').classList.contains('active');
        let croppedCanvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });

        // Dairesel kırpma seçildiyse, kare tuvali alıp daireye çeviriyoruz
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
            croppedCanvas = circleCanvas; // Artık kırpılmış tuvalimiz dairesel
        }

        const optimizedCroppedBlob = await new Promise(resolve => croppedCanvas.toBlob(resolve, 'image/png'));
        
        const originalUrl = document.getElementById('image-to-crop').dataset.originalUrl;
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
            originalImage.src = originalUrl;
        });

        const newOptimizedUrl = URL.createObjectURL(optimizedCroppedBlob);
        const newOriginalUrl = URL.createObjectURL(originalCroppedBlob);

        const downloadLink = currentCropTarget.querySelector('.btn-download-item');
        const compareButton = currentCropTarget.querySelector('.btn-compare');
        const cropButton = currentCropTarget.querySelector('.btn-crop');
        const copyButton = currentCropTarget.querySelector('.btn-copy');

        if(downloadLink) downloadLink.href = newOptimizedUrl;
        if(compareButton) {
            compareButton.dataset.optimizedUrl = newOptimizedUrl;
            compareButton.dataset.originalUrl = newOriginalUrl;
        }
        if(cropButton) {
            cropButton.dataset.optimizedUrl = newOptimizedUrl;
            cropButton.dataset.originalUrl = newOriginalUrl;
        }
        if(copyButton) {
            copyButton.dataset.optimizedUrl = newOptimizedUrl;
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
        // --- YENİ EKLENEN VE GÜNCELLENEN "RESET" MANTIĞI ---
    if (targetButton && targetButton.id === 'crop-reset-btn') {
        if (cropper) {
            // Cropper.js'in kendi sıfırlama fonksiyonunu kullanarak anlık değişiklikleri geri al
            cropper.reset(); 
            
            // Ayrıca, resmi en baştaki orijinal haline DÖNDÜRMEK için
            const originalUrl = cropper.element.dataset.originalUrl;
            cropper.replace(originalUrl);

            // Butonların görünümünü de sıfırla
            document.querySelectorAll('.crop-shape-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.crop-shape-btn[data-shape="rectangle"]').classList.add('active');
            const cropBox = document.querySelector('.cropper-view-box');
            const cropFace = document.querySelector('.cropper-face');
            if (cropBox) cropBox.style.borderRadius = '0';
            if (cropFace) cropFace.style.borderRadius = '0';
        }
    }
        // "Get Base64" butonuna basıldığında
    if (targetButton && targetButton.classList.contains('btn-base64')) {
        const imageUrl = targetButton.dataset.optimizedUrl;
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            // FileReader kullanarak blob'u Base64 string'ine çevir
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

function handleFiles(files) {
    fileQueue = [];
    for (const file of files) { fileQueue.push(file); }
    updateUIForFileList();
}

// main.js dosyanızdaki mevcut updateUIForFileList fonksiyonunu bununla değiştirin

function updateUIForFileList() {
    uploadArea.innerHTML = '';
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';
    
    let containsPng = false; // Yüklenenler arasında PNG olup olmadığını kontrol etmek için bir değişken

    fileQueue.forEach(file => {
        // Dosya adını küçük harfe çevirip .png ile bitip bitmediğini kontrol et
        if (file.name.toLowerCase().endsWith('.png')) {
            containsPng = true;
        }
        const formattedSize = formatFileSize(file.size);
        const listItem = document.createElement('li');
        listItem.className = 'file-list-item';
        listItem.innerHTML = `<div class="file-info"><span class="file-icon">📄</span><div class="file-details"><span class="file-name">${file.name}</span><span class="file-size">${formattedSize}</span></div></div><div class="file-item-status">Ready</div>`;
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

    // --- YENİ "AKILLI İPUCU" MANTIĞI ---
    let smartTipHTML = '';
    if (containsPng) {
        smartTipHTML = `
            <div class="smart-tip">
                💡 <strong>Pro Tip:</strong> For photos or images without transparency, choosing the <strong>JPG</strong> format often provides the smallest file size.
            </div>
        `;
    }
    // --- BİTİŞ ---

    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    // Akıllı ipucunu Optimize butonundan sonra ekliyoruz
    actionArea.innerHTML = formatOptionsHTML + `<button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>` + smartTipHTML;
    
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);
    uploadArea.classList.add("file-selected");
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            if (xhr.status >= 200 && xhr.status < 300) { resolve(xhr.response); }
            else { reject(new Error(`S3 upload failed: ${xhr.statusText}`)); }
        };
        xhr.onerror = () => reject(new Error('S3 upload failed due to a network error.'));
        xhr.send(file);
    });
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
                <button class="icon-btn btn-crop" data-original-url="${originalObjectUrl}" data-optimized-url="${data.downloadUrl}" title="Edit & Crop">
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

function resetUI() {
    console.log('Resetting UI to initial state.');
    fileQueue = [];
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
                    <button class="btn btn-secondary" id="crop-reset-btn">Reset</button>
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

document.body.addEventListener('click', async (e) => {
    // Tıklanan elementin bir buton veya en yakın üst elementinin bir buton olup olmadığını bulalım
    const targetButton = e.target.closest('button');

    // Modalları kapatma mantığı
    if (e.target.classList.contains('modal-overlay') || (targetButton && targetButton.classList.contains('modal-close-btn'))) {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            if (cropper) { // Eğer cropper aktifse, hafızadan sil
                cropper.destroy();
                cropper = null;
            }
            modal.remove();
        }
        return; // Başka bir işlem yapma
    }

    // Eğer tıklanan bir buton değilse, devam etme (istenmeyen hataları önler)
    if (!targetButton) return;

    // "Copy" butonu mantığı
    if (targetButton.classList.contains('btn-copy')) {
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

    // "Compare" butonu mantığı
    if (targetButton.classList.contains('btn-compare')) {
        const originalUrl = targetButton.dataset.originalUrl;
        const optimizedUrl = targetButton.dataset.optimizedUrl;
        showComparisonModal(originalUrl, optimizedUrl);
    }

    // "Edit & Crop" butonu mantığı
    if (targetButton.classList.contains('btn-crop')) {
        currentCropTarget = targetButton.closest('.action-icon-group');
        const originalUrl = currentCropTarget.querySelector('.btn-compare').dataset.originalUrl;
        const optimizedUrl = targetButton.dataset.optimizedUrl;
        showCropModal(originalUrl, optimizedUrl);
    }

    // "Apply Crop" butonu mantığı ("Akıllı Karşılaştırma" ile)
    if (targetButton.id === 'apply-crop-btn') {
        if (!cropper) return;
        
        const originalUrl = document.getElementById('image-to-crop').dataset.originalUrl;
        const cropDataCanvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });
        
        const optimizedCroppedBlob = await new Promise(resolve => cropDataCanvas.toBlob(resolve, 'image/png'));
        
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
                
                let isCircle = document.querySelector('.crop-shape-btn[data-shape="circle"]').classList.contains('active');
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
            originalImage.src = originalUrl;
        });

        const newOptimizedUrl = URL.createObjectURL(optimizedCroppedBlob);
        const newOriginalUrl = URL.createObjectURL(originalCroppedBlob);

        const downloadLink = currentCropTarget.querySelector('.btn-download-item');
        const compareButton = currentCropTarget.querySelector('.btn-compare');
        const cropButton = currentCropTarget.querySelector('.btn-crop');
        const copyButton = currentCropTarget.querySelector('.btn-copy');

        if(downloadLink) downloadLink.href = newOptimizedUrl;
        if(compareButton) {
            compareButton.dataset.optimizedUrl = newOptimizedUrl;
            compareButton.dataset.originalUrl = newOriginalUrl;
        }
        if(cropButton) {
            cropButton.dataset.optimizedUrl = newOptimizedUrl;
            cropButton.dataset.originalUrl = newOriginalUrl;
        }
        if(copyButton) {
            copyButton.dataset.optimizedUrl = newOptimizedUrl;
        }
        
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            cropper.destroy();
            cropper = null;
            modal.remove();
        }
    }

    // Kırpma şekli butonları
    if (targetButton.classList.contains('crop-shape-btn')) {
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
    
    // Kırpma penceresindeki "Reset" butonu
    if (targetButton.id === 'crop-reset-btn') {
        if (cropper) {
            cropper.reset();
            const originalUrl = cropper.element.dataset.originalUrl;
            cropper.replace(originalUrl);
            document.querySelectorAll('.crop-shape-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('.crop-shape-btn[data-shape="rectangle"]').classList.add('active');
            const cropBox = document.querySelector('.cropper-view-box');
            const cropFace = document.querySelector('.cropper-face');
            if (cropBox) cropBox.style.borderRadius = '0';
            if (cropFace) cropFace.style.borderRadius = '0';
        }
    }
});

// Bu yeni fonksiyonu main.js dosyasının en altına ekleyin
function showBase64Modal(base64String) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <button class="modal-close-btn">&times;</button>
                <h2>Base64 Code</h2>
                <p>You can use this code directly in your CSS or HTML.</p>
                <textarea class="base64-textarea" readonly>${base64String}</textarea>
                <button class="btn btn-primary" id="copy-base64-btn">Copy to Clipboard</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Otomatik olarak tüm metni seç
    const textarea = document.querySelector('.base64-textarea');
    textarea.select();

    // Kopyala butonuna işlevsellik ekle
    const copyBtn = document.getElementById('copy-base64-btn');
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(base64String).then(() => {
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = 'Copy to Clipboard';
            }, 2000);
        });
    });
}
