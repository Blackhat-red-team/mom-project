import { connect } from "https://deno.land/x/amqp@v0.27.0/mod.ts";

// Environment variables/constants
const RABBIT_URL = Deno.env.get("RABBIT_URL");
const QUEUE_NAME = Deno.env.get("QUEUE_NAME");

async function receiveRatesFromRabbitMQ() {
    if (!RABBIT_URL || !QUEUE_NAME) {
        console.error("Environment variables RABBIT_URL or QUEUE_NAME are not set.");
        return;
    }

    try {
        console.log("Attempting to connect to RabbitMQ...");
        const connection = await connect(RABBIT_URL);
        const channel = await connection.openChannel();
        await channel.declareQueue({ queue: QUEUE_NAME, durable: true });

        console.log(`[*] Waiting for messages in ${QUEUE_NAME}.`);

        // Deno Deploy is a serverless environment, so we use a different pattern
        // The consumer will run until it processes a message or times out.
        // For a continuous worker, we use a loop or a dedicated Deno Deploy feature (which we simulate here).
        
        await channel.consume({ queue: QUEUE_NAME }, async (message) => {
            if (message.content) {
                const rates = JSON.parse(new TextDecoder().decode(message.content));
                const timestamp = new Date().toISOString();

                // 1. Process the message (The Core MOM Functionality)
                console.log(`[x] Received rates at ${timestamp}`);
                
                // 2. Log the processed data to the console
                const logEntry = `[${timestamp}] Successfully processed new rates. Base: ${rates.USD ? 'USD' : 'N/A'}, SAR Rate: ${rates.SAR || 'N/A'}`;
                console.log(logEntry);
                
                // Acknowledge the message
                await channel.ack({ deliveryTag: message.deliveryTag });
            }
        });

        // Keep the process alive for a long time to simulate a worker
        console.log("Consumer is running. Press Ctrl+C to stop.");
        await new Promise(() => {}); // Keep the process alive indefinitely

    } catch (error) {
        console.error('Error in Consumer:', error.message);
        // In Deno Deploy, the process will likely restart automatically
        console.log('Consumer process terminated. Check deployment logs for automatic restart.');
    }
}

// Start the consumer
receiveRatesFromRabbitMQ();

