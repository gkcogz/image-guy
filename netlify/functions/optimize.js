// Required libraries
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const sharp = require('sharp');
const multipart = require('parse-multipart-data');

// Configure the S3 client using the environment variables set in Netlify
const s3Client = new S3Client({ 
    region: process.env.IMAGEGUY_AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.IMAGEGUY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.IMAGEGUY_AWS_SECRET_ACCESS_KEY,
    }
});

// The main serverless function handler
exports.handler = async (event, context) => {
    try {
        // 1. Parse the multipart/form-data request to extract the file
        const boundary = multipart.getBoundary(event.headers['content-type']);
        const bodyBuffer = Buffer.from(event.body, 'base64');
        const parts = multipart.parse(bodyBuffer, boundary);
        
        if (!parts || !parts[0] || !parts[0].data) {
            throw new Error("Could not parse file from form data.");
        }

        const file = parts[0];
        const { filename, data: fileDataBuffer } = file;

        console.log(`Optimizing file: ${filename}`);

        // 2. Process the image using the 'sharp' library
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
            
        // 3. Prepare the file for upload to S3
        const newFilename = `optimized-${Date.now()}-${filename.replace(/\s+/g, '-')}`;

        const command = new PutObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: newFilename,
            Body: optimizedImageBuffer,
            ContentType: 'image/jpeg',
        });

        // 4. Upload the optimized image to S3
        await s3Client.send(command);
        console.log(`Successfully uploaded to S3: ${newFilename}`);

        // 5. Create the public URL for the uploaded file
        const downloadUrl = `https://${process.env.IMAGEGUY_AWS_S3_BUCKET_NAME}.s3.${process.env.IMAGEGUY_AWS_S3_REGION}.amazonaws.com/${newFilename}`;

        // 6. Return a successful JSON response with the download URL
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