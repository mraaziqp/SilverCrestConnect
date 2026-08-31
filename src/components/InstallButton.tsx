/**
 * "Install app" button.
 *
 * Installing a web app is buried in a browser menu that most people never
 * open, and the whole point of the separate dashboard manifest is to give
 * Wesley a tile that opens straight into /admin. So the browser's own prompt is
 * captured when it is offered, and surfaced as an ordinary button.
 *
 * It renders nothing unless an install is actually possible — already
 * installed, unsupported browser, or the prompt already used, and there is
 * nothing worth showing. iOS never fires the event at all, so there it falls
 * back to telling you where the option lives, which is the only thing anyone
 * can do about Safari.
 */

import React, { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Safari on iPhone and iPad, where installing is a manual Share-sheet step. */
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

export const InstallButton: React.FC<{ label?: string; className?: string }> = ({
  label = 'Install app',
  className = '',
}) => {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Chrome would otherwise show its own mini-infobar; taking the event lets
      // the button decide when to ask.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const iosOnly = !prompt && isIosSafari();
  if (!prompt && !iosOnly) return null;

  const base =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border border-gold/40 text-gold ' +
    'text-xs font-semibold hover:bg-gold/10 transition-colors';

  if (iosOnly) {
    return (
      <div className={className}>
        <button type="button" onClick={() => setShowIosHint((v) => !v)} className={base}>
          <Share className="w-3.5 h-3.5" aria-hidden="true" />
          {label}
        </button>
        {showIosHint && (
          <p className="mt-2 text-[11.5px] text-muted leading-relaxed max-w-xs">
            In Safari, tap the Share button, then <strong className="text-bone">Add to Home Screen</strong>.
            It will open here directly, without the browser bars.
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${base} ${className}`}
      onClick={async () => {
        try {
          await prompt!.prompt();
          await prompt!.userChoice;
        } finally {
          // The event is single-use either way.
          setPrompt(null);
        }
      }}
    >
      <Download className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </button>
  );
};
