const express = require('express');
const amqp = require('amqplib');
const axios = require('axios');

// Environment variables/constants
const PORT = 3000;
const RABBITMQ_URL = process.env.RABBIT_URL;
const QUEUE_NAME = process.env.QUEUE_NAME;
const API_URL = process.env.API_URL;

const app = express();
app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' directory

let channel;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log('Connected to RabbitMQ and asserted queue:', QUEUE_NAME);
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error.message);
        // Exit process if connection fails, Docker will restart it
        setTimeout(connectRabbitMQ, 5000); // Retry connection after 5 seconds
    }
}

// Function to fetch currency rates from an external API
async function fetchRates() {
    try {
        console.log('Fetching latest currency rates...');
        const response = await axios.get(API_URL);
        if (response.status === 200 && response.data && response.data.rates) {
            console.log('Rates fetched successfully.');
            return response.data.rates;
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
        console.error('RabbitMQ channel not available.');
        return false;
    }

    try {
        const msg = JSON.stringify(rates);
        const sent = channel.sendToQueue(QUEUE_NAME, Buffer.from(msg), { persistent: true });

        if (sent) {
            console.log(`[x] Sent rates to queue: ${QUEUE_NAME}`);
            return true;
        } else {
            console.error('Message was not accepted by the queue (channel is full).');
            return false;
        }
    } catch (error) {
        console.error('Error sending message to RabbitMQ:', error.message);
        return false;
    }
}

// API endpoint to trigger rate fetching and message sending
app.post('/api/fetch-and-send', async (req, res) => {
    const rates = await fetchRates();

    if (rates) {
        const success = await sendRatesToRabbitMQ(rates);
        if (success) {
            // Immediately return the rates to the client for display (optional, but good UX)
            return res.status(200).json({ success: true, message: 'Rates sent to MOM queue successfully.', rates: rates });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send rates to MOM queue.' });
        }
    } else {
        return res.status(500).json({ success: false, message: 'Failed to fetch currency rates.' });
    }
});

// Start the server and connect to RabbitMQ
app.listen(PORT, () => {
    console.log(`Producer server running on port ${PORT}`);
    connectRabbitMQ();
});
