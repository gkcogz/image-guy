// Dosya Adı: netlify/functions/optimize.js (İndirmeyi Zorlayan Son Hali)

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require('sharp');
const stream = require('stream');

const s3Client = new S3Client({ 
    region: process.env.IMAGEGUY_AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.IMAGEGUY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.IMAGEGUY_AWS_SECRET_ACCESS_KEY,
    }
});

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
});

exports.handler = async (event, context) => {
    try {
        const { key } = JSON.parse(event.body);
        const originalFilename = key.replace(/original-\d+-/, ''); // Orijinal dosya adını alalım
        
        const getCommand = new GetObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: key,
        });
        const response = await s3Client.send(getCommand);
        const fileDataBuffer = await streamToBuffer(response.Body);
        
        console.log(`Optimizing file: ${originalFilename}`);

        const optimizedImageBuffer = await sharp(fileDataBuffer)
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true, mozjpeg: true })
            .toBuffer();

        const newFilename = `optimized-${Date.now()}-${originalFilename.replace(/\s+/g, '-')}`;

        const putCommand = new PutObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: newFilename,
            Body: optimizedImageBuffer,
            ContentType: 'image/jpeg',
            // --- DEĞİŞİKLİK BURADA ---
            // Bu başlık, tarayıcıya dosyayı göstermek yerine indirmesini söyler.
            ContentDisposition: `attachment; filename="${newFilename}"`
        });
        await s3Client.send(putCommand);
        console.log(`Successfully uploaded to S3: ${newFilename}`);

        const downloadUrl = `https://${process.env.IMAGEGUY_AWS_S3_BUCKET_NAME}.s3.${process.env.IMAGEGUY_AWS_S3_REGION}.amazonaws.com/${newFilename}`;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Optimization and upload successful!",
                downloadUrl: downloadUrl,
                originalFilename: originalFilename,
                originalSize: fileDataBuffer.length,
                optimizedSize: optimizedImageBuffer.length,
            }),
        };

    } catch (error) {
        console.error('Detailed error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};