// File Name: netlify/functions/get-upload-url.js (Complete and Hardened Version)

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({
    region: process.env.IMAGEGUY_AWS_S3_REGION,
    credentials: {
        accessKeyId: process.env.IMAGEGUY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.IMAGEGUY_AWS_SECRET_ACCESS_KEY,
    }
});

exports.handler = async (event, context) => {
    try {
        // ROBUSTNESS: Validate the request body and its content.
        let body;
        try {
            body = JSON.parse(event.body);
        } catch (e) {
            return {
                statusCode: 400, // Bad Request
                body: JSON.stringify({ error: 'Invalid JSON in request body.' }),
            };
        }

        const { filename, fileType } = body;

        // Check for the presence of required fields.
        if (!filename || !fileType) {
            return {
                statusCode: 400, // Bad Request
                body: JSON.stringify({ error: 'Missing required fields: filename or fileType.' }),
            };
        }

        // Create a unique key for the S3 object to prevent overwrites.
        const key = `original-${Date.now()}-${filename.replace(/\s+/g, '-')}`;

        const command = new PutObjectCommand({
            Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
            Key: key,
            ContentType: fileType,
        });

        // Generate the pre-signed URL with a 60-second expiry time.
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

        return {
            statusCode: 200,
            body: JSON.stringify({
                uploadUrl: uploadUrl,
                key: key,
            }),
        };
    } catch (error) {
        // SECURE ERROR HANDLING: Log the detailed error, but return a generic message to the client.
        console.error('Error creating pre-signed URL:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred while creating the upload URL.' }),
        };
    }
};