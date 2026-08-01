'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { questionBankApi, questionApi } from '@/lib/api';
import type { QuestionBankVO, QuestionQueryDTO } from '@/types';
import { Code2, Database, BookOpen, Layers, ArrowRight, Library } from 'lucide-react';

// 热门分类：固定展示 + 动态数量
const HOT_CATEGORIES = [
  {
    key: 'algorithm',
    title: 'LeetCode 算法题',
    desc: '大厂高频算法题，涵盖双指针、动态规划、回溯、图论等核心套路',
    icon: Code2,
    gradient: 'from-blue-500 to-indigo-600',
    query: { type: 'PROGRAMMING' } as Partial<QuestionQueryDTO>,
    href: '/algorithms',
  },
  {
    key: 'redis',
    title: 'Redis 八股面试题',
    desc: 'Redis 数据结构、持久化、集群、缓存策略等面试必考知识点',
    icon: Database,
    gradient: 'from-red-500 to-rose-600',
    query: { tags: ['Redis'] } as Partial<QuestionQueryDTO>,
    href: '/problems?category=redis',
  },
  {
    key: 'mysql',
    title: 'MySQL 八股面试题',
    desc: '索引原理、事务隔离级别、锁机制、SQL 优化等数据库面试核心',
    icon: Layers,
    gradient: 'from-amber-500 to-orange-600',
    query: { tags: ['MySQL'] } as Partial<QuestionQueryDTO>,
    href: '/problems?category=mysql',
  },
  {
    key: 'spring',
    title: 'Spring 八股面试题',
    desc: 'IOC/AOP 原理、Bean 生命周期、事务管理、SpringBoot 自动配置',
    icon: BookOpen,
    gradient: 'from-green-500 to-emerald-600',
    query: { tags: ['Spring'] } as Partial<QuestionQueryDTO>,
    href: '/problems?category=spring',
  },
];

export default function BanksPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [banks, setBanks] = useState<QuestionBankVO[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 加载热门分类题目数量
    (async () => {
      const results: Record<string, number> = {};
      await Promise.all(
        HOT_CATEGORIES.map(async (cat) => {
          try {
            const res = await questionApi.list({
              current: 1,
              pageSize: 1,
              ...cat.query,
            } as QuestionQueryDTO);
            results[cat.key] = res.data.total;
          } catch {
            results[cat.key] = 0;
          }
        })
      );
      setCounts(results);
      setLoading(false);
    })();

    // 加载全部题库
    (async () => {
      try {
        const res = await questionBankApi.list({ current: 1, pageSize: 100 });
        setBanks(res.data?.records || []);
      } catch (err) {
        console.error('加载题库列表失败', err);
      } finally {
        setBanksLoading(false);
      }
    })();
  }, []);

  return (
    <div className="animate-fade-in">
      {/* 标题 */}
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold mb-2">题库</h1>
        <p className="text-ink/50">选择题库开始练习，涵盖算法与八股</p>
      </div>

      {/* 热门分类 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {HOT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = counts[cat.key];
          return (
            <Link
              key={cat.key}
              href={cat.href}
              className="group relative bg-white rounded-2xl border border-surface-border p-8 hover:border-accent/40 hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              {/* 装饰渐变 */}
              <div
                className={`absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br ${cat.gradient} opacity-5 group-hover:opacity-10 transition-opacity blur-2xl`}
              />

              <div className="relative">
                {/* 图标 */}
                <div
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${cat.gradient} mb-4`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* 标题 */}
                <h2 className="font-display text-xl font-bold mb-2 group-hover:text-accent transition-colors">
                  {cat.title}
                </h2>

                {/* 描述 */}
                <p className="text-sm text-ink/50 leading-relaxed mb-4">
                  {cat.desc}
                </p>

                {/* 底部：题目数量 + 箭头 */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink/40">
                    {loading ? (
                      '加载中...'
                    ) : (
                      <>{count > 0 ? `${count} 道题` : '暂无题目'}</>
                    )}
                  </span>
                  <ArrowRight className="w-5 h-5 text-ink/30 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 全部题库 */}
      <div className="mb-6">
        <h2 className="font-display text-xl font-bold mb-2 flex items-center gap-2">
          <Library className="w-5 h-5 text-accent" />
          全部题库
        </h2>
        <p className="text-sm text-ink/50">{banksLoading ? '加载中...' : `共 ${banks.length} 个题库`}</p>
      </div>

      {banksLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-surface-border p-6 h-32 animate-pulse"
            />
          ))}
        </div>
      ) : banks.length === 0 ? (
        <div className="text-center py-12 text-ink/40 bg-white rounded-2xl border border-surface-border">
          暂无题库
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((bank) => (
            <Link
              key={bank.id}
              href={`/problems?bankId=${bank.id}`}
              className="group bg-white rounded-2xl border border-surface-border p-6 hover:border-accent/40 hover:shadow-md transition-all duration-300"
            >
              <h3 className="font-display text-lg font-bold mb-2 group-hover:text-accent transition-colors">
                {bank.title}
              </h3>
              <p className="text-sm text-ink/50 leading-relaxed line-clamp-2 mb-4">
                {bank.description || '暂无描述'}
              </p>
              <div className="flex items-center text-sm text-accent font-medium">
                <span>进入练习</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
