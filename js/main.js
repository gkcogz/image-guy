// Dosya Adı: js/main.js (Teşhis için güncellenmiş hali)

let fileQueue = []; 

const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');

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

// startBatchOptimization fonksiyonu içindeki try bloğunu güncelleyin

try {
    statusElement.innerHTML = `<div class="spinner-small"></div>`;

    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch('/.netlify/functions/optimize', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        // Sunucudan gelen hata mesajını daha detaylı loglayalım
        const errorData = await response.json();
        throw new Error(`Server error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log('Backend simple response:', data);

    // Arayüzü, backend'den gelen dosya adıyla güncelleyelim.
    // Bu, doğru dosya için doğru yanıtı aldığımızı kanıtlar.
    statusElement.innerHTML = `<span class="savings">✓ ${data.processedFile}</span>`;

} catch (error) {
    console.error('Optimization failed for', file.name, ':', error);
    statusElement.innerHTML = `<span style="color: red;">Failed!</span>`;
}