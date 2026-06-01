import { useEffect, useRef, useState } from 'react';
import { onQuickPromptOpen, _resolveQuickPrompt, type QuickPromptOpts } from '@/services/quickPrompt';

export function QuickPromptModal() {
  const [opts, setOpts] = useState<QuickPromptOpts | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    return onQuickPromptOpen((o) => {
      setOpts(o);
      setValue(o.defaultValue || '');
      setTimeout(() => inputRef.current?.focus(), 60);
    });
  }, []);

  if (!opts) return null;

  const close = (result: string | null) => {
    setOpts(null);
    _resolveQuickPrompt(result);
  };

  const submit = () => close(value);
  const cancel = () => close(null);

  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        {opts.title && <h2 style={{ marginBottom: 8 }}>{opts.title}</h2>}
        {opts.message && (
          <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: opts.title ? 0 : -4, marginBottom: 14, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {opts.message}
          </p>
        )}
        <div className="frow">
          {opts.multiline ? (
            <textarea
              ref={inputRef as any}
              className="finput"
              placeholder={opts.placeholder || ''}
              value={value}
              rows={opts.rows || 4}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
                else if (e.key === 'Escape') cancel();
              }}
            />
          ) : (
            <input
              ref={inputRef as any}
              className="finput"
              placeholder={opts.placeholder || ''}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                else if (e.key === 'Escape') cancel();
              }}
            />
          )}
        </div>
        <div className="mfoot">
          <button className="btn btn-ghost" onClick={cancel}>{opts.cancelLabel || 'Cancelar'}</button>
          <button className="btn btn-primary" onClick={submit}>{opts.okLabel || 'OK'}</button>
        </div>
      </div>
    </div>
  );
}
