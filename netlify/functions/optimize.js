// Dosya Adı: netlify/functions/optimize.js (Çoklu Dosya İşleyen Son Hali)

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require('sharp');
const multipart = require('parse-multipart-data');

exports.handler = async (event, context) => {
    const s3Client = new S3Client({ 
        region: process.env.IMAGEGUY_AWS_S3_REGION,
        credentials: {
            accessKeyId: process.env.IMAGEGUY_AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.IMAGEGUY_AWS_SECRET_ACCESS_KEY,
        }
    });

    try {
        const boundary = multipart.getBoundary(event.headers['content-type']);
        const bodyBuffer = Buffer.from(event.body, 'base64');
        const parts = multipart.parse(bodyBuffer, boundary);

        console.log(`Received ${parts.length} files to process.`);

        const processingPromises = parts.map(async (part) => {
            const { filename, data: fileDataBuffer } = part;

            console.log(`Optimizing file: ${filename}`);
            const optimizedImageBuffer = await sharp(fileDataBuffer)
                .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true, mozjpeg: true })
                .toBuffer();

            const newFilename = `optimized-${Date.now()}-${filename.replace(/\s+/g, '-')}`;
            
            const command = new PutObjectCommand({
                Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
                Key: newFilename,
                Body: optimizedImageBuffer,
                ContentType: 'image/jpeg',
            });

            await s3Client.send(command);
            console.log(`Successfully uploaded to S3: ${newFilename}`);

            const downloadUrl = `https://${process.env.IMAGEGUY_AWS_S3_BUCKET_NAME}.s3.${process.env.IMAGEGUY_AWS_S3_REGION}.amazonaws.com/${newFilename}`;
            
            return {
                originalFilename: filename,
                downloadUrl: downloadUrl,
                originalSize: fileDataBuffer.length,
                optimizedSize: optimizedImageBuffer.length,
            };
        });
        
        const results = await Promise.all(processingPromises);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "All files processed successfully!",
                results: results,
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