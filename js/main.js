// ===============================================
// Genel Değişkenler ve Durum Yönetimi
// ===============================================
let fileQueue = []; // Yüklenecek dosyaları tutacağımız bir dizi (kuyruk)

// ===============================================
// Element Seçicileri
// ===============================================
const fileInput = document.getElementById('file-input');
const uploadArea = document.querySelector('.upload-area');

// ===============================================
// Olay Dinleyicileri (Event Listeners)
// ===============================================

// uploadArea içindeki 'Choose File' butonuna tıklanınca gizli input'u tetikle
uploadArea.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
        e.preventDefault();
        fileInput.click();
    }
});

// Kullanıcı Dosya Seçtiğinde Çalışacak Olay
fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        handleFiles(files);
    }
});

// Sürükle-Bırak (Drag & Drop) Olayları
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

// Dinamik olarak oluşturulan "Optimize All" butonunu dinlemek için olay delegasyonu
uploadArea.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'optimize-all-btn') {
        startBatchOptimization();
    }
});


// ===============================================
// Fonksiyonlar
// ===============================================

// Seçilen Dosyaları İşleyen ve Arayüzü Güncelleyen Ana Fonksiyon
function handleFiles(files) {
    for (const file of files) {
        fileQueue.push(file);
    }
    updateUIForFileList();
}

// Dosya listesi için arayüzü oluşturan fonksiyon
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

// Dosya boyutunu formatlayan yardımcı fonksiyon
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Hatanın düzeltildiği async fonksiyon
async function startBatchOptimization() {
    console.log(`Optimizing ${fileQueue.length} files...`);
    const optimizeBtn = document.getElementById('optimize-all-btn');
    if (optimizeBtn) {
        optimizeBtn.textContent = 'Optimizing...';
        optimizeBtn.disabled = true;
    }

    const listItems = document.querySelectorAll('.file-list-item');

    for (const [index, file] of fileQueue.entries()) {
        const listItem = listItems[index];
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
            console.log('Backend simple response:', data);

            // Arayüzü, backend'den gelen dosya adıyla güncelleyelim.
            statusElement.innerHTML = `<span class="savings">✓ ${data.processedFile}</span>`;

        } catch (error) {
            console.error('Optimization failed for', file.name, ':', error);
            statusElement.innerHTML = `<span style="color: red;">Failed!</span>`;
        }
    }

    const actionArea = document.querySelector('.action-area');
    if(actionArea) {
        actionArea.innerHTML = '<strong>Diagnosis Complete. Check the console and UI.</strong>';
    }
}