import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { NavItem } from '../lib/microcms';

type Props = {
  navigation: NavItem[];
  currentPath: string;
};

export default function Header({ navigation, currentPath }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-electric-blue to-deep-purple flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold tracking-wider text-gray-900">
                BizArch Design
              </span>
              <span className="block text-[10px] text-gray-400 tracking-widest uppercase">
                Architecture × AI
              </span>
            </div>
          </a>

          {/* Desktop Navigation - microCMSから動的に描画 */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => {
              const isActive = currentPath === item.slug ||
                (item.slug !== '/' && currentPath.startsWith(item.slug));
              return (
                <a
                  key={item.id}
                  href={item.slug}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'text-electric-blue bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }
                  `}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* CTA Button (Desktop) */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="/contact/"
              className="px-5 py-2.5 bg-gradient-to-r from-electric-blue to-deep-purple text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
            >
              無料相談
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="メニューを開く"
          >
            <div className="w-5 h-5 relative flex flex-col justify-center gap-1">
              <motion.span
                animate={isMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }}
                className="block h-0.5 w-5 bg-gray-900 origin-center"
              />
              <motion.span
                animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                className="block h-0.5 w-5 bg-gray-900"
              />
              <motion.span
                animate={isMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
                className="block h-0.5 w-5 bg-gray-900 origin-center"
              />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden overflow-hidden bg-white border-t border-gray-100"
          >
            <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
              {navigation.map((item) => {
                const isActive = currentPath === item.slug ||
                  (item.slug !== '/' && currentPath.startsWith(item.slug));
                return (
                  <a
                    key={item.id}
                    href={item.slug}
                    className={`
                      px-4 py-3 rounded-lg text-sm font-medium transition-colors
                      ${isActive
                        ? 'text-electric-blue bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    {item.label}
                  </a>
                );
              })}
              <div className="pt-3 mt-2 border-t border-gray-100">
                <a
                  href="/contact/"
                  className="block text-center px-5 py-3 bg-gradient-to-r from-electric-blue to-deep-purple text-white text-sm font-medium rounded-lg"
                >
                  無料相談
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
