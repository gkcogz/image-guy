// Dosya Adı: netlify/functions/optimize.js (parse-multipart-data ile çalışan son hali)

const sharp = require('sharp');
const multipart = require('parse-multipart-data');

exports.handler = async (event, context) => {
    try {
        // 1. 'Content-Type' başlığından 'boundary' (sınır) bilgisini alıyoruz.
        // Bu, isteğin parçalarının nerede başlayıp bittiğini söyler.
        const boundary = multipart.getBoundary(event.headers['content-type']);

        // 2. Netlify'dan gelen Base64 formatındaki gövdeyi (body) bir Buffer'a çeviriyoruz.
        // Buffer, ham ikili (binary) veriyi temsil eder.
        const bodyBuffer = Buffer.from(event.body, 'base64');

        // 3. Buffer'ı, sınır bilgisiyle birlikte ayrıştırıyoruz.
        const parts = multipart.parse(bodyBuffer, boundary);

        if (!parts || !parts[0] || !parts[0].data) {
            throw new Error("Could not parse file from form data. No parts found.");
        }

        // 'parts' dizisinin ilk elemanı bizim resim dosyamızdır.
        const file = parts[0];
        const { filename } = file;
        const fileDataBuffer = file.data;

        console.log(`Optimizing file: ${filename}`);

        // 4. 'sharp' ile görseli işliyoruz. Artık 'file.data' kullanıyoruz.
        const optimizedImageBuffer = await sharp(fileDataBuffer)
            .resize({ 
                width: 1920,
                height: 1920,
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ 
                quality: 80,
                progressive: true,
                mozjpeg: true
            })
            .toBuffer();

        console.log(`Optimization complete for: ${filename}`);

        // 5. Optimize edilmiş görseli geri döndürüyoruz.
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'image/jpeg' },
            body: optimizedImageBuffer.toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('Detailed error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};