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
    const { filename, fileType } = JSON.parse(event.body);
    const key = `original-${Date.now()}-${filename.replace(/\s+/g, '-')}`;

    const command = new PutObjectCommand({
        Bucket: process.env.IMAGEGUY_AWS_S3_BUCKET_NAME,
        Key: key,
        ContentType: fileType,
    });

    try {
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
        return {
            statusCode: 200,
            body: JSON.stringify({
                uploadUrl: uploadUrl,
                key: key,
            }),
        };
    } catch (error) {
        console.error('Error creating pre-signed URL:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Could not create upload URL.' }),
        };
    }
};