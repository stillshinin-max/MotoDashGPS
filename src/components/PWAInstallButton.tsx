import React from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenApkGuide: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onOpenApkGuide }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();

  if (isInstalled) {
    return (
      <button
        type="button"
        onClick={onOpenApkGuide}
        className="min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-200/80 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="w-4 h-4 text-sky-500" />
        <span>Get Android .APK</span>
      </button>
    );
  }

  if (isInstallable) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={install}
          className="min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Install Now</span>
        </button>
        <button
          type="button"
          onClick={onOpenApkGuide}
          className="min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-4 h-4" />
          <span>Get .APK</span>
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenApkGuide}
      className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
    >
      <Download className="w-4 h-4" />
      <span>Get Android .APK</span>
    </button>
  );
};
