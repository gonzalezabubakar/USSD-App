// src/utils/string.util.js

const compressAgriculturalText = (text) => {
    if (!text) return "";
    let compressed = text;

    // Futa mabano yote ya vipimo vya kishule na kikemia (mfano: 240SC, 5ml/20L)
    compressed = compressed.replace(/\s*\([^)]*ml[^)]*\)/gi, ''); 
    compressed = compressed.replace(/\s*\([^)]*sc[^)]*\)/gi, '');
    compressed = compressed.replace(/\s*\([^)]*ec[^)]*\)/gi, '');
    compressed = compressed.replace(/\d+SC|\d+EC|\d+WG/gi, ''); 

    // Vifupisho vya kijanja vya mtaani ili kubana ujumbe uwe mfupi zaidi
    const replacements = [
        { long: /Viwavijeshi vamizi/gi, short: "Viwavijeshi" },
        { long: /Funza wa Majeshi na Funza wa Shina la Mahindi/gi, short: "Funza wa shina" },
        { long: /kagua mashamba mara kwa mara/gi, short: "kagua shamba kila siku" },
        { long: /kagua shamba mara kwa mara/gi, short: "kagua shamba kila siku" },
        { long: /Tumia viuatilifu kama/gi, short: "Pulizia" },
        { long: /Tumia dawa kama/gi, short: "Pulizia" },
        { long: /mapema wadudu wanapoonekana/gi, short: "mapema" },
        { long: /wasiliana na afisa ugani wa karibu/gi, short: "Piga kwa afisa ugani" },
        { long: /\s+/g, short: " " }
    ];

    replacements.forEach(item => {
        compressed = compressed.replace(item.long, item.short);
    });

    return compressed.trim();
};

/**
 * Inalazimisha ujumbe kuwa mfupi sana (Max 130) kwa ajili ya huduma ya kwanza
 */
const limitMessageLength = (text, maxLength = 130) => {
    if (!text) return "";
    
    let optimizedText = compressAgriculturalText(text);
    
    if (optimizedText.length > maxLength) {
        let truncated = optimizedText.substring(0, maxLength - 20); // Acha nafasi ya wito wa chatingi
        const lastSpace = truncated.lastIndexOf(" ");
        if (lastSpace > 0) {
            truncated = truncated.substring(0, lastSpace);
        }
        // Wito wa hatua kwa ufupi (Mkaribishe mkulima kuendelea na chat)
        return truncated + "... Chat nasi.";
    }
    
    return optimizedText;
};

module.exports = { limitMessageLength };