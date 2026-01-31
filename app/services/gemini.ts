import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

export async function getSizingRecommendation(itemDescription: string) {
  // IMPORTANT: Never crash the app if the key is missing
  if (!apiKey) {
    return `Sizing help (Gemini disabled):
Small: up to 8x5x2 inches
Medium: up to 12x9x6 inches
Large: up to 18x12x12 inches`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Determine which package size (Small, Medium, Large) fits best for: ${itemDescription}. Return a brief recommendation.`,
      config: { temperature: 0.2 },
    });

    // The SDK may return different shapes depending on version.
    // This keeps it safe.
    // @ts-ignore
    return (response?.text ?? response?.response?.text ?? "").toString() || "No recommendation returned.";
  } catch (err) {
    console.error("Gemini Assistant Error:", err);
    return "Sizing help unavailable right now. Please choose Small/Medium/Large manually.";
  }
}
