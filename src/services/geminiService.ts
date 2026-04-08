import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAi() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is missing. AI features will fail.');
    }
    ai = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return ai;
}

export const extractAvalancheEvents = async (newsText: string) => {
  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `### Groundsource Methodology: Avalanche Extraction
      Extract confirmed historical avalanche events from the following text. 
      STRICT REQUIREMENTS:
      - Spatial Precision: Geolocation must be within a 1-2 km radius. If the text is too vague (e.g., "in the Himalayas"), discard it.
      - Temporal Precision: Extract the exact peak event day.
      - Classification: Distinguish between hypothetical risk and actual past events.
      - Output: JSON array of events.
      
      Text: ${newsText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: 6, // ARRAY
        items: {
          type: 5, // OBJECT
          properties: {
            timestamp: { type: 1 }, // STRING
            location: {
              type: 5, // OBJECT
              properties: {
                lat: { type: 2 }, // NUMBER
                lng: { type: 2 }, // NUMBER
                name: { type: 1 } // STRING
              },
              required: ["lat", "lng", "name"]
            },
            severity: { type: 2 }, // NUMBER
            type: { type: 1 }, // STRING
            description: { type: 1 } // STRING
          },
          required: ["timestamp", "location", "severity", "type", "description"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const explainRisk = async (features: any, riskScore: number) => {
  const response = await getAi().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Explain why the avalanche risk is ${riskScore}/5 given these features: ${JSON.stringify(features)}. Provide 3 top contributing factors.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: 5, // OBJECT
        properties: {
          explanation: { type: 1 }, // STRING
          topFactors: {
            type: 6, // ARRAY
            items: { type: 1 } // STRING
          }
        },
        required: ["explanation", "topFactors"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
