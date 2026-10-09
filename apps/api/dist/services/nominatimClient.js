"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchNominatim = fetchNominatim;
let requestQueue = Promise.resolve();
let nextRequestAt = 0;
function fetchNominatim(url, signal) {
    const currentRequest = requestQueue.then(async () => {
        const waitMs = nextRequestAt - Date.now();
        if (waitMs > 0)
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        nextRequestAt = Date.now() + 1000;
        return fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'BloodLinkAI/1.0 (healthcare nearby hospital lookup)',
            },
            signal,
        });
    });
    requestQueue = currentRequest.then(() => undefined, () => undefined);
    return currentRequest;
}
