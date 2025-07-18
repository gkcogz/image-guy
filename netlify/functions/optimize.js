// Dosya Adı: netlify/functions/optimize.js (En Basit Yanıt Versiyonu)

const sharp = require('sharp');
const multipart = require('parse-multipart-data');

exports.handler = async (event, context) => {
    let filename = 'unknown';
    try {
        const boundary = multipart.getBoundary(event.headers['content-type']);
        const bodyBuffer = Buffer.from(event.body, 'base64');
        const parts = multipart.parse(bodyBuffer, boundary);

        if (!parts || !parts[0] || !parts[0].data) {
            throw new Error("Could not parse file from form data.");
        }

        const file = parts[0];
        filename = file.filename; // Dosya adını dış değişkene atayalım
        const fileDataBuffer = file.data;

        console.log(`Optimizing file: ${filename}`);

        const optimizedImageBuffer = await sharp(fileDataBuffer)
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true, mozjpeg: true })
            .toBuffer();

        console.log(`Optimization complete for: ${filename}`);

        // --- DEĞİŞİKLİK BURADA: MÜMKÜN OLAN EN BASİT YANIT ---
        // Headers objesini tamamen kaldırıyoruz.
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: "Success!",
                processedFile: filename 
            })
        };

    } catch (error) {
        console.error(`Detailed error for ${filename}:`, error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message, failedFile: filename })
        };
    }
};