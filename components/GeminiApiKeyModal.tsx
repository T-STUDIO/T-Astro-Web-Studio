import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons/CloseIcon';
import { GeminiIcon } from './icons/GeminiIcon';

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (key: string) => void;
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({ isOpen, onClose, onRegister }) => {
  const [apiKey, setApiKey] = useState('');
  const [isReconfigMode, setIsReconfigMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem('gemini_api_key') || '';
      setApiKey(savedKey);
      setIsReconfigMode(!!savedKey);
      setErrorMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRegister = () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setErrorMsg('APIキーを入力してください。');
      return;
    }
    
    // AuthorizationキーやBearerキーに含まれるスペース、コロン、ピリオド、スラッシュ、イコール、プラス、アットマーク、英数字、ハイフン、アンダースコアを許可する
    if (!/^[a-zA-Z0-9_\-\s\:\.\=\/\+\@]+$/.test(trimmedKey)) {
      setErrorMsg('APIキーに無効な文字が含まれています。半角英数字、記号（: . / = + - _ @）およびスペースで入力してください。');
      return;
    }
    onRegister(trimmedKey);
  };

  const handleGetApiKey = () => {
    window.open('https://aistudio.google.com/app/apikey', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-red-900/50 rounded-lg shadow-2xl w-full max-w-md flex flex-col animate-fadeIn overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-red-900/30 bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <GeminiIcon className="w-6 h-6 text-red-500 animate-pulse" />
            <h2 className="text-md font-bold text-slate-100">Gemini APIキー設定</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full transition-colors hover:bg-slate-700">
            <CloseIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
            {isReconfigMode ? (
              `登録されているGemini APIキーの変更を行います。新しいAPIキーを入力して『登録』ボタンを押してください。`
            ) : (
              `本アプリのAI機能（天体情報やおすすめ解説）を使用するには、お客様ご自身のAPIキーの登録が必要です。
既にAPIキーを所有されている方は入力欄に半角英数キーで入力後”登録”ボタンを押してください。
APIキーを所有していない方は”API取得”ボタンを押し、指示に従いAPIキーを取得後、入力欄に半角英数キーで入力後”登録”ボタンを押してください。
キーはお使いのブラウザ内にのみ厳重に保護され、第三者や開発者のサーバーへ送信されることは一切ありません。`
            )}
          </p>

          <div className="space-y-2">
            <input
              type="text"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setErrorMsg('');
              }}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:border-red-500 focus:outline-none"
            />
            {errorMsg && (
              <p className="text-xs text-red-500 font-medium">{errorMsg}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            {!isReconfigMode && (
              <button
                onClick={handleGetApiKey}
                className="px-4 py-2 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95 transition-all"
              >
                API取得
              </button>
            )}
            <button
              onClick={handleRegister}
              className="px-4 py-2 text-xs font-semibold rounded bg-red-700 hover:bg-red-600 text-white active:scale-95 transition-all shadow-md shadow-red-900/50"
            >
              登録
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
