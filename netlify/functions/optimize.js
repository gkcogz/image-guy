// Dosya Adı: netlify/functions/optimize.js (Hızlı ve Yüksek Kaliteli Versiyon)

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
        const { key, outputFormat } = JSON.parse(event.body);
        const originalFilename = key.replace(/original-\d+-/, '');
        
        const getCommand = new GetObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: key,
        });
        const response = await s3Client.send(getCommand);
        const fileDataBuffer = await streamToBuffer(response.Body);
        
        console.log(`Optimizing file: ${originalFilename} to format: ${outputFormat}`);

        let sharpInstance = sharp(fileDataBuffer)
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });

        let contentType, newExtension;
        
        // SSIM döngüsü yerine, her format için tek seferde, yüksek kaliteli ayarlar kullanıyoruz.
        switch (outputFormat) {
            case 'png':
                sharpInstance = sharpInstance.png({ quality: 90, compressionLevel: 9 }); // Yüksek sıkıştırma eforu
                contentType = 'image/png';
                newExtension = 'png';
                break;
            case 'webp':
                sharpInstance = sharpInstance.webp({ quality: 80 }); // Yüksek kalite WebP
                contentType = 'image/webp';
                newExtension = 'webp';
                break;
            case 'avif':
                sharpInstance = sharpInstance.avif({ quality: 60 }); // Yüksek kalite AVIF
                contentType = 'image/avif';
                newExtension = 'avif';
                break;
            case 'jpeg':
            default:
                sharpInstance = sharpInstance.jpeg({ quality: 85, progressive: true, mozjpeg: true }); // Yüksek kalite JPEG
                contentType = 'image/jpeg';
                newExtension = 'jpg';
                break;
        }
        
        const optimizedImageBuffer = await sharpInstance.toBuffer();
        
        const baseFilename = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
        const newFilename = `optimized-${Date.now()}-${baseFilename.replace(/\s+/g, '-')}.${newExtension}`;

        const putCommand = new PutObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: newFilename,
            Body: optimizedImageBuffer,
            ContentType: contentType,
            ContentDisposition: `attachment; filename="${newFilename}"`
        });
        await s3Client.send(putCommand);
        console.log(`Successfully uploaded to S3: ${newFilename}`);

        const downloadUrl = `https://${process.env.IMAGEGUY_AWS_S3_BUCKET_NAME}.s3.${process.env.IMAGEGUY_AWS_S3_REGION}.amazonaws.com/${newFilename}`;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Optimization successful!",
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