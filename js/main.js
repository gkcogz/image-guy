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
// Not: uploadArea'nın içeriği değişeceği için, olayı en dıştaki sabit elemente ekliyoruz.
uploadArea.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'BUTTON' && e.target.textContent.includes('Choose File')) {
        e.preventDefault();
        fileInput.click();
    }
});

// Kullanıcı Dosya Seçtiğinde Çalışacak Olay
fileInput.addEventListener('change', (event) => {
    const files = event.target.files; // Artık tek bir file değil, bir FileList alıyoruz
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
    const files = e.dataTransfer.files; // Bırakılan dosyaları al
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
    // Gelen dosyaları döngüye alıp kuyruğumuza ekleyelim
    for (const file of files) {
        fileQueue.push(file);
    }
    
    // Arayüzü yeni dosya listesiyle güncelleyelim
    updateUIForFileList();
}

// Dosya listesi için arayüzü oluşturan fonksiyon
function updateUIForFileList() {
    // Önce uploadArea'nın içini temizleyelim
    uploadArea.innerHTML = '';

    // Dosya listesini göstereceğimiz bir <ul> elementi oluşturalım
    const fileListElement = document.createElement('ul');
    fileListElement.className = 'file-list';

    // Kuyruktaki her bir dosya için bir liste elemanı (<li>) oluşturalım
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

    // "Optimize All" butonunu içeren alanı oluşturalım
    const actionArea = document.createElement('div');
    actionArea.className = 'action-area';
    actionArea.innerHTML = `<button class="btn btn-primary" id="optimize-all-btn">Optimize All (${fileQueue.length} files)</button>`;
    
    // Oluşturduğumuz listeyi ve butonu ana alana ekleyelim
    uploadArea.appendChild(fileListElement);
    uploadArea.appendChild(actionArea);

    // Genel görünümü iyileştirelim
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

// MEVCUT startBatchOptimization FONKSİYONUNU SİLİP BUNU EKLEYİN

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

            // Gerçek backend'e istek atıyoruz
            const response = await fetch('/.netlify/functions/optimize', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            // CEVAP OLARAK GELEN GÖRSELİ İŞLİYORUZ
            // 1. Cevabı bir 'blob' (dosya gibi bir nesne) olarak alıyoruz.
            const imageBlob = await response.blob();
            
            // 2. Bu blob için tarayıcıda geçici bir URL oluşturuyoruz.
            const downloadUrl = URL.createObjectURL(imageBlob);
            
            const originalSize = file.size;
            const newSize = imageBlob.size;
            const savings = ((originalSize - newSize) / originalSize * 100).toFixed(0);

            // 3. Arayüzü, gerçek sonuçlar ve indirme linki ile güncelliyoruz.
            const successHTML = `
                <span class="savings">✓ ${savings}% Saved</span>
                <a href="${downloadUrl}" download="optimized-${file.name}" class="btn btn-download-item">Download</a>
            `;
            statusElement.innerHTML = successHTML;

        } catch (error) {
            console.error('Optimization failed for', file.name, ':', error);
            statusElement.innerHTML = `<span style="color: red;">Failed!</span>`;
        }
    }
    updateMainButtonAfterCompletion();
}

// Tüm işlemler bittiğinde ana butonu güncelleyen fonksiyon (değişiklik yok, ama bütünlük için burada)
function updateMainButtonAfterCompletion() {
    const actionArea = document.querySelector('.action-area');
    if (actionArea) {
        actionArea.innerHTML = `<button class="btn" id="download-all-btn">Download All as .ZIP</button>`;
        const downloadAllBtn = document.getElementById('download-all-btn');
        downloadAllBtn.style.backgroundColor = '#28a745';
        downloadAllBtn.style.color = 'white';
        downloadAllBtn.style.width = '100%';
        downloadAllBtn.style.padding = '1rem 2rem';
        downloadAllBtn.style.fontSize = '1.2rem';
    }
}