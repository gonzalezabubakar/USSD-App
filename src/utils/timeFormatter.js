// src/utils/timeFormatter.js

/**
 * Inabadilisha tarehe ya database kuwa lugha ya kawaida ya kibinadamu ya Kiswahili
 * @param {Date|string} createdAt - Tarehe kutoka kwenye database
 * @returns {string} - Muda uliopita kwa uhalisia
 */
function getHumanReadableTime(createdAt) {
    const now = new Date();
    const past = new Date(createdAt);
    const diffMs = now - past; // Tofauti katika milisekunde

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
        return diffMinutes <= 1 ? "Muda mfupi uliopita" : `Dakika ${diffMinutes} zilizopita`;
    } else if (diffHours < 24) {
        return `Saa ${diffHours} zilizopita`;
    } else if (diffDays === 1) {
        return "Jana";
    } else {
        return `Siku ${diffDays} zilizopita`;
    }
}

module.exports = {
    getHumanReadableTime
};