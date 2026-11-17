import { GoogleGenAI, Type } from "@google/genai";
import { GridState } from "../types";

export const generatePixelArt = async (
  prompt: string,
  currentGrid: GridState,
  width: number,
  height: number
): Promise<GridState> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const systemInstruction = `You are an expert pixel artist.
The user wants to draw or modify pixel art on a canvas of size ${width}x${height}.
The current canvas state is provided as a JSON array of arrays of hex color strings (or "transparent").
Please return a JSON array of pixel changes to apply to the canvas.
Each change should be an object with 'x', 'y', and 'color' properties.
'x' is the column index (0 to ${width - 1}).
'y' is the row index (0 to ${height - 1}).
'color' is a valid hex color code (e.g., '#FF0000') or "transparent".
Only return the pixels that need to be changed. If you are drawing something new, return all the pixels for that drawing.
IMPORTANT: You MUST use gradients, shading, and smooth color transitions in your pixel art to make it look awesome and professional. Do not just use flat colors. Interpolate colors between different shades to create beautiful gradients.`;

  const currentPixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (currentGrid[y][x] !== null) {
        currentPixels.push({ x, y, color: currentGrid[y][x] });
      }
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `User request: ${prompt}\n\nCurrent canvas state (only non-transparent pixels are listed):\n${JSON.stringify(currentPixels)}`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            x: { type: Type.INTEGER, description: "Column index" },
            y: { type: Type.INTEGER, description: "Row index" },
            color: { type: Type.STRING, description: "Hex color or 'transparent'" }
          },
          required: ["x", "y", "color"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from AI");
  }

  const changes = JSON.parse(text) as { x: number, y: number, color: string }[];
  
  // Clone current grid
  const newGrid: GridState = currentGrid.map(row => [...row]);

  // Apply changes
  for (const change of changes) {
    if (change.y >= 0 && change.y < height && change.x >= 0 && change.x < width) {
      newGrid[change.y][change.x] = change.color === "transparent" ? null : change.color;
    }
  }

  return newGrid;
};
