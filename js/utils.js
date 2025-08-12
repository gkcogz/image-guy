// js/utils.js

export function sanitizeFilename(filename) {
    const extension = filename.slice(filename.lastIndexOf('.'));
    let baseName = filename.slice(0, filename.lastIndexOf('.'));
    baseName = baseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/[^a-z0-9-]/g, '');
    return (baseName || `file-${Date.now()}`) + extension;
}

export function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src; script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Script load error for ${src}`));
    document.head.appendChild(script);
});

export const loadStyle = (href) => new Promise((resolve, reject) => {
    if (document.querySelector(`link[href="${href}"]`)) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error(`Style load error for ${href}`));
    document.head.appendChild(link);
});