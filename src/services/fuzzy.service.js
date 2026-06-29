// src/services/fuzzy.service.js
const natural = require('natural');

class FuzzyService {
    /**
     * Kupiga hesabu ya mfanano wa maneno ya mkulima na sheria za database
     */
    calculateMatchScore(farmerSymptom, dbRuleKeywordsString) {
        // 1. Safisha maneno ya mkulima
        const cleanedSymptom = farmerSymptom.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
        const farmerWords = cleanedSymptom.split(/\s+/).filter(w => w.length > 2);

        // 2. Safisha keywords za sheria kutoka DB
        const ruleWords = dbRuleKeywordsString
            .replace(/,/g, ' ')
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2);

        let currentScore = 0;

        // 3. Linganisha neno kwa neno (Fuzzy Logic)
        farmerWords.forEach(fWord => {
            ruleWords.forEach(rWord => {
                // A: Mfanano wa moja kwa moja
                if (rWord.includes(fWord) || fWord.includes(rWord)) {
                    currentScore += 1;
                } 
                // B: Levenshtein Distance
                else {
                    const distance = natural.LevenshteinDistance(fWord, rWord);
                    if (rWord.length > 5 && distance <= 2) {
                        currentScore += 1;
                    } else if (rWord.length <= 5 && rWord.length >= 3 && distance === 1) {
                        currentScore += 1;
                    }
                }
            });
        });

        return currentScore;
    }
}

module.exports = new FuzzyService();