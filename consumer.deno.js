import { connect } from "https://deno.land/x/amqp@v0.24.0/mod.ts";

// Environment variables/constants
const RABBIT_URL = Deno.env.get("RABBIT_URL" );
const QUEUE_NAME = Deno.env.get("QUEUE_NAME");

/**
 * Attempts to connect to RabbitMQ, get a single message, process it, and close the connection.
 * This short-lived connection pattern is compatible with Deno Deploy's serverless environment.
 */
async function processSingleMessage() {
    if (!RABBIT_URL || !QUEUE_NAME) {
        console.error("Environment variables RABBIT_URL or QUEUE_NAME are not set.");
        return;
    }

    let connection;
    try {
        console.log("Attempting to connect to RabbitMQ for a single message...");
        
        // 1. Establish a short-lived connection
        connection = await connect(RABBIT_URL);
        const channel = await connection.openChannel();
        
        // Ensure the queue exists
        await channel.declareQueue({ queue: QUEUE_NAME, durable: true });

        // 2. Get a single message instead of consuming continuously
        const message = await channel.get({ queue: QUEUE_NAME });

        if (message) {
            if (message.content) {
                const rates = JSON.parse(new TextDecoder().decode(message.content));
                const timestamp = new Date().toISOString();

                // Process the message (The Core MOM Functionality)
                console.log(`[x] Received rates at ${timestamp}`);
                
                // Log the processed data to the console
                const logEntry = `[${timestamp}] Successfully processed new rates. Base: ${rates.USD ? 'USD' : 'N/A'}, SAR Rate: ${rates.SAR || 'N/A'}`;
                console.log(logEntry);
                
                // Acknowledge the message
                await channel.ack({ deliveryTag: message.deliveryTag });
            }
        } else {
            console.log(`No messages in queue: ${QUEUE_NAME}.`);
        }

    } catch (error) {
        console.error('Error in processSingleMessage:', error.message);
        // Do not re-throw, let the cron job finish gracefully
    } finally {
        // 3. IMPORTANT: Close the connection to ensure the isolate terminates
        if (connection) {
            console.log("Closing RabbitMQ connection.");
            await connection.close();
        }
    }
}

// 4. Use Deno.cron to schedule the message processing job
// This allows the process to run periodically as a background task on Deno Deploy.
// The schedule "*/1 * * * *" means "Run every minute". Adjust as needed.
Deno.cron(
    "RabbitMQ Message Processor", // Task name
    "*/1 * * * *", // Cron schedule (e.g., every minute)
    async () => {
        console.log("Running scheduled message processing job...");
        await processSingleMessage();
        console.log("Scheduled job finished.");
    }
);

// 5. Add a simple HTTP handler
// Deno Deploy expects an HTTP handler to be present. This ensures the deployment succeeds
// and provides a health check endpoint.
Deno.serve((_req) => {
    return new Response("RabbitMQ Consumer is running as a Deno Cron job.", { status: 200 });
});
