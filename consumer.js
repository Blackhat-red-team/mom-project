const amqp = require('amqplib');


// Environment variables/constants
const RABBITMQ_URL = process.env.RABBIT_URL;
const QUEUE_NAME = process.env.QUEUE_NAME;


async function receiveRatesFromRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        console.log(`[*] Waiting for messages in ${QUEUE_NAME}. To exit press CTRL+C`);

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const rates = JSON.parse(msg.content.toString());
                const timestamp = new Date().toISOString();

                // 1. Process the message (The Core MOM Functionality)
                console.log(`[x] Received rates at ${timestamp}`);
                
                // 2. Log the processed data to the console (Deno Deploy is often stateless)
                const logEntry = `[${timestamp}] Successfully processed new rates. Base: ${rates.USD ? 'USD' : 'N/A'}, SAR Rate: ${rates.SAR || 'N/A'}`;
                console.log(logEntry);
                

                // Acknowledge the message to remove it from the queue
                channel.ack(msg);
            }
        }, {
            noAck: false // We want to manually acknowledge messages
        });
    } catch (error) {
        console.error('Error in Consumer:', error.message);
        console.log('Retrying connection in 5 seconds...');
        setTimeout(receiveRatesFromRabbitMQ, 5000); // Retry connection after 5 seconds
    }
}

// Start the consumer
receiveRatesFromRabbitMQ();
