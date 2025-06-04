// PythonWebSocketClient.js (browser-compatible)
const WS_RECONNECT_DELAY = 2000;
const WS_RESPONSE_TIMEOUT = 3000000; // 30 seconds
const WS_MAX_RETRIES = 3;

export default class PythonWebSocketClient {
    constructor(url = 'ws://localhost:8765') {
        this.socket = null;
        this.retryCount = 0;
        this.responseQueue = [];
        this.url = url;
        // This promise will resolve when socket is ready
        this.ready = new Promise((resolve) => {
            this._readyResolver = resolve;
        });
        this.connect();
    }

    connect() {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
            console.log('Connected to Python WebSocket');
            this.retryCount = 0;
            this._readyResolver(); // ✅ Resolve the ready promise
        };
        this.socket.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (this.responseQueue.length > 0) {
                    const { resolve } = this.responseQueue.shift();
                    resolve(response);
                }
            } catch (e) {
                console.error('Message parse error:', e);
            }
        };
        this.socket.onclose = () => {
            console.log('Disconnected from Python WebSocket');
            if (this.retryCount < WS_MAX_RETRIES) {
                this.retryCount++;
                console.log(`Reconnecting attempt ${this.retryCount}...`);
                setTimeout(() => this.connect(), WS_RECONNECT_DELAY);
            }
        };
        this.socket.onerror = (err) => {
            console.error('WebSocket error:', err.message);
        };
    }

    async sendRequest(payload, timeout = WS_RESPONSE_TIMEOUT) {
        await this.ready;
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
                if(payload.action==='load_file'){
                    const { content, ...meta } = payload.file;
                    console.log("meta", meta)
                    this.socket.send(JSON.stringify({"action":"load_file", "meta":JSON.stringify(meta)}))
                    this.socket.send(content)
                } else if (payload.action==='query_trees'){
                    console.log("action", payload.values)
                    this.socket.send(JSON.stringify(payload))
                } else if (payload.action === 'config'){
                    console.log("action config", )
                    this.socket.send(JSON.stringify(payload))
                }
                // this.socket.send(JSON.stringify(payload));
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
