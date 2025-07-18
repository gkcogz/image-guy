// Dosya Adı: netlify/functions/optimize.js (Nihai ve Düzeltilmiş Hali)

const sharp = require('sharp');
const parser = require('aws-lambda-multipart-parser');

exports.handler = async (event, context) => {
    try {
        // --- BAŞLANGIÇ: KESİN ÇÖZÜM ---
        // Netlify, header isimlerini küçük harfe çevirebilir. Parser ise 'Content-Type' bekler.
        // Gelen isteğin header'ları arasında 'content-type'ı bulup, parser'ın anlayacağı
        // şekilde 'Content-Type' olarak kopyalayarak bu sorunu çözüyoruz.
        const contentTypeHeader = Object.keys(event.headers).find(
            (key) => key.toLowerCase() === 'content-type'
        );
        if (!contentTypeHeader) {
            throw new Error("Content-Type header is missing");
        }
        event.headers['Content-Type'] = event.headers[contentTypeHeader];
        // --- BİTİŞ: KESİN ÇÖZÜM ---

        const formData = await parser.parse(event);
        
        if (!formData.files || formData.files.length === 0) {
            throw new Error('No files found in form data. Parser may have failed.');
        }

        const file = formData.files[0];

        console.log(`Optimizing file: ${file.filename}`);

        const optimizedImageBuffer = await sharp(file.content)
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

        console.log(`Optimization complete for: ${file.filename}`);

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