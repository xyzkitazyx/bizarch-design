import { useState, type FormEvent } from 'react';
import { api, saveToken } from '@/lib/api';

export default function LoginForm() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      try {
        // 本番: PHP API auth.php を呼び、サーバ側でbcrypt検証 → トークン+CSRFを取得
        await api.login(id, password);
      } catch (apiErr: any) {
        // ローカル開発時のフォールバック（PHPが起動していない場合のみ許可）
        const isLocal =
          typeof window !== 'undefined' &&
          !window.location.hostname.includes('bizarch-design.com');
        if (isLocal && id === 'admin' && password === 'chacha-2026') {
          saveToken('dev-stub-token');
        } else {
          throw apiErr;
        }
      }
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      window.location.href = `${base}/dashboard/`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-gray-100"
    >
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-brand text-white text-xl font-black mb-3">
          B
        </div>
        <h1 className="text-2xl font-black text-gray-900">
          <span className="text-gradient">bizarch</span> CMS2
        </h1>
        <p className="text-sm text-gray-500 mt-1">ビジュアルエディタ管理画面</p>
      </div>

      <label className="block mb-4">
        <span className="text-xs font-bold text-gray-700">ユーザーID</span>
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
          autoComplete="username"
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-electric-blue/20"
          placeholder="admin"
        />
      </label>

      <label className="block mb-6">
        <span className="text-xs font-bold text-gray-700">パスワード</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-electric-blue focus:outline-none focus:ring-2 focus:ring-electric-blue/20"
          placeholder="••••••••"
        />
      </label>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? '認証中...' : 'ログイン'}
      </button>

      <p className="mt-6 text-[11px] text-gray-400 text-center leading-relaxed">
        初期ID: <code className="px-1.5 py-0.5 rounded bg-gray-100">admin / chacha-2026</code>
        <br />
        本番運用前に必ずパスワードを変更してください
      </p>
    </form>
  );
}
