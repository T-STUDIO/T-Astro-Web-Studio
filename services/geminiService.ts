
/// <reference types="vite/client" />

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Language } from '../types';

/* GUIDELINE: Initialize GoogleGenAI right before making a call to ensure it uses the latest API key. */

export const getObjectInfo = async (objectName: string, language: Language): Promise<string> => {
  /* GUIDELINE: Using 'gemini-3-flash-preview' for basic text tasks like object descriptions. */
  const model = "gemini-3-flash-preview";
  
  const langInstruction = language === 'ja'
    ? 'IMPORTANT: You MUST output strictly in Japanese (日本語). Ensure the response is natural and easy to read for Japanese speakers.'
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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : '');
    if (!apiKey) {
      return language === 'ja' ? "APIキーが設定されていません。" : "API key is not configured.";
    }
    const ai = new GoogleGenerativeAI(apiKey);
    const genModel = ai.getGenerativeModel({ model: model });
    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
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
  const model = "gemini-3-flash-preview";
  
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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : '');
    if (!apiKey) return language === 'ja' ? "APIキー未設定" : "API Key Missing";
    
    const ai = new GoogleGenerativeAI(apiKey);
    const genModel = ai.getGenerativeModel({ 
      model: model,
      systemInstruction: "あなたはプロの天文家であり、一般の人にも分かりやすく天体の魅力を伝えるガイドです。提供された構造化データやテキストを元に、その天体の特徴、物理的属性、歴史的背景を日本語で丁寧に要約してください。学術的な正確さを保ちつつ、読み手に感動を与えるような表現を心がけてください。"
    });

    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text || (language === 'ja' ? "要約を作成できませんでした。" : "Could not create summary.");
  } catch (error: any) {
    console.error("Gemini Summarization failed:", error);
    return language === 'ja' ? "要約の作成中にエラーが発生しました。" : "Error occurred during summarization.";
  }
};
