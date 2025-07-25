let fileQueue = []; 
let cropper = null; // Kırpma kütüphanesi için genel değişken
let currentCropTarget = null; // Hangi dosya satırının düzenlendiğini takip etmek için

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');
const initialUploadAreaHTML = uploadArea.innerHTML;

// ===============================================
// OLAY DİNLEYİCİLERİ (EVENT LISTENERS)
// ===============================================

// Yükleme alanı içindeki dinamik butonlar için ana dinleyici
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

// Dosya input'u ile dosya seçimi
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) { handleFiles(files); }
});

// Sürükle-Bırak (Drag & Drop)
uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.classList.remove('drag-over'); });
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) { handleFiles(files); }
});

// Modal pencereleri ve Kırpma butonları için genel dinleyici
document.body.addEventListener('click', (e) => {
    // Compare ve Crop Modallarını kapatma
    if (e.target.classList.contains('modal-overlay') || e.target.classList.contains('modal-close-btn')) {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
            modal.remove();
        }
    }
    // Compare butonuna basıldığında
    if (e.target.classList.contains('btn-compare')) {
        const originalUrl = e.target.dataset.originalUrl;
        const optimizedUrl = e.target.dataset.optimizedUrl;
        showComparisonModal(originalUrl, optimizedUrl);
    }
    // "Edit & Crop" butonuna basıldığında
    if (e.target.classList.contains('btn-crop')) {
        currentCropTarget = e.target.closest('.result-buttons');
        const optimizedUrl = e.target.dataset.optimizedUrl;
        showCropModal(optimizedUrl);
    }
    // "Apply Crop" butonuna basıldığında
    if (e.target.id === 'apply-crop-btn') {
        if (!cropper) return;
        
        let isCircle = document.querySelector('.crop-shape-btn[data-shape="circle"]').classList.contains('active');
        let croppedCanvas = cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });

        if (isCircle) {
            const circleCanvas = document.createElement('canvas');
            const context = circleCanvas.getContext('2d');
            const size = croppedCanvas.width;
            circleCanvas.width = size;
            circleCanvas.height = size;
            context.beginPath();
            context.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
            context.closePath();
            context.clip();
            context.drawImage(croppedCanvas, 0, 0);
            croppedCanvas = circleCanvas;
        }

        croppedCanvas.toBlob((blob) => {
            const newUrl = URL.createObjectURL(blob);
            const downloadLink = currentCropTarget.querySelector('.btn-download-item');
            const compareButton = currentCropTarget.querySelector('.btn-compare');
            
            if(downloadLink) downloadLink.href = newUrl;
            if(compareButton) compareButton.dataset.optimizedUrl = newUrl;
            
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                cropper.destroy();
                cropper = null;
                modal.remove();
            }
        }, 'image/png');
    }
    // Kırpma şekli butonlarına basıldığında
    if (e.target.classList.contains('crop-shape-btn')) {
        if (!cropper) return;
        const shape = e.target.dataset.shape;
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
        e.target.classList.add('active');
    }
});

// ===============================================
// ARAYÜZ VE YARDIMCI FONKSİYONLAR
// ===============================================

function handleFiles(files) {
    fileQueue = [];
    for (const file of files) { fileQueue.push(file); }
    updateUIForFileList();
}

function updateUIForFileList() {
    uploadArea.innerHTML = '';
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';
    fileQueue.forEach(file => {
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

    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    actionArea.innerHTML = formatOptionsHTML + `<button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>`;
    
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);
    uploadArea.classList.add('file-selected');
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

function showCropModal(imageUrl) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="crop-modal-content">
                <button class="modal-close-btn">&times;</button>
                <h2>Edit & Crop Image</h2>
                <div class="crop-image-container">
                    <img id="image-to-crop" src="${imageUrl}">
                </div>
                <div class="crop-actions">
                    <button class="btn btn-secondary crop-shape-btn" data-shape="rectangle">Rectangle</button>
                    <button class="btn btn-secondary crop-shape-btn" data-shape="circle">Circle</button>
                    <button class="btn btn-primary" id="apply-crop-btn">Apply Crop</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const image = document.getElementById('image-to-crop');
    image.crossOrigin = "anonymous";

    image.onload = () => {
        if (cropper) { cropper.destroy(); }
         cropper = new Cropper(image, {
            viewMode: 1,
            background: false,
            autoCropArea: 0.8,
            ready: function () {
                document.querySelector('.crop-shape-btn[data-shape="rectangle"]').classList.add('active');
            }
        });
    };
    if (image.complete) {
        image.onload();
    }
}


// ===============================================
// ANA İŞLEM FONKSİYONLARI
// ===============================================

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

        let successHTML;
        const savings = ((data.originalSize - data.optimizedSize) / data.originalSize * 100);
        
        const resultActions = `
            <div class="result-buttons">
                <button class="btn-compare" data-original-url="${originalObjectUrl}" data-optimized-url="${data.downloadUrl}">Compare</button>
                <button class="btn-crop" data-optimized-url="${data.downloadUrl}">Edit & Crop</button>
                <a href="${data.downloadUrl}" download="optimized-${data.originalFilename}" class="btn btn-download-item">Download</a>
            </div>
        `;

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

// Bu kod bloğunu main.js dosyasının en altına ekleyin

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    if (!menuToggle) return; 

    const mainNav = document.querySelector('.main-nav');
    const openIcon = document.getElementById('menu-open-icon');
    const closeIcon = document.getElementById('menu-close-icon');
    const body = document.body;

    menuToggle.addEventListener('click', () => {
        const isActive = mainNav.classList.toggle('mobile-active');
        body.classList.toggle('mobile-menu-active'); // Arka planı karartmak için

        if (openIcon && closeIcon) {
            openIcon.style.display = isActive ? 'none' : 'block';
            closeIcon.style.display = isActive ? 'block' : 'none';
        }
    });
});