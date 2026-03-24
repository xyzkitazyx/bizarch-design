import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type FormData = {
  name: string;
  email: string;
  company: string;
  message: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

export default function ContactForm() {
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    if (!form.name.trim()) newErrors.name = 'お名前を入力してください';
    if (!form.email.trim()) {
      newErrors.email = 'メールアドレスを入力してください';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = '有効なメールアドレスを入力してください';
    }
    if (!form.message.trim()) newErrors.message = 'お問い合わせ内容を入力してください';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // 入力時にそのフィールドのエラーをクリア
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    // 疑似的な通信（2秒後に完了）
    // 本番環境では fetch('/api/send-mail.php', ...) に差し替え
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setToast({ type: 'success', message: 'お問い合わせを送信しました。2営業日以内にご返信いたします。' });
    setForm({ name: '', email: '', company: '', message: '' });

    // 5秒後にトーストを消す
    setTimeout(() => setToast(null), 5000);
  }, [validate]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Toast通知 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4"
          >
            <div
              className={`
                flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-xl border
                ${toast.type === 'success'
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
                  : 'bg-red-50/95 border-red-200 text-red-800'
                }
              `}
            >
              {toast.type === 'success' ? (
                <svg className="w-6 h-6 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
              )}
              <p className="text-sm font-medium">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="ml-auto p-1 hover:opacity-70 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* フォーム本体 */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* お名前 */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="山田 太郎"
            className={`
              w-full px-4 py-3 rounded-xl border bg-white transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue
              ${errors.name ? 'border-red-300 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}
            `}
          />
          <AnimatePresence>
            {errors.name && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-500 text-xs mt-1.5 ml-1"
              >
                {errors.name}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* メールアドレス */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="taro@example.com"
            className={`
              w-full px-4 py-3 rounded-xl border bg-white transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue
              ${errors.email ? 'border-red-300 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}
            `}
          />
          <AnimatePresence>
            {errors.email && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-500 text-xs mt-1.5 ml-1"
              >
                {errors.email}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* 会社名 */}
        <div>
          <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-2">
            会社名
          </label>
          <input
            type="text"
            id="company"
            name="company"
            value={form.company}
            onChange={handleChange}
            placeholder="株式会社〇〇"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue"
          />
        </div>

        {/* お問い合わせ内容 */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
            お問い合わせ内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            value={form.message}
            onChange={handleChange}
            rows={6}
            placeholder="ご質問やご相談内容をご記入ください"
            className={`
              w-full px-4 py-3 rounded-xl border bg-white transition-all duration-200 resize-none
              focus:outline-none focus:ring-2 focus:ring-electric-blue/20 focus:border-electric-blue
              ${errors.message ? 'border-red-300 bg-red-50/30' : 'border-gray-200 hover:border-gray-300'}
            `}
          />
          <AnimatePresence>
            {errors.message && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-500 text-xs mt-1.5 ml-1"
              >
                {errors.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* 送信ボタン */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`
              w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold text-base transition-all duration-300
              ${isSubmitting
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-electric-blue to-deep-purple text-white hover:shadow-xl hover:shadow-blue-500/25'
              }
            `}
          >
            {isSubmitting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full"
                />
                送信中...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
                送信する
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
