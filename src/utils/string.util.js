// src/utils/string.util.js

/**
 * Inakata ujumbe usizidi urefu uliopangwa ili kulinda gharama za SMS
 * @param {string} text - Ujumbe unaotakiwa kukaguliwa
 * @param {number} maxLength - Kiwango cha juu cha herufi (Default ni 160)
 * @returns {string} Ujumbe uliopunguzwa urefu ukiwa salama
 */
const limitMessageLength = (text, maxLength = 160) => {
    if (!text) return "";
    
    if (text.length > maxLength) {
        console.warn(`[String Util]: Herufi zimezidi ${maxLength}. Ujumbe umekatwa.`);
        // Tunakata hadi nafasi ya maxLength - 3 na kuongeza "..."
        return text.substring(0, maxLength - 3) + "...";
    }
    
    return text;
};

module.exports = { limitMessageLength };