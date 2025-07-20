// Dosya Adı: netlify/functions/optimize.js (WebP ve AVIF için SSIM Entegreli)

const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require('sharp');
const stream = require('stream');
const ssim = require('ssim.js');

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
        
        console.log(`Smart optimizing file: ${originalFilename} to format: ${outputFormat}`);
        
        let optimizedImageBuffer;
        let contentType, newExtension;
        
        // PNG kayıpsız olduğu için SSIM döngüsüne girmez.
        if (outputFormat === 'png') {
            console.log('Applying lossless PNG compression.');
            optimizedImageBuffer = await sharp(fileDataBuffer)
                .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                .png({ quality: 90 })
                .toBuffer();
            contentType = 'image/png';
            newExtension = 'png';
        } else {
            // JPEG, WebP ve AVIF için AKILLI SIKIŞTIRMA (SSIM) MANTIĞI
            const ssimThreshold = 0.99;
            let bestBuffer = null;
            
            const originalSharp = sharp(fileDataBuffer);
            const metadata = await originalSharp.metadata();
            const originalRaw = await originalSharp.raw().toBuffer();
            const originalSsimData = { data: originalRaw, width: metadata.width, height: metadata.height };
            
            for (let quality = 95; quality >= 50; quality -= 5) {
                console.log(`Trying quality: ${quality} for format: ${outputFormat}...`);
                
                let sharpInstance = sharp(fileDataBuffer)
                    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true });

                // Formata göre sıkıştırma uygula
                switch (outputFormat) {
                    case 'webp':
                        sharpInstance = sharpInstance.webp({ quality: quality });
                        contentType = 'image/webp';
                        newExtension = 'webp';
                        break;
                    case 'avif':
                        sharpInstance = sharpInstance.avif({ quality: quality - 25 }); // AVIF kalitesi daha farklıdır, daha düşük değerler gerekir.
                        contentType = 'image/avif';
                        newExtension = 'avif';
                        break;
                    case 'jpeg':
                    default:
                        sharpInstance = sharpInstance.jpeg({ quality: quality, progressive: true, mozjpeg: true });
                        contentType = 'image/jpeg';
                        newExtension = 'jpg';
                        break;
                }

                const currentBuffer = await sharpInstance.toBuffer();
                const compressedRaw = await sharp(currentBuffer).raw().toBuffer();
                const compressedSsimData = { data: compressedRaw, width: metadata.width, height: metadata.height };

                const { mssim } = ssim(originalSsimData, compressedSsimData);
                console.log(`Quality: ${quality} -> SSIM Score: ${mssim}`);

                if (mssim >= ssimThreshold) {
                    bestBuffer = currentBuffer;
                } else {
                    console.log(`SSIM score dropped below threshold. Using last best quality.`);
                    break;
                }
            }
            optimizedImageBuffer = bestBuffer || fileDataBuffer;
        }

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
                message: "Smart optimization successful!",
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