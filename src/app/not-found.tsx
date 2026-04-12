import Link from 'next/link';
import { QrCode, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Animated QR code icon */}
        <div className="mb-8 relative inline-block">
          <div className="w-24 h-24 rounded-2xl bg-[#007BFF]/10 dark:bg-[#007BFF]/20 flex items-center justify-center mx-auto">
            <QrCode className="w-12 h-12 text-[#007BFF]" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#FFC107] flex items-center justify-center">
            <span className="text-sm font-bold text-gray-900">!</span>
          </div>
        </div>

        {/* Error code */}
        <h1 className="text-8xl font-extrabold text-gray-200 dark:text-gray-800 mb-2">
          404
        </h1>

        {/* Message */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Page introuvable
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          La page que vous recherchez n&apos;existe pas ou a &eacute;t&eacute; d&eacute;plac&eacute;e.
          V&eacute;rifiez l&apos;URL ou retournez &agrave; l&apos;accueil.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#007BFF] hover:bg-[#0056b3] text-white font-semibold rounded-xl transition-colors"
          >
            <Home className="w-4 h-4" />
            Retour &agrave; l&apos;accueil
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Page pr&eacute;c&eacute;dente
          </button>
        </div>
      </div>
    </div>
  );
}
