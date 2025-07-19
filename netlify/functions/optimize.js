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

// Helper function to convert a stream to a buffer
const streamToBuffer = (stream) => new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
});

exports.handler = async (event, context) => {
    try {
        // 1. Get the key of the original file from the frontend
        const { key } = JSON.parse(event.body);
        console.log(`Received key to optimize: ${key}`);

        // 2. Download the original file from S3
        const getCommand = new GetObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: key,
        });
        const response = await s3Client.send(getCommand);
        const fileDataBuffer = await streamToBuffer(response.Body);
        
        console.log(`Optimizing file: ${key}`);

        // 3. Process the file with 'sharp'
        const optimizedImageBuffer = await sharp(fileDataBuffer)
            .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true, mozjpeg: true })
            .toBuffer();

        const newFilename = key.replace('original-', 'optimized-');

        // 4. Upload the new, optimized file back to S3
        const putCommand = new PutObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: newFilename,
            Body: optimizedImageBuffer,
            ContentType: 'image/jpeg',
            ACL: 'public-read' // <-- THIS IS THE FIX! It makes the file publicly readable.
        });
        await s3Client.send(putCommand);
        console.log(`Successfully uploaded optimized file to S3: ${newFilename}`);

        const downloadUrl = `https://${process.env.IMAGEGUY_AWS_S3_BUCKET_NAME}.s3.${process.env.IMAGEGUY_AWS_S3_REGION}.amazonaws.com/${newFilename}`;

        // 5. Return the successful result and the new download link
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Optimization and upload successful!",
                downloadUrl: downloadUrl,
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