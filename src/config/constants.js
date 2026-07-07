// src/config/constants.js

module.exports = {
    // Orodha rasmi ya vyanzo vya kilimo vya Serikali ya Tanzania
    GOVERNMENT_AGRI_SOURCES: [
        {
            name: "Wizara ya Kilimo (MoA)",
            url: "https://www.kilimo.go.tz/pages/guidlines"
        },
        {
            name: "TARI (Tanzania Agricultural Research Institute)",
            url: "https://www.tari.go.tz/publications/e-books"
        },
        {
            name: "TARI miongozo",
            url: "https://www.tari.go.tz/publications/manuals"
        },
        {
            name: "TFRA (Tanzania Fertilizer Regulatory Authority)",
            url: "https://www.tfra.go.tz/publications/fertilizer-lists"
        }
    ],
    
    // Mipangilio mingine ya AI na Mfumo
    GEMINI_CONFIG: {
        MODEL_NAME: 'models/gemini-1.5-flash-latest',
        CACHE_TTL: '86400s', // Saa 24
        CACHE_DISPLAY_NAME: 'tari_tfra_iita_live_guides'
    }
};
// src/config/constants.js

module.exports = {
    // Orodha ya vyanzo na kurasa zote za ndani za Serikali
    GOVERNMENT_AGRI_SOURCES: [
        {
            name: "Wizara ya Kilimo (MoA)",
            pages: [
                { category: "Miongozo ya Mazao", url: "https://www.kilimo.go.tz/pages/guidlines"},
            ]
        },
        {
            name: "TARI",
            pages: [
                { category: "Miongozo ya Kilimo Bora", url: "https://www.tari.go.tz/publications/manuals" },
                {category: "e-books", url: "https://www.tari.go.tz/publications/e-books"}
            ]
        },
        {
            name: "TFRA",
            pages: [
                { category: "Bei Elekezi za Mbolea Mikoani", url: "https://www.tfra.go.tz/publications/fertilizer-indicative-prices-2026" },
                { category: "Sheria na Kanuni za Mbolea", url: "https://www.tfra.go.tz/publications/fertilizer-act-and-regulations" },
                { category: "Wafanyabiashara Waliosajiliwa", url: "https://www.tfra.go.tz/publications/registered-fertilzer-dealers" },
                { category: "Mbolea Zilizosajiliwa nchini", url: "https://www.tfra.go.tz/publications/registered-fertilizer-and-fertilizer-supplements" },
                { category: "Mwongozo wa Ruzuku ya Mbolea", url: "https://www.tfra.go.tz/publications/subsidy-guidance" },
                { category: "Jarida la Mbolea Yetu", url: "https://www.tfra.go.tz/publications/fertilizer-journal" },
                { category: "Ripoti za Ukaguzi wa Mbolea", url: "https://www.tfra.go.tz/publications/tfra-audited-reports" }
            ]
        }
    ],
    
    GEMINI_CONFIG: {
        MODEL_NAME: 'models/gemini-2.5-flash',
        CACHE_TTL: '86400s',
        CACHE_DISPLAY_NAME: 'tari_tfra_iita_live_guides'
    }
};