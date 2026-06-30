
/// <reference types="vite/client" />

import { GoogleGenAI } from "@google/genai";
import { Language } from '../types';
import { fetchSimbadData } from "./simbadService";

/* GUIDELINE: Initialize GoogleGenAI right before making a call to ensure it uses the latest API key. */

export const getObjectInfo = async (objectName: string, language: Language, isAnno?: boolean): Promise<string> => {
  /* GUIDELINE: Using 'gemini-3.5-flash' for basic text tasks like object descriptions. */
  const model = "gemini-3.5-flash";
  
  const langInstruction = language === 'ja'
    ? 'IMPORTANT: You MUST output strictly in Japanese (日本語). Ensure the response is natural and easy to read for Japanese speakers.'
    : 'Response Language: English';

  let sourceMaterial = 'Source Material: Refer to data from Wikipedia (天体情報) and standard Astronomical Catalogs (Messier, NGC, IC).';
  if (isAnno) {
    try {
      const simbadData = await fetchSimbadData(objectName, language === 'ja' ? 'ja' : 'en');
      if (simbadData) {
        const aliases = simbadData.aliases ? `Aliases: ${simbadData.aliases.join(', ')}` : '';
        sourceMaterial = `Source Material: Refer STRICTLY to the following scientific data obtained from SIMBAD for the celestial object:
- Name: ${objectName}
- Type: ${simbadData.type}
- Visual Magnitude: ${simbadData.magnitude}
- RA: ${simbadData.ra}
- Dec: ${simbadData.dec}
- ${aliases}

Use this precise scientific data as the primary source of truth, and describe the celestial object. Do not create new sections or items. Stick to the exact 4 sections listed below.`;
      }
    } catch (e) {
      console.warn("Failed to fetch Simbad info during getObjectInfo", e);
    }
  }

  const prompt = `
    Role: You are an expert astronomer and observatory assistant.
    Task: Provide a detailed description of the celestial object "${objectName}".
    ${sourceMaterial}

    ${langInstruction}
    
    Please structure the response precisely as follows:
    1. **Overview**: Basic description, constellation, distance from Earth.
    2. **Physical Characteristics**: Type, size, mass, age, composition.
    3. **Observation**: Visual magnitude, apparent size, best season to view.
    4. **History**: Discovery information, origin of name.
    
    Ensure the tone is educational and accurate.
  `;

  try {
    let apiKey = (typeof window !== 'undefined' ? window.localStorage.getItem('gemini_api_key') : null) || '';
    if (apiKey) {
      const authBearerMatch = apiKey.match(/^(?:Authorization:\s*)?Bearer\s+(.+)$/i);
      if (authBearerMatch) {
        apiKey = authBearerMatch[1].trim();
      }
    }
    if (!apiKey) {
      return language === 'ja'
        ? "Gemini APIキーが設定されていません。AI機能を使用するにはAPIキーを登録してください。ブラウザURLの末尾に「?set_api_key=true」を入力して移動すると、再書き換え画面を表示できます。"
        : "Gemini API Key is not set. Please set your API key to use dynamic AI descriptions. Append '?set_api_key=true' to the URL to show the API key installation dialog.";
    }
    const ai = new GoogleGenAI({ apiKey });
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

export const summarizeExternalInfo = async (objectName: string, rawText: string, source: 'Wikipedia' | 'SIMBAD', language: Language): Promise<string> => {
  const model = "gemini-3.5-flash";
  
  const langInstruction = language === 'ja'
    ? 'IMPORTANT: You MUST output strictly in Japanese (日本語). Ensure the summary is natural and easy to read for Japanese speakers.'
    : 'Response Language: English';

  const prompt = `
    Role: You are an expert astronomer.
    Task: Summarize the following raw information about the celestial object "${objectName}" from ${source}.
    
    ${langInstruction}
    
    Instructions:
    - Provide a concise summary in 3-4 paragraphs.
    - Focus on scientific facts, observational interest, and historical significance.
    - Use professional yet accessible language.
    - If the input text is messy or contains technical codes, filter them out to provide a clean narrative.

    Raw Information:
    ${rawText}
  `;

  try {
    let apiKey = (typeof window !== 'undefined' ? window.localStorage.getItem('gemini_api_key') : null) || '';
    if (apiKey) {
      const authBearerMatch = apiKey.match(/^(?:Authorization:\s*)?Bearer\s+(.+)$/i);
      if (authBearerMatch) {
        apiKey = authBearerMatch[1].trim();
      }
    }
    if (!apiKey) {
      return language === 'ja' ? "Gemini APIキーが設定されていません。" : "Gemini API Key is not set.";
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: "あなたはプロの天文家であり、一般の人にも分かりやすく天体の魅力を伝えるガイドです。提供された構造化データやテキストを元に、その天体の特徴、物理的属性、歴史的背景を日本語で丁寧に要約してください。学術的な正確さを保ちつつ、読み手に感動を与えるような表現を心がけてください。",
      }
    });
    
    return response.text || (language === 'ja' ? "要約を作成できませんでした。" : "Could not create summary.");
  } catch (error: any) {
    console.error("Gemini Summarization failed:", error);
    return language === 'ja' ? "要約の作成中にエラーが発生しました。" : "Error occurred during summarization.";
  }
};
