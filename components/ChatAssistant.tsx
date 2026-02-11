
import React, { useState } from 'react';
import { ChatBubbleLeftRightIcon, XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { sendMessageToAssistant } from '../services/geminiService';

const ChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    const newHistory = [...messages, { role: 'user' as const, text: userMsg }];
    setMessages(newHistory);
    setLoading(true);

    try {
        // Convert format for service
        const apiHistory = newHistory.map(h => ({ role: h.role, parts: [h.text] }));
        const prevHistory = apiHistory.slice(0, -1);
        
        const response = await sendMessageToAssistant(prevHistory, userMsg);
        setMessages(prev => [...prev, { role: 'model', text: response || "I'm not sure." }]);
    } catch (e) {
        setMessages(prev => [...prev, { role: 'model', text: "Error connecting to Gemini." }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-br from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 rounded-full shadow-[0_0_20px_rgba(124,58,237,0.5)] z-50 text-white transition-transform hover:scale-105 border border-white/10"
      >
        {isOpen ? <XMarkIcon className="w-6 h-6" /> : <ChatBubbleLeftRightIcon className="w-6 h-6" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-black/60 border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden backdrop-blur-xl">
          <div className="p-4 bg-white/5 border-b border-white/5 font-bold text-white flex justify-between items-center backdrop-blur-md">
            <span>Gemini Assistant</span>
            <span className="text-[10px] text-emerald-400 font-normal px-2 py-0.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">Online</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-transparent custom-scrollbar">
            {messages.length === 0 && (
                <div className="text-gray-500 text-sm text-center mt-10 px-4">
                    <p>✨ Ask me about video ideas, scripting, or how to use the studio!</p>
                </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-md ${
                  m.role === 'user' ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white/10 text-gray-200 rounded-bl-none border border-white/5'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-gray-500 text-xs italic animate-pulse pl-4">Gemini is thinking...</div>}
          </div>

          <div className="p-3 border-t border-white/5 bg-black/40 flex gap-2 backdrop-blur-md">
            <input
              type="text"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
              placeholder="Ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
                onClick={handleSend}
                disabled={loading}
                className="text-purple-400 hover:text-white disabled:opacity-50 p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
