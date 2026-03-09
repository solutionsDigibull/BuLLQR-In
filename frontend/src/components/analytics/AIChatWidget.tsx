import { useState } from 'react';
import { askAI } from '../../services/ai.ts';

const EXAMPLE_PROMPTS = [
  "What is today's production count?",
  "Which stage has the most defects?",
  "What is the overall OK rate?",
  "How much is total COPQ?",
];

export default function AIChatWidget() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(q?: string) {
    const text = q ?? question.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await askAI(text);
      setAnswer(res.answer);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? 'Failed to get AI response. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleChip(prompt: string) {
    setQuestion(prompt);
    handleAsk(prompt);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
      <h3 className="text-base font-medium text-gray-700 dark:text-gray-200 mb-3">
        AI Production Assistant
      </h3>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="Ask about production data..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          onClick={() => handleAsk()}
          disabled={loading || !question.trim()}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Thinking...' : 'Ask AI'}
        </button>
      </div>

      {/* Example prompt chips */}
      {!answer && !loading && !error && (
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleChip(prompt)}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          Thinking...
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div className="mt-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
