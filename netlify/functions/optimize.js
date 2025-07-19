// File: netlify/functions/optimize.js (Dependency Test Version)

exports.handler = async (event, context) => {
    // If this log appears, it means the function environment is working.
    console.log("Dependency-free test function started successfully!");

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Test successful! The function environment is OK."
        }),
    };
};