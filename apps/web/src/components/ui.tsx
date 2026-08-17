/**
 * ui.tsx — Component nhỏ tái dùng (design system, xem docs/DESIGN.md).
 */
import type { CSSProperties, ReactNode } from 'react';
import type { WordEntry } from '@english/shared';
import { posList } from '../lib/format';
import { speak } from '../lib/tts';

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size,
  onClick,
  disabled,
  className = '',
  title,
  style,
}: {
  children: ReactNode;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  size?: 'sm' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  const cls = ['btn', variant !== 'primary' ? variant : '', size ? size : '', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} onClick={onClick} disabled={disabled} title={title} style={style}>
      {children}
    </button>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button className={`chip ${active ? 'active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/** Vòng tiến độ (SVG) — hiệu ứng đếm nhẹ, dùng cho hero/hoàn tất */
export function ProgressRing({
  pct,
  size = 84,
  stroke = 9,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div
      className="ring-wrap"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${p}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c - (c * p) / 100}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Stat({ children }: { children: ReactNode }) {
  return <span className="stat">{children}</span>;
}

export function PosChips({ entry }: { entry: WordEntry }) {
  const pos = posList(entry);
  if (!pos.length) return null;
  return (
    <>
      {pos.map((p) => (
        <span key={p} className="pos-chip">
          {p}
        </span>
      ))}
    </>
  );
}

/** Nút nghe phát âm (🔈) */
export function Speak({ text, lang, title }: { text: string; lang: string; title?: string }) {
  return (
    <button
      className="speak-btn"
      title={title || 'Nghe phát âm'}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, lang);
      }}
    >
      🔈
    </button>
  );
}

export function EmptyState({
  big,
  title,
  children,
}: {
  big: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="big">{big}</div>
      {title && <h2 style={{ margin: '0 0 6px' }}>{title}</h2>}
      {children}
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="toast show">{msg}</div>;
}

/** Nghĩa đầy đủ 1 entry: từ + IPA + nghĩa + ví dụ (thẻ học từ) */
export function WordBlock({ entry }: { entry: WordEntry }) {
  const s0 = entry.senses?.[0];
  return (
    <div className="learn-card">
      <div className="learn-word" style={{ fontSize: 24, fontWeight: 800 }}>
        {entry.word}
      </div>
      {s0?.pronunciation ? <div className="ipa">{s0.pronunciation}</div> : null}
      <div style={{ margin: '6px 0' }}>
        <PosChips entry={entry} />
      </div>
      {s0?.meaning?.vi ? <div className="def">{s0.meaning.vi}</div> : null}
      {s0?.meaning?.en ? (
        <div className="en" style={{ color: 'var(--ink-3)', fontSize: 13 }}>
          {s0.meaning.en}
        </div>
      ) : null}
      {s0?.examples?.[0] ? (
        <div
          className="ex"
          style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 13, marginTop: 6 }}
        >
          ❝ {s0.examples[0]}
        </div>
      ) : null}
    </div>
  );
}
