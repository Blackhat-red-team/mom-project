import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Environment variables/constants
const API_URL = Deno.env.get("API_URL" ) || "https://api.exchangerate-api.com/v4/latest/USD";

// 1. Function to fetch currency rates from an external API
async function fetchRates( ) {
    try {
        const response = await fetch(API_URL);
        if (response.ok) {
            const data = await response.json();
            if (data && data.rates) {
                return data.rates;
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching currency rates from API:', error.message);
        return null;
    }
}

// 2. Function to serve static files (HTML, JS)
async function serveStaticFile(path) {
    try {
        // The path will be relative to the project root, e.g., "public/index.html"
        const filePath = path.startsWith('/') ? path.substring(1) : path;
        
        const fileContent = await Deno.readTextFile(filePath);
        let contentType = "text/plain";
        
        if (filePath.endsWith(".html")) {
            contentType = "text/html; charset=utf-8";
        } else if (filePath.endsWith(".js")) {
            contentType = "application/javascript";
        }
        
        return new Response(fileContent, {
            headers: { "content-type": contentType },
        });
    } catch (e) {
        return new Response("Not Found", { status: 404 });
    }
}

// 3. Main handler for the HTTP server
async function handler(req) {
    const url = new URL(req.url);

    // Handle the API POST request
    if (req.method === "POST" && url.pathname === "/api/fetch-and-send") {
        const rates = await fetchRates();

        if (rates) {
            return Response.json({ success: true, message: 'Rates fetched successfully.', rates: rates });
        } else {
            return Response.json({ success: false, message: 'Failed to fetch currency rates.' }, { status: 500 });
        }
    }

    // Handle GET requests for the root path and static files
    if (req.method === "GET") {
        if (url.pathname === "/") {
            return serveStaticFile("public/index.html");
        }
        
        // Handle requests for static files (e.g., /public/app.js)
        if (url.pathname.startsWith("/public/")) {
            return serveStaticFile(url.pathname);
        }
    }

    // All other requests
    return new Response("Not Found", { status: 404 });
}

// Start the server
serve(handler);
