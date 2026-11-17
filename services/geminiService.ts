import { GoogleGenAI, Type } from "@google/genai";
import { GridState } from '../types';

export const generatePixelArt = async (prompt: string, gridSize: number): Promise<GridState | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    throw new Error("API ключ отсутствует. Пожалуйста, выберите действительный API ключ.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are a professional pixel artist AI.
    Your task is to generate a pixel art sprite based on the user's description.
    You must output the result as a raw JSON 2D array (matrix) of hex color codes (strings).
    The grid size must be exactly ${gridSize}x${gridSize}.
    Use null for transparent background pixels.
    Use a limited, cohesive color palette suitable for retro games.
    Ensure the main subject is centered.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create a pixel art of: ${prompt}.`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            grid: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING, // Hex code or "null" (handled as string then parsed)
                  nullable: true
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    // Ensure data.grid conforms to our GridState type (which allows nulls)
    // The model might return "null" string or actual null.
    // We map to ensure safety.
    const safeGrid: GridState = data.grid.map((row: any[]) => 
      row.map((cell: any) => (cell === 'null' || cell === null) ? null : cell as string)
    );

    return safeGrid;

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};