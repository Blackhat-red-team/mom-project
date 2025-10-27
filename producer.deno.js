import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// تم تحديث الرابط إلى نسخة 0.21.0
import { connect } from "https://deno.land/x/amqp@v0.21.0/mod.ts"; 

// Note: Deno uses the native Fetch API, so we don't need Axios.

// Environment variables/constants
const RABBIT_URL = Deno.env.get("RABBIT_URL" );
const QUEUE_NAME = Deno.env.get("QUEUE_NAME");
const API_URL = Deno.env.get("API_URL");

let channel;

// Function to connect to RabbitMQ
async function connectRabbitMQ() {
    try {
        console.log("Attempting to connect to RabbitMQ...");
        const connection = await connect(RABBIT_URL);
        channel = await connection.openChannel();
        await channel.declareQueue({ queue: QUEUE_NAME, durable: true });
        console.log('Connected to RabbitMQ and asserted queue:', QUEUE_NAME);
        return true;
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error.message);
        // In Deno Deploy, we let the runtime handle retries or restarts
        return false;
    }
}

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

// Function to send rates to RabbitMQ
async function sendRatesToRabbitMQ(rates) {
    if (!channel) {
        console.error('RabbitMQ channel not available. Reconnecting...');
        if (!(await connectRabbitMQ())) return false;
    }

    try {
        const msg = JSON.stringify(rates);
        const sent = await channel.publish(
            { routingKey: QUEUE_NAME },
            new TextEncoder().encode(msg),
            { deliveryMode: 2 } // persistent
        );

        console.log(`[x] Sent rates to queue: ${QUEUE_NAME}`);
        return true;
    } catch (error) {
        console.error('Error sending message to RabbitMQ:', error.message);
        return false;
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

    if (!channel) {
        await connectRabbitMQ();
    }

    const rates = await fetchRates();

    if (rates) {
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
