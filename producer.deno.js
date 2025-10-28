import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Environment variables/constants
// Note: RABBIT_URL and QUEUE_NAME are no longer needed
const API_URL = Deno.env.get("API_URL" ) || "https://api.exchangerate-api.com/v4/latest/USD";

// Function to fetch currency rates from an external API
async function fetchRates( ) {
    try {
        console.log('Fetching latest currency rates from:', API_URL);
        // Note: Deno's native fetch is used here
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            if (data && data.rates) {
                console.log('Rates fetched successfully.');
                return data.rates;
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching currency rates from API:', error.message);
        return null;
    }
}

// Main handler for the HTTP server
async function handler(req) {
    const url = new URL(req.url);

    // 1. Handle GET requests for static files (index.html and app.js)
    if (req.method === "GET") {
        if (url.pathname === "/") {
            try {
                // Serve the main HTML file
                const htmlContent = await Deno.readTextFile("./public/index.html");
                return new Response(htmlContent, {
                    headers: { "content-type": "text/html; charset=utf-8" },
                });
            } catch (e) {
                console.error("Error serving index.html:", e.message);
                return new Response("Internal Server Error", { status: 500 });
            }
        }

        // Handle requests for static files (e.g., app.js)
        if (url.pathname.startsWith("/public/")) {
            try {
                // Remove the leading slash to get the relative path from the project root
                const filePath = url.pathname.substring(1); 
                const fileContent = await Deno.readTextFile(filePath);
                let contentType = "text/plain";
                if (filePath.endsWith(".js")) {
                    contentType = "application/javascript";
                }
                // Add more content types if needed (e.g., CSS)
                return new Response(fileContent, {
                    headers: { "content-type": contentType },
                });
            } catch (e) {
                console.error("Error serving static file:", e.message);
                return new Response("Not Found", { status: 404 });
            }
        }
    }

    // 2. Handle POST request for the API endpoint
    if (req.method === "POST" && url.pathname === "/api/fetch-and-send") {
        const rates = await fetchRates();

        if (rates) {
            // Return the rates directly to the client
            return Response.json({ success: true, message: 'Rates fetched successfully.', rates: rates });
        } else {
            return Response.json({ success: false, message: 'Failed to fetch currency rates.' }, { status: 500 });
        }
    }

    // 3. All other requests
    return new Response("Not Found", { status: 404 });
}

// Start the server
console.log("Producer server starting...");
serve(handler);
