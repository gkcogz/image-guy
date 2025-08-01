// Dosya Adı: netlify/functions/optimize.js (Tam ve Güncellenmiş Hali)

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require('sharp');
const toIco = require('to-ico');
const heicConvert = require('heic-convert');

const s3Client = new S3Client({
    region: process.env.IMAGEGUY_AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.IMAGEGUY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.IMAGEGUY_AWS_SECRET_ACCESS_KEY,
    }
});

const DEFAULT_QUALITY = {
    jpeg: 85,
    png: 90,
    webp: 80,
    avif: 60,
    heic: 80
};

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
});

exports.handler = async (event, context) => {
    try {
        const { key, outputFormat, quality } = JSON.parse(event.body);
        const originalFilename = key.replace(/original-\d+-/, '');

        const getCommand = new GetObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: key,
        });
        const response = await s3Client.send(getCommand);
        const fileDataBuffer = await streamToBuffer(response.Body);
        const originalSize = fileDataBuffer.length;

        console.log(`Processing file: ${originalFilename} to format: ${outputFormat} with quality: ${quality || 'default'}`);

        let processingBuffer = fileDataBuffer;
        if (originalFilename.toLowerCase().endsWith('.heic') || originalFilename.toLowerCase().endsWith('.heif')) {
            console.log('HEIC input detected. Converting to PNG before optimization...');
            const outputBuffer = await heicConvert({
                buffer: fileDataBuffer,
                format: 'PNG'
            });
            processingBuffer = outputBuffer;
        }

        let optimizedImageBuffer;
        let contentType, newExtension;

        if (outputFormat === 'favicon-png' || outputFormat === 'favicon-ico') {
            if (outputFormat === 'favicon-png') {
                optimizedImageBuffer = await sharp(processingBuffer).resize({
                    width: 32, height: 32, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }
                }).png().toBuffer();
                contentType = 'image/png';
                newExtension = 'png';
            } else { // favicon-ico
                const sizes = [16, 24, 32, 48, 64];
                const pngBuffers = await Promise.all(
                    sizes.map(size => sharp(processingBuffer).resize({ width: size, height: size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
                );
                optimizedImageBuffer = await toIco(pngBuffers);
                contentType = 'image/x-icon';
                newExtension = 'ico';
            }
        } else {
            const finalQuality = parseInt(quality, 10) || DEFAULT_QUALITY[outputFormat];
            
            let sharpInstance = sharp(processingBuffer)
                .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });

            switch (outputFormat) {
                case 'png':
                    sharpInstance = sharpInstance.png({ quality: finalQuality });
                    contentType = 'image/png'; newExtension = 'png';
                    break;
                case 'webp':
                    sharpInstance = sharpInstance.webp({ quality: finalQuality });
                    contentType = 'image/webp'; newExtension = 'webp';
                    break;
                case 'avif':
                    sharpInstance = sharpInstance.avif({ quality: finalQuality });
                    contentType = 'image/avif'; newExtension = 'avif';
                    break;
                case 'heic':
                    sharpInstance = sharpInstance.heif({ quality: finalQuality, compression: 'av1' });
                    contentType = 'image/heic'; newExtension = 'heic';
                    break;
                case 'jpeg':
                default:
                    sharpInstance = sharpInstance.jpeg({ quality: finalQuality, progressive: true, mozjpeg: true });
                    contentType = 'image/jpeg'; newExtension = 'jpg';
                    break;
            }
            optimizedImageBuffer = await sharpInstance.toBuffer();
        }

        const optimizedSize = optimizedImageBuffer.length;
        let finalBuffer, finalKey, finalContentType, finalFilename;

        if (optimizedSize >= originalSize) {
            console.log(`Optimization skipped for ${originalFilename}, original is better.`);
            finalBuffer = fileDataBuffer;
            finalKey = key;
            finalContentType = response.ContentType;
            finalFilename = originalFilename;
        } else {
            console.log(`Optimization successful for ${originalFilename}.`);
            const baseFilename = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
            finalFilename = `${baseFilename.replace(/\s+/g, '-')}.${newExtension}`;
            
            finalBuffer = optimizedImageBuffer;
            finalKey = finalFilename;
            finalContentType = contentType;

            const putCommand = new PutObjectCommand({
                Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
                Key: finalKey,
                Body: finalBuffer,
                ContentType: finalContentType,
                ContentDisposition: `attachment; filename="${finalFilename}"`
            });
            await s3Client.send(putCommand);
        }
        
        const downloadUrl = `https://${process.env.IMAGEGUY_AWS_S3_BUCKET_NAME}.s3.${process.env.IMAGEGUY_AWS_S3_REGION}.amazonaws.com/${encodeURIComponent(finalKey)}`;

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Process complete!",
                downloadUrl: downloadUrl,
                originalFilename: originalFilename,
                newFilename: finalFilename,
                originalSize: originalSize,
                optimizedSize: finalBuffer.length,
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