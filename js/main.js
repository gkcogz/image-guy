// ===============================================
// Genel Değişkenler ve Durum Yönetimi
// ===============================================
let fileQueue = [];

// ===============================================
// Element Seçicileri
// ===============================================
const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');

// ===============================================
// Olay Dinleyicileri (Event Listeners)
// ===============================================

uploadArea.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
        e.preventDefault();
        fileInput.click();
    }
});

fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFiles(files);
    }
});

uploadArea.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'optimize-all-btn') {
        startBatchOptimization();
    }
});

// ===============================================
// Fonksiyonlar
// ===============================================

function handleFiles(files) {
    for (const file of files) {
        fileQueue.push(file);
    }
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
        listItem.innerHTML = `
            <div class="file-info">
                <span class="file-icon">📄</span>
                <div class="file-details">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formattedSize}</span>
                </div>
            </div>
            <div class="file-item-status">Waiting...</div>
        `;
        fileListElement.appendChild(listItem);
    });

    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    actionArea.innerHTML = `<button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>`;
    
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

// Tek bir dosyayı işleyen yardımcı fonksiyon
async function processSingleFile(file, listItem) {
    const statusElement = listItem.querySelector('.file-item-status');
    try {
        statusElement.innerHTML = `<div class="spinner-small"></div>`;

        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/.netlify/functions/optimize', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Server error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        console.log('Backend response with S3 URL:', data);

        const savings = ((file.size - data.optimizedSize) / file.size * 100).toFixed(0);
        
        const successHTML = `
            <span class="savings">✓ ${savings}% Saved</span>
            <a href="${data.downloadUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-download-item">Download</a>
        `;
        statusElement.innerHTML = successHTML;

    } catch (error) {
        console.error('Optimization failed for', file.name, ':', error);
        statusElement.innerHTML = `<span style="color: red;">Failed!</span>`;
    }
}

// main.js içindeki startBatchOptimization fonksiyonunun son hali

async function startBatchOptimization() {
    console.log(`Preparing to optimize ${fileQueue.length} files in a single request...`);
    const optimizeBtn = document.getElementById('optimize-all-btn');
    if (optimizeBtn) {
        optimizeBtn.textContent = 'Uploading & Optimizing...';
        optimizeBtn.disabled = true;
    }

    const listItems = document.querySelectorAll('.file-list-item');
    listItems.forEach(item => {
        const statusElement = item.querySelector('.file-item-status');
        statusElement.innerHTML = `<div class="spinner-small"></div>`;
    });

    try {
        const formData = new FormData();
        // Tüm dosyaları aynı anahtar ('images') ile FormData'ya ekliyoruz.
        fileQueue.forEach(file => {
            formData.append('images', file);
        });

        // Tek bir API isteği gönderiyoruz
        const response = await fetch('/.netlify/functions/optimize', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(`Server error: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        console.log('Backend response with all results:', data);

        // Sonuçları arayüzde gösteriyoruz
        data.results.forEach(result => {
            const originalFile = fileQueue.find(f => f.name === result.originalFilename);
            const fileIndex = fileQueue.indexOf(originalFile);
            const listItem = listItems[fileIndex];
            const statusElement = listItem.querySelector('.file-item-status');

            if (originalFile && statusElement) {
                const savings = ((originalFile.size - result.optimizedSize) / originalFile.size * 100).toFixed(0);
                const successHTML = `
                    <span class="savings">✓ ${savings}% Saved</span>
                    <a href="${result.downloadUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-download-item">Download</a>
                `;
                statusElement.innerHTML = successHTML;
            }
        });
        
        updateMainButtonAfterCompletion();

    } catch (error) {
        console.error('Batch optimization failed:', error);
        listItems.forEach(item => {
            const statusElement = item.querySelector('.file-item-status');
            statusElement.innerHTML = `<span style="color: red;">Failed!</span>`;
        });
    }
}