// Dosya Adı: netlify/functions/optimize.js

const sharp = require('sharp');
const parser = require('aws-lambda-multipart-parser');

exports.handler = async (event, context) => {
    try {
        // 1. Frontend'den gelen dosyayı 'parser' yardımıyla oku.
        const formData = await parser.parse(event);
        const file = formData.files[0];

        if (!file) {
            throw new Error('No file uploaded.');
        }

        console.log(`Optimizing file: ${file.filename}`);

        // 2. 'sharp' kütüphanesini kullanarak görseli işle.
        const optimizedImageBuffer = await sharp(file.content)
            .resize({ 
                width: 1920, // Maksimum genişlik 1920px
                height: 1920, // Maksimum yükseklik 1920px
                fit: 'inside', // Oranı koruyarak bu boyutların içine sığdır
                withoutEnlargement: true // Küçük resimleri büyütme
            })
            .jpeg({ 
                quality: 80, // JPEG kalitesi %80
                progressive: true, // Web için daha hızlı yüklenen format
                mozjpeg: true // Daha iyi sıkıştırma için mozjpeg motorunu kullan
            })
            .toBuffer(); // İşlenmiş görseli bir buffer olarak al

        console.log(`Optimization complete for: ${file.filename}`);

        // 3. Optimize edilmiş görseli Base64 formatında geri döndür.
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'image/jpeg'
            },
            body: optimizedImageBuffer.toString('base64'),
            isBase64Encoded: true // Netlify'a bu verinin Base64 olduğunu söylüyoruz
        };

    } catch (error) {
        console.error('Error during optimization:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process image.' })
        };
    }
};