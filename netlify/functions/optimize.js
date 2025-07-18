// Dosya Adı: netlify/functions/optimize.js (Güncellenmiş Hali)

const sharp = require('sharp');
const parser = require('aws-lambda-multipart-parser');

exports.handler = async (event, context) => {
    try {
        const formData = await parser.parse(event);
        
        // HATA AYIKLAMA İÇİN EKLENEN SATIR: Parser'ın ne döndürdüğünü görelim.
        console.log('Parsed formData object:', JSON.stringify(formData, null, 2));

        // DAHA SAĞLAM KONTROL: 'files' özelliğinin var olup olmadığını ve boş olmadığını kontrol edelim.
        if (!formData.files || formData.files.length === 0) {
            // Eğer dosya bulunamazsa, daha anlamlı bir hata fırlatalım.
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
        // Hatanın kendisini de loglayalım ki daha fazla detay görelim.
        console.error('Detailed error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};