// PythonWebSocketClient.js
const WebSocket = require('ws');

// Configuration constants
const WS_RECONNECT_DELAY = 2000;
const WS_RESPONSE_TIMEOUT = 300000; // 30 seconds
const WS_MAX_RETRIES = 3;

class PythonWebSocketClient {
    constructor() {
        this.socket = null;
        this.retryCount = 0;
        // this.pendingRequests = new Map();
        this.responseQueue = [];  // Array to hold pending responses

        this.connect();
    }

    connect() {
        this.socket = new WebSocket('ws://localhost:8765');

        this.socket.on('open', () => {
            console.log('Connected to Python WebSocket');
            this.retryCount = 0;
        });

        this.socket.on('message', (data) => {
            try {
                const response = JSON.parse(data);
                if (this.responseQueue.length > 0) {
                    const { resolve } = this.responseQueue.shift();
                    resolve(response);
                }
            } catch (e) {
                console.error('Message parse error:', e);
            }
        });

        this.socket.on('close', () => {
            console.log('Disconnected from Python WebSocket');
            if (this.retryCount < WS_MAX_RETRIES) {
                this.retryCount++;
                console.log(`Reconnecting attempt ${this.retryCount}...`);
                setTimeout(() => this.connect(), WS_RECONNECT_DELAY);
            }
        });

        this.socket.on('error', (err) => {
            console.error('WebSocket error:', err.message);
        });
    }

    async sendRequest(payload, timeout = WS_RESPONSE_TIMEOUT) {

        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket not connected'));
            }

            this.responseQueue.push({ resolve, reject });

            const timer = setTimeout(() => {
                const index = this.responseQueue.findIndex(r => r.reject === reject);
                if (index !== -1) {
                    this.responseQueue.splice(index, 1);
                }
                reject(new Error('Python WebSocket timeout'));
            }, timeout);

            try {
                this.socket.send(JSON.stringify(payload));
            } catch (e) {
                clearTimeout(timer);
                const index = this.responseQueue.findIndex(r => r.reject === reject);
                if (index !== -1) {
                    this.responseQueue.splice(index, 1);
                }
                reject(e);
            }
        });
    }
}

module.exports = PythonWebSocketClient;