
import { GoogleGenAI } from "@google/genai";
import { Language } from '../types';

/* GUIDELINE: Initialize GoogleGenAI right before making a call to ensure it uses the latest API key. */

export const getObjectInfo = async (objectName: string, language: Language): Promise<string> => {
  /* GUIDELINE: Using 'gemini-3-flash-preview' for basic text tasks like object descriptions. */
  const model = "gemini-3-flash-preview";
  
  const langInstruction = language === 'ja'
    ? 'IMPORTANT: You MUST output strictly in Japanese.'
    : 'Response Language: English';

  const prompt = `
    Role: You are an expert astronomer and observatory assistant.
    Task: Provide a detailed description of the celestial object "${objectName}".
    Source Material: Refer to data from Wikipedia (天体情報) and standard Astronomical Catalogs (Messier, NGC, IC).

    ${langInstruction}
    
    Please structure the response as follows:
    1. **Overview**: Basic description, constellation, distance from Earth.
    2. **Physical Characteristics**: Type, size, mass, age, composition.
    3. **Observation**: Visual magnitude, apparent size, best season to view.
    4. **History**: Discovery information, origin of name.
    
    Ensure the tone is educational and accurate.
  `;

  try {
    /* GUIDELINE: Always obtain API key exclusively from process.env.API_KEY and initialize inside the function. */
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    /* GUIDELINE: Extracting generated text via the '.text' property (not a method). */
    const text = response.text;
    if (!text) {
        return language === 'ja' ? "情報を取得できませんでした。" : "Could not retrieve information.";
    }
    return text;
  } catch (error: any) {
    // Handle Quota Exceeded (429)
    if (
        error.status === 429 || 
        error.response?.status === 429 ||
        error?.error?.code === 429 || 
        error?.error?.status === 'RESOURCE_EXHAUSTED' ||
        (error.message && (
            error.message.includes('429') || 
            error.message.includes('RESOURCE_EXHAUSTED') ||
            error.message.includes('Quota exceeded')
        ))
    ) {
        console.warn("Gemini API Quota Exceeded (429). Returning user-friendly message.");
        return language === 'ja'
            ? "Gemini APIの利用枠を超過しました (Error 429)。しばらく時間を置いてから再度お試しください。"
            : "Gemini API quota exceeded (Error 429). Please try again later.";
    }

    // Log genuine errors
    console.error("Gemini API call failed:", error);

    if (error instanceof Error) {
        return `Failed to fetch data from Gemini. Reason: ${error.message}`;
    }
    return "An unknown error occurred while fetching data from Gemini.";
  }
};
