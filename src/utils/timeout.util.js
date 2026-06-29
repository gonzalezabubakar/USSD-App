// src/utils/timeout.util.js

/**
 * Inazuia function yoyote inayochukua muda mrefu isizidi muda uliopangwa.
 * @param {Promise} promise - Kazi inayotakiwa kufanyika
 * @param {number} ms - Kiwango cha juu cha muda wa kusubiri (Milliseconds)
 * @returns {Promise}
 */
const runWithTimeout = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error("PROCESS_TIMEOUT_EXCEEDED")), ms)
        )
    ]);
};

module.exports = { runWithTimeout };