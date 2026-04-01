import { useState, useRef, useEffect } from 'react';

interface SectionMenuProps {
  id: string;
  download?: {
    url: string;
    filename: string;
  };
}

export default function SectionMenu({ id, download }: SectionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.hash = id;
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setIsOpen(false);
    }, 1500);
  };

  const handleDownload = () => {
    if (!download) return;
    window.open(download.url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-oh-text-muted hover:text-oh-text hover:bg-oh-bg rounded transition-colors"
        aria-label="Section options"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-oh-surface border border-oh-border rounded shadow-lg z-10">
          <button
            onClick={handleCopyLink}
            className="w-full text-left px-3 py-2 text-sm text-oh-text hover:bg-oh-bg hover:text-oh-primary transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-oh-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <span>🔗</span>
                <span>Copy link</span>
              </>
            )}
          </button>
          {download && (
            <button
              onClick={handleDownload}
              className="w-full text-left px-3 py-2 text-sm text-oh-text hover:bg-oh-bg hover:text-oh-primary transition-colors flex items-center gap-2"
            >
              <span>📥</span>
              <span>Download file</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
