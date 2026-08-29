import React, { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  sender: 'USER' | 'PROOFFLOW';
  text: string;
}

interface CommandPanelProps {
  chatMessages: ChatMessage[];
  onCommand: (prompt: string) => void;
  onSecondaryCommand: (demoType: 'FAILURE' | 'BLIND_JURY' | 'UNCERTAIN') => void;
  isProcessing: boolean;
}

export function CommandPanel({ chatMessages, onCommand, onSecondaryCommand, isProcessing }: CommandPanelProps) {
  const [input, setInput] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    onCommand(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#dadce0] shadow-sm">
      <div className="p-4 border-b border-[#dadce0] bg-[#f8f9fa]">
        <h3 className="font-semibold text-[#202124] text-[16px]">ProofFlow Command</h3>
        <p className="text-[13px] text-[#5f6368] mt-1">Describe the economic task.</p>
      </div>

      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {chatMessages.length === 0 ? (
          <div className="text-center text-[#5f6368] text-[13px] mt-10">
            Awaiting instructions...
          </div>
        ) : (
          chatMessages.map(msg => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'USER' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-bold text-[#5f6368] uppercase tracking-wider mb-1">
                {msg.sender}
              </span>
              <div 
                className={`px-4 py-2 rounded text-[14px] max-w-[90%] shadow-sm ${
                  msg.sender === 'USER' 
                    ? 'bg-[#1a73e8] text-white' 
                    : 'bg-[#f1f3f4] text-[#202124] border border-[#dadce0]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-[#dadce0] bg-white">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder="Describe a task..."
            className="flex-1 border border-[#dadce0] rounded px-3 py-2 text-[14px] focus:outline-none focus:border-[#1a73e8] disabled:bg-[#f1f3f4]"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isProcessing}
            className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2 rounded font-medium text-[14px] disabled:opacity-50 transition-colors shadow-sm"
          >
            Send
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onCommand("Find a Python debugging agent for ₹150 within 15 minutes.")}
            className="text-[11px] font-medium px-2 py-1 bg-[#e6f4ea] text-[#137333] rounded hover:bg-[#ceead6] transition-colors disabled:opacity-50 border border-[#a8dab5]"
          >
            + Dynamic Python Task (₹150)
          </button>
          <button 
            type="button" 
            disabled={isProcessing}
            onClick={() => onSecondaryCommand('FAILURE')}
            className="text-[11px] font-medium px-2 py-1 bg-[#fce8e6] text-[#c5221f] rounded hover:bg-[#fad2cf] transition-colors disabled:opacity-50 border border-[#f8bbd0]"
          >
            Demo: Failure
          </button>
          <button 
            type="button" 
            disabled={isProcessing}
            onClick={() => onSecondaryCommand('BLIND_JURY')}
            className="text-[11px] font-medium px-2 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded hover:bg-[#d2e3fc] transition-colors disabled:opacity-50 border border-[#c6dafc]"
          >
            Demo: Blind Jury
          </button>
          <button 
            type="button" 
            disabled={isProcessing}
            onClick={() => onSecondaryCommand('UNCERTAIN')}
            className="text-[11px] font-medium px-2 py-1 bg-[#fef7e0] text-[#b06000] rounded hover:bg-[#fce8b2] transition-colors disabled:opacity-50 border border-[#fadd8a]"
          >
            Demo: Uncertain
          </button>
        </div>
      </div>
    </div>
  );
}
