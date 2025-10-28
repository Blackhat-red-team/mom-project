import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import * as amqplib from "npm:amqplib";

// Environment variables/constants
const RABBIT_URL = Deno.env.get("RABBIT_URL" );
const QUEUE_NAME = Deno.env.get("QUEUE_NAME");
const API_URL = Deno.env.get("API_URL");

// Function to fetch currency rates from an external API
async function fetchRates() {
    try {
        console.log('Fetching latest currency rates...');
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

// Function to connect, send rates to RabbitMQ, and close the connection
async function sendRatesToRabbitMQ(rates) {
    if (!RABBIT_URL || !QUEUE_NAME) {
        console.error("Environment variables RABBIT_URL or QUEUE_NAME are not set.");
        return false;
    }

    let connection;
    try {
        console.log("Attempting to connect to RabbitMQ...");
        
        // 1. Establish a short-lived connection
        connection = await amqplib.connect(RABBIT_URL);
        const channel = await connection.createChannel();
        
        // Ensure the queue exists
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        // Publish the message
        const msg = JSON.stringify(rates);
        channel.sendToQueue(
            QUEUE_NAME,
            new TextEncoder().encode(msg),
            { persistent: true }
        );

        console.log(`[x] Sent rates to queue: ${QUEUE_NAME}`);
        return true;
    } catch (error) {
        console.error('Error sending message to RabbitMQ:', error.message);
        return false;
    } finally {
        // 2. IMPORTANT: Close the connection after use
        if (connection) {
            console.log("Closing RabbitMQ connection.");
            await connection.close();
        }
    }
}

// Main handler for the HTTP server (API endpoint)
async function handler(req) {
    if (req.method !== "POST" || new URL(req.url).pathname !== "/api/fetch-and-send") {
        // Serve the public directory files if needed, but for now, only handle the API
        return new Response("Method Not Allowed or Path Not Found", { status: 405 });
    }

    if (!RABBIT_URL || !QUEUE_NAME || !API_URL) {
        return new Response("Environment variables not set.", { status: 500 });
    }

    const rates = await fetchRates();

    if (rates) {
        // The sendRatesToRabbitMQ function now handles connection and closing in a short-lived manner
        const success = await sendRatesToRabbitMQ(rates); 
        if (success) {
            return Response.json({ success: true, message: 'Rates sent to MOM queue successfully.', rates: rates });
        } else {
            return Response.json({ success: false, message: 'Failed to send rates to MOM queue.' }, { status: 500 });
        }
    } else {
        return Response.json({ success: false, message: 'Failed to fetch currency rates.' }, { status: 500 });
    }
}

// Start the server
console.log("Producer server starting...");
serve(handler);
