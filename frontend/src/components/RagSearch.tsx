'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, Sparkles, Send, Loader2, BookOpen, Zap, ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { ragApi, questionApi } from '@/lib/api';
import type { QuestionVO, SourceQuestion } from '@/types';

type SearchMode = 'ai' | 'question';

/**
 * 过滤 LLM 输出中的 <think>...</think> 思考过程标签
 * 处理流式输出中标签未闭合的情况（think 仍在生成时隐藏其内容）
 */
function filterThinkTags(text: string): string {
  // 1. 移除已闭合的 <think>...</think>
  let filtered = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // 2. 处理未闭合的 <think>（流式过程中 think 块还在输出，隐藏从 <think> 开始的内容）
  const openIdx = filtered.lastIndexOf('<think>');
  if (openIdx !== -1) {
    const afterOpen = filtered.substring(openIdx);
    if (!afterOpen.includes('</think>')) {
      filtered = filtered.substring(0, openIdx);
    }
  }
  return filtered;
}

export default function RagSearch() {
  const [mode, setMode] = useState<SearchMode>('ai');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionVO[]>([]);
  const [error, setError] = useState('');
  // AI 流式回答状态
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [streamingSources, setStreamingSources] = useState<SourceQuestion[]>([]);
  const [cacheHit, setCacheHit] = useState(false);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // 组件卸载时取消进行中的流式请求
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // 防抖搜索建议（AI 模式用 ES suggest，题目模式用 question list）
  const fetchSuggestions = useCallback(async (val: string, currentMode: SearchMode) => {
    if (val.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    try {
      if (currentMode === 'ai') {
        const res = await ragApi.suggest(val.trim());
        setSuggestions(res.data || []);
      } else {
        // 题目模式：直接调 list 接口，取标题做下拉
        const res = await questionApi.list({ title: val.trim(), current: 1, pageSize: 5 });
        const titles = (res.data?.records || []).map((q: QuestionVO) => q.title);
        setSuggestions(titles);
      }
      setShowSuggest(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val, mode), 300);
  };

  // 切换模式时清空状态 + 取消流式请求
  const switchMode = (newMode: SearchMode) => {
    if (mode === newMode) return;
    abortRef.current?.abort();
    abortRef.current = null;
    setMode(newMode);
    setQuery('');
    setSuggestions([]);
    setShowSuggest(false);
    setStreamingAnswer('');
    setStreamingSources([]);
    setCacheHit(false);
    setQuestions([]);
    setError('');
    inputRef.current?.focus();
  };

  // 提交搜索
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    // 取消上一个流式请求
    abortRef.current?.abort();
    abortRef.current = null;

    setShowSuggest(false);
    setLoading(true);
    setError('');
    setStreamingAnswer('');
    setStreamingSources([]);
    setCacheHit(false);
    setQuestions([]);

    if (mode === 'ai') {
      // AI 询问 -> 走流式 RAG 链路（SSE）
      const controller = ragApi.chatStream(query.trim(), {
        onMeta: (meta) => {
          setCacheHit(meta.cacheHit);
          setStreamingSources(meta.sourceQuestions || []);
        },
        onToken: (token) => {
          setStreamingAnswer((prev) => prev + token);
        },
        onDone: () => {
          setLoading(false);
          abortRef.current = null;
        },
        onError: (err) => {
          setError(err || 'AI 搜索失败，请稍后重试');
          setLoading(false);
          abortRef.current = null;
        },
      });
      abortRef.current = controller;
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      // 题目搜索 -> 走 MySQL/ES 链路
      try {
        const res = await questionApi.list({ title: query.trim(), current: 1, pageSize: 20 });
        setQuestions(res.data?.records || []);
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } catch (err: any) {
        setError(err?.message || '搜索失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }
  };

  // 点击建议项
  const handleSuggestClick = (text: string) => {
    setQuery(text);
    setShowSuggest(false);
    inputRef.current?.focus();
  };

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggest(false);
    }
  };

  // 点击外部关闭建议
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggest(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 快捷问题
  const quickQuestions = [
    'HashMap 底层原理',
    'Spring Bean 生命周期',
    'MySQL 索引优化',
    'Redis 持久化机制',
  ];

  // 难度标签样式
  const difficultyClass = (diff?: string) => {
    if (!diff) return 'badge-easy';
    if (diff.includes('简单') || diff.includes('EASY')) return 'badge-easy';
    if (diff.includes('中等') || diff.includes('MEDIUM')) return 'badge-medium';
    return 'badge-hard';
  };

  // 重新搜索（AI 模式）
  const resetAiSearch = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreamingAnswer('');
    setStreamingSources([]);
    setCacheHit(false);
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* 模式切换 Tab */}
      <div className="flex items-center justify-center gap-1 mb-4">
        <div className="inline-flex p-1 rounded-xl bg-surface-subtle border border-surface-border">
          <button
            onClick={() => switchMode('ai')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'ai'
                ? 'bg-white text-accent shadow-sm'
                : 'text-ink/50 hover:text-ink/70'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 询问
          </button>
          <button
            onClick={() => switchMode('question')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'question'
                ? 'bg-white text-accent shadow-sm'
                : 'text-ink/50 hover:text-ink/70'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            题目搜索
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative group">
            {/* 光晕效果 */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent/40 via-accent/20 to-accent/40 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
            
            <div className="relative flex items-center bg-white rounded-2xl border border-surface-border shadow-sm group-focus-within:border-accent/40 transition-colors">
              <Search className="absolute left-5 w-5 h-5 text-ink/30" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                placeholder={mode === 'ai' ? '问 AI 任何面试题...' : '搜索题目标题...'}
                className="w-full pl-14 pr-32 py-5 text-base bg-transparent rounded-2xl focus:outline-none placeholder:text-ink/30"
              />
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="absolute right-3 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-ink text-cream font-medium text-sm hover:bg-ink/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : mode === 'ai' ? (
                  <Send className="w-4 h-4" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {loading ? '搜索中' : mode === 'ai' ? 'AI 搜索' : '搜索'}
              </button>
            </div>
          </div>
        </form>

        {/* 搜索建议下拉 */}
        {showSuggest && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-surface-border shadow-lg overflow-hidden z-50 animate-fade-in">
            <div className="px-4 py-2 text-xs text-ink/40 font-medium border-b border-surface-border">
              {mode === 'ai' ? '题目搜索建议' : '匹配题目'}
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => handleSuggestClick(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-subtle transition-colors"
                  >
                    {mode === 'ai' ? (
                      <BookOpen className="w-4 h-4 text-accent/60 flex-shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-accent/60 flex-shrink-0" />
                    )}
                    <span className="text-sm text-ink/80">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 快捷问题（仅 AI 模式） */}
      {!streamingAnswer && !questions.length && !loading && mode === 'ai' && (
        <div className="mt-5 flex flex-wrap items-center gap-2 justify-center">
          <span className="text-xs text-ink/40">试试：</span>
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => {
                setQuery(q);
                fetchSuggestions(q, 'ai');
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-surface-border text-xs text-ink/60 hover:border-accent/30 hover:text-accent transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 结果区 */}
      <div ref={resultRef}>
        {/* AI 询问结果（流式渲染 + Markdown） */}
        {mode === 'ai' && (streamingAnswer || loading) && (
          <div className="mt-8 animate-slide-up">
            {/* 缓存标记 */}
            {cacheHit && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-600 mb-3">
                <Zap className="w-3 h-3" />
                语义缓存命中
              </div>
            )}

            {/* AI 回答 */}
            <div className="bg-white rounded-2xl border border-surface-border overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-surface-border bg-surface-subtle/50">
                <div className="w-7 h-7 rounded-lg bg-accent-light flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-accent" />
                </div>
                <span className="font-display text-sm font-bold">AI 回答</span>
                {loading && (
                  <span className="inline-flex items-center gap-1 ml-2 text-xs text-accent/60">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    生成中...
                  </span>
                )}
              </div>
              <div className="px-6 py-5">
                <div className="prose prose-sm max-w-none text-ink/80 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {filterThinkTags(streamingAnswer) || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* 引用溯源 */}
            {streamingSources.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-ink/40" />
                  <span className="text-xs font-medium text-ink/40">参考题目</span>
                  <span className="text-xs text-ink/30">({streamingSources.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {streamingSources.map((src) => (
                    <Link
                      key={src.questionId}
                      href={`/problems/${src.questionId}`}
                      className="group flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white border border-surface-border hover:border-accent/30 hover:bg-surface-subtle/50 transition-all"
                    >
                      <span className="text-sm text-ink/70 truncate">{src.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-ink/20 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 重新搜索 */}
            {!loading && (
              <button
                onClick={resetAiSearch}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink/40 hover:text-accent transition-colors"
              >
                <Search className="w-4 h-4" />
                重新搜索
              </button>
            )}
          </div>
        )}

        {/* 题目搜索结果 */}
        {mode === 'question' && questions.length > 0 && (
          <div className="mt-8 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-ink/40" />
              <span className="text-sm font-medium text-ink/60">
                找到 {questions.length} 道相关题目
              </span>
            </div>
            <div className="space-y-2">
              {questions.map((q) => (
                <Link
                  key={q.id}
                  href={`/problems/${q.id}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-white border border-surface-border hover:border-accent/30 hover:bg-surface-subtle/50 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-ink/80 truncate group-hover:text-accent transition-colors">
                        {q.title}
                      </span>
                      {q.difficulty && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${difficultyClass(q.difficulty)}`}>
                          {q.difficulty}
                        </span>
                      )}
                    </div>
                    {q.tags && q.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {q.tags.slice(0, 4).map((tag, i) => (
                          <span key={i} className="text-xs text-ink/40">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-ink/20 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </Link>
              ))}
            </div>

            {/* 重新搜索 */}
            <button
              onClick={() => {
                setQuestions([]);
                setQuery('');
                inputRef.current?.focus();
              }}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink/40 hover:text-accent transition-colors"
            >
              <Search className="w-4 h-4" />
              重新搜索
            </button>
          </div>
        )}

        {/* 题目搜索无结果 */}
        {mode === 'question' && !loading && questions.length === 0 && query && !error && (
          <div className="mt-8 text-center py-10 text-ink/40">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">没有找到相关题目</p>
            <p className="text-xs mt-1">试试切换到 AI 询问模式</p>
          </div>
        )}
      </div>
    </div>
  );
}
