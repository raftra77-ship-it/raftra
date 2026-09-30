import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { GlowButton } from '../GlowButton';

/**
 * Structured editing for the parts of the brand kit that are objects rather than prose.
 *
 * These sections were display-only: Differentiators, Products & Services, Customer Jobs,
 * the Voice Guide, Messaging and Claims could be read but not corrected, so a wrong
 * extraction could only be fixed by re-running onboarding and hoping for a better answer.
 * Audience Personas were worse than read-only - they had a text editor that rewrote each
 * persona as {persona, hook}, discarding the ten other fields the schema defines
 * (need, pain_points, goals, categories, objections, decision_factors, evidence...).
 * Losing `categories` in particular breaks the persona-to-product graph, which is what
 * answers "what should we promote to this segment".
 *
 * Two rules hold everywhere in this file:
 *
 *  1. An edit never drops a key. Every save spreads the original record and overwrites
 *     only the fields on screen, so `evidence` and anything a future extraction adds
 *     survive being edited by hand.
 *  2. A field left blank is stored blank, not removed. The backend's own schema defaults
 *     every field to empty for the same reason: a missing warranty is a fact about the
 *     brand, and inventing one is the failure the whole evidence layer exists to prevent.
 */

export type StructuredKind =
  'usps' | 'catalogue' | 'jtbd' | 'voice' | 'messaging' | 'claims' | 'personas';

type FieldKind = 'text' | 'area' | 'list';

interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
}

interface ArraySpec {
  /** The key inside `guidelines` this array is stored under. */
  storeKey: string;
  itemLabel: string;
  fields: FieldSpec[];
  /** Records that carry a citation get the evidence sub-form. */
  evidence: boolean;
  /** Headline for a collapsed row. */
  titleOf: (item: Record<string, unknown>) => string;
}

const S = (v: unknown): string => (v == null ? '' : String(v));
const L = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(S).filter(Boolean) : S(v).split('\n').map(x => x.trim()).filter(Boolean);

/* ── specs ─────────────────────────────────────────────────────────── */

const ARRAY_SPECS: Record<string, ArraySpec> = {
  usps: {
    storeKey: 'structured_usps',
    itemLabel: 'Differentiator',
    evidence: true,
    titleOf: it => S(it.name) || S(it.feature) || 'Untitled differentiator',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', hint: "The differentiator's own name, e.g. 'Dri-FIT ADV'" },
      { key: 'feature', label: 'What it technically is', kind: 'area' },
      { key: 'benefit', label: 'What the customer gets, in their terms', kind: 'area' },
      { key: 'audience', label: 'Who specifically cares', kind: 'text' },
      { key: 'messaging_angle', label: 'How to lead with it in an ad', kind: 'area' },
    ],
  },
  catalogue: {
    storeKey: 'catalogue',
    itemLabel: 'Category',
    evidence: true,
    titleOf: it => S(it.name) || 'Untitled category',
    fields: [
      { key: 'name', label: 'Category name', kind: 'text' },
      { key: 'products', label: 'Named products', kind: 'list', hint: 'One per line.' },
      { key: 'features', label: 'Features', kind: 'list', hint: 'One per line.' },
      { key: 'benefit', label: 'The outcome the customer gets', kind: 'area' },
      { key: 'technologies', label: 'Named tech or materials', kind: 'list', hint: 'One per line.' },
      { key: 'use_case', label: 'The situation it is bought for', kind: 'text' },
      { key: 'audience', label: 'Which persona this serves', kind: 'text', hint: 'Match a persona name to link them in the brand graph.' },
      { key: 'price_range', label: 'Price range', kind: 'text', hint: 'Only if the site shows prices.' },
    ],
  },
  jtbd: {
    storeKey: 'jobs_to_be_done',
    itemLabel: 'Customer job',
    evidence: true,
    titleOf: it => S(it.situation) || S(it.problem) || 'Untitled job',
    fields: [
      { key: 'situation', label: 'Situation', kind: 'area' },
      { key: 'problem', label: 'Problem', kind: 'area' },
      { key: 'desired_outcome', label: 'Desired outcome', kind: 'area' },
      { key: 'brand_response', label: 'What the brand offers for it', kind: 'area' },
    ],
  },
  personas: {
    storeKey: 'target_audiences',
    itemLabel: 'Persona',
    evidence: true,
    titleOf: it => S(it.persona) || 'Untitled persona',
    fields: [
      { key: 'persona', label: 'Persona', kind: 'text', hint: 'Named by need or behaviour, not demographics.' },
      { key: 'need', label: 'Core need that defines this segment', kind: 'area' },
      { key: 'pain_points', label: 'Pain points', kind: 'list', hint: 'One per line.' },
      { key: 'goals', label: 'Goals', kind: 'list', hint: 'One per line.' },
      { key: 'buying_motivation', label: 'What triggers the purchase', kind: 'area' },
      { key: 'categories', label: 'Product categories they buy', kind: 'list', hint: 'One per line. These links are what let agents answer "what should we promote to this segment".' },
      { key: 'objections', label: 'Why they might not buy', kind: 'list', hint: 'One per line.' },
      { key: 'decision_factors', label: 'What they compare on', kind: 'list', hint: 'One per line.' },
      { key: 'desired_outcome', label: 'Desired outcome', kind: 'area' },
      { key: 'messaging_angle', label: 'The angle that lands with them', kind: 'area' },
      { key: 'hook', label: 'One-line ad hook', kind: 'area' },
    ],
  },
};

const VOICE_SCALARS: FieldSpec[] = [
  { key: 'formality', label: 'Formality', kind: 'text', hint: "e.g. 'informal but not slangy'" },
  { key: 'energy', label: 'Energy', kind: 'text', hint: "e.g. 'high, imperative'" },
  { key: 'sentence_style', label: 'Sentence style', kind: 'text', hint: "e.g. 'short, verb-first'" },
  { key: 'vocabulary', label: 'Vocabulary', kind: 'text' },
  { key: 'cta_style', label: 'How calls to action are phrased', kind: 'text' },
];
const VOICE_LISTS: FieldSpec[] = [
  { key: 'use_words', label: 'Words to use', kind: 'list', hint: 'One per line.' },
  { key: 'avoid_words', label: 'Words to avoid', kind: 'list', hint: 'One per line.' },
  { key: 'dos', label: "Do's", kind: 'list', hint: 'One per line.' },
  { key: 'donts', label: "Don'ts", kind: 'list', hint: 'One per line.' },
];
const TRAIT_FIELDS: FieldSpec[] = [
  { key: 'trait', label: 'Trait', kind: 'text' },
  { key: 'sounds_like', label: 'How it reads in a sentence', kind: 'area' },
  { key: 'example', label: 'One line written in this voice', kind: 'area' },
  { key: 'avoid', label: 'The failure mode of this trait', kind: 'area' },
];
const SUPPORTING_FIELDS: FieldSpec[] = [
  { key: 'message', label: 'Supporting message', kind: 'area' },
  { key: 'proof_points', label: 'Proof points', kind: 'list', hint: 'One per line — products or features that back it.' },
];

/* ── primitives ────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: '10px', color: '#fff', padding: '9px 12px', fontSize: '13px',
  lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
};

const Label: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div style={{ marginBottom: '5px' }}>
    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </div>
    {hint && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>}
  </div>
);

const Field: React.FC<{
  spec: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}> = ({ spec, value, onChange }) => (
  <div>
    <Label hint={spec.hint}>{spec.label}</Label>
    {spec.kind === 'text' ? (
      <input
        value={S(value)}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    ) : (
      <textarea
        value={spec.kind === 'list' ? (Array.isArray(value) ? value.map(S).join('\n') : S(value)) : S(value)}
        onChange={e => onChange(spec.kind === 'list' ? L(e.target.value) : e.target.value)}
        rows={spec.kind === 'list' ? 4 : 2}
        style={inputStyle}
      />
    )}
  </div>
);

/** Evidence stays editable rather than hidden: a hand-written record with a real source URL
 *  counts toward evidence coverage exactly as an extracted one does, and someone correcting
 *  a claim is usually looking at the page that proves it. */
const EvidenceForm: React.FC<{
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}> = ({ value, onChange }) => {
  const ev = (value || {}) as Record<string, unknown>;
  const set = (k: string, v: unknown) => onChange({ ...ev, [k]: v });
  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', marginTop: '4px',
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px,100%), 1fr))', gap: '12px',
    }}>
      <div style={{ gridColumn: '1 / -1' }}>
        <Label hint="The page this came from. A record with a real source URL counts as cited.">Source URL</Label>
        <input value={S(ev.source_url)} onChange={e => set('source_url', e.target.value)} style={inputStyle} />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <Label>Snippet</Label>
        <textarea value={S(ev.snippet)} onChange={e => set('snippet', e.target.value)} rows={2} style={inputStyle} />
      </div>
      <div>
        <Label>Basis</Label>
        <select value={S(ev.basis) || 'stated'} onChange={e => set('basis', e.target.value)} style={inputStyle}>
          <option value="stated">stated — the site says it</option>
          <option value="inferred">inferred — concluded from it</option>
        </select>
      </div>
      <div>
        <Label>Confidence</Label>
        <select value={S(ev.confidence) || 'medium'} onChange={e => set('confidence', e.target.value)} style={inputStyle}>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
      </div>
    </div>
  );
};

const RowButton: React.FC<{
  onClick: () => void; title: string; danger?: boolean; disabled?: boolean; children: React.ReactNode;
}> = ({ onClick, title, danger, disabled, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    disabled={disabled}
    style={{
      background: danger ? 'rgba(255,71,87,0.08)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${danger ? 'rgba(255,71,87,0.25)' : 'rgba(255,255,255,0.12)'}`,
      color: danger ? '#ff6b7a' : '#fff', borderRadius: '8px', padding: '5px 8px',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.35 : 1,
      display: 'flex', alignItems: 'center',
    }}
  >
    {children}
  </button>
);

/** One collapsible record with reorder and delete. */
const RecordCard: React.FC<{
  title: string;
  index: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  children: React.ReactNode;
}> = ({ title, index, total, open, onToggle, onMove, onDelete, children }) => (
  <div style={{
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '14px', overflow: 'hidden',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px' }}>
      <button
        onClick={onToggle}
        style={{
          background: 'none', border: 'none', color: '#fff', cursor: 'pointer', flex: 1,
          display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left',
          fontSize: '13.5px', fontWeight: 700, padding: 0, minWidth: 0,
        }}
      >
        {open ? <ChevronDown size={14} color="#FF6B00" /> : <ChevronRight size={14} color="#FF6B00" />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </button>
      <RowButton onClick={() => onMove(-1)} title="Move up" disabled={index === 0}><ChevronUp size={13} /></RowButton>
      <RowButton onClick={() => onMove(1)} title="Move down" disabled={index === total - 1}><ChevronDown size={13} /></RowButton>
      <RowButton onClick={onDelete} title="Delete" danger><Trash2 size={13} /></RowButton>
    </div>
    {open && (
      <div style={{
        padding: '4px 14px 16px', display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px,100%), 1fr))', gap: '12px',
      }}>
        {children}
      </div>
    )}
  </div>
);

const AddButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      background: 'rgba(255,107,0,0.12)', border: '1px dashed rgba(255,107,0,0.45)',
      color: '#FF6B00', borderRadius: '12px', padding: '10px 16px', fontSize: '12.5px',
      fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center',
      gap: '7px', justifyContent: 'center',
    }}
  >
    <Plus size={14} /> {label}
  </button>
);

/* ── array editor ──────────────────────────────────────────────────── */

const ArrayEditor: React.FC<{
  spec: ArraySpec;
  items: Record<string, unknown>[];
  onChange: (items: Record<string, unknown>[]) => void;
}> = ({ spec, items, onChange }) => {
  const [open, setOpen] = useState<number | null>(items.length ? 0 : null);

  const update = (i: number, patch: Record<string, unknown>) =>
    // Spread the original first: fields not on screen (and anything a future extraction
    // adds) must survive an edit.
    onChange(items.map((it, n) => (n === i ? { ...it, ...patch } : it)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    setOpen(o => (o === i ? j : o === j ? i : o));
  };

  const add = () => {
    const blank: Record<string, unknown> = {};
    spec.fields.forEach(f => { blank[f.key] = f.kind === 'list' ? [] : ''; });
    if (spec.evidence) blank.evidence = { source_url: '', snippet: '', confidence: 'medium', basis: 'stated' };
    onChange([...items, blank]);
    setOpen(items.length);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((item, i) => (
        <RecordCard
          key={i}
          title={spec.titleOf(item) || `${spec.itemLabel} ${i + 1}`}
          index={i}
          total={items.length}
          open={open === i}
          onToggle={() => setOpen(o => (o === i ? null : i))}
          onMove={d => move(i, d)}
          onDelete={() => { onChange(items.filter((_, n) => n !== i)); setOpen(null); }}
        >
          {spec.fields.map(f => (
            <div key={f.key} style={{ gridColumn: f.kind === 'text' ? 'auto' : '1 / -1' }}>
              <Field spec={f} value={item[f.key]} onChange={v => update(i, { [f.key]: v })} />
            </div>
          ))}
          {spec.evidence && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EvidenceForm
                value={(item.evidence as Record<string, unknown>) || {}}
                onChange={v => update(i, { evidence: v })}
              />
            </div>
          )}
        </RecordCard>
      ))}
      <AddButton label={`Add ${spec.itemLabel.toLowerCase()}`} onClick={add} />
    </div>
  );
};

/* ── the exported editor ───────────────────────────────────────────── */

interface Props {
  kind: StructuredKind;
  guidelines: Record<string, unknown>;
  saving: boolean;
  error: string | null;
  /** A partial guidelines object — merged over the stored one by the caller. */
  onSave: (patch: Record<string, unknown>) => void;
  onCancel: () => void;
}

export const BrandStructuredEditor: React.FC<Props> = ({
  kind, guidelines, saving, error, onSave, onCancel,
}) => {
  const g = guidelines || {};

  const asArray = (key: string): Record<string, unknown>[] => {
    const v = g[key];
    return Array.isArray(v) ? (v as Record<string, unknown>[]).filter(x => x && typeof x === 'object') : [];
  };
  const asObject = (key: string): Record<string, unknown> => {
    const v = g[key];
    return v && typeof v === 'object' && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
  };

  // Local draft. Nothing is written until Save, so Cancel genuinely discards.
  const arraySpec = ARRAY_SPECS[kind];
  const [rows, setRows] = useState<Record<string, unknown>[]>(
    arraySpec ? asArray(arraySpec.storeKey) : []);
  const [voice, setVoice] = useState<Record<string, unknown>>(() => asObject('voice'));
  const [messaging, setMessaging] = useState<Record<string, unknown>>(() => asObject('messaging'));
  const [verified, setVerified] = useState<string[]>(() => L(g.verified_claims));
  const [unsupported, setUnsupported] = useState<string[]>(() => L(g.unsupported_topics));

  const submit = () => {
    if (arraySpec) { onSave({ [arraySpec.storeKey]: rows }); return; }
    if (kind === 'voice') { onSave({ voice }); return; }
    if (kind === 'messaging') { onSave({ messaging }); return; }
    onSave({ verified_claims: verified, unsupported_topics: unsupported });
  };

  const setV = (k: string, v: unknown) => setVoice(p => ({ ...p, [k]: v }));
  const setM = (k: string, v: unknown) => setMessaging(p => ({ ...p, [k]: v }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {arraySpec && (
        <ArrayEditor spec={arraySpec} items={rows} onChange={setRows} />
      )}

      {kind === 'voice' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))', gap: '12px' }}>
            {VOICE_SCALARS.map(f => (
              <Field key={f.key} spec={f} value={voice[f.key]} onChange={v => setV(f.key, v)} />
            ))}
          </div>

          <div>
            <Label hint="What each trait sounds like, an example line, and its failure mode.">Voice traits</Label>
            <ArrayEditor
              spec={{
                storeKey: 'traits', itemLabel: 'Trait', evidence: false,
                titleOf: it => S(it.trait) || 'Untitled trait', fields: TRAIT_FIELDS,
              }}
              items={Array.isArray(voice.traits) ? (voice.traits as Record<string, unknown>[]) : []}
              onChange={v => setV('traits', v)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))', gap: '12px' }}>
            {VOICE_LISTS.map(f => (
              <Field key={f.key} spec={f} value={voice[f.key]} onChange={v => setV(f.key, v)} />
            ))}
          </div>
        </>
      )}

      {kind === 'messaging' && (
        <>
          <Field
            spec={{ key: 'core_message', label: 'Core message', kind: 'area', hint: 'The one thing the brand wants believed.' }}
            value={messaging.core_message}
            onChange={v => setM('core_message', v)}
          />

          <div>
            <Label hint="Each supporting message with the products or features that prove it.">Supporting messages</Label>
            <ArrayEditor
              spec={{
                storeKey: 'supporting', itemLabel: 'Supporting message', evidence: false,
                titleOf: it => S(it.message) || 'Untitled message', fields: SUPPORTING_FIELDS,
              }}
              items={Array.isArray(messaging.supporting) ? (messaging.supporting as Record<string, unknown>[]) : []}
              onChange={v => setM('supporting', v)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px,100%), 1fr))', gap: '12px' }}>
            <Field spec={{ key: 'emotional_benefits', label: 'Emotional benefits', kind: 'list', hint: 'One per line — how the customer should feel.' }}
                   value={messaging.emotional_benefits} onChange={v => setM('emotional_benefits', v)} />
            <Field spec={{ key: 'functional_benefits', label: 'Functional benefits', kind: 'list', hint: 'One per line — what they practically get.' }}
                   value={messaging.functional_benefits} onChange={v => setM('functional_benefits', v)} />
            <Field spec={{ key: 'angles', label: 'Messaging angles', kind: 'list', hint: 'One per line — different ways to land the same value.' }}
                   value={messaging.angles} onChange={v => setM('angles', v)} />
          </div>
        </>
      )}

      {kind === 'claims' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px,100%), 1fr))', gap: '14px' }}>
          <Field
            spec={{
              key: 'verified_claims', label: 'Verified claims — safe to repeat in an ad', kind: 'list',
              hint: 'One per line. Certifications, warranty terms, shipping and returns terms, partnerships — things the site states outright.',
            }}
            value={verified}
            onChange={v => setVerified(v as string[])}
          />
          <Field
            spec={{
              key: 'unsupported_topics', label: 'Unsupported topics — an ad must NOT claim these', kind: 'list',
              hint: 'One per line. Things the site never establishes.',
            }}
            value={unsupported}
            onChange={v => setUnsupported(v as string[])}
          />
        </div>
      )}

      {error && <div style={{ fontSize: '12.5px', color: '#ff4757' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <GlowButton variant="glow" onClick={submit} disabled={saving} style={{ padding: '8px 20px', fontSize: '12.5px' }}>
          {saving ? 'Saving…' : 'Save'}
        </GlowButton>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-secondary)', padding: '8px 18px', borderRadius: '100px',
            fontSize: '12.5px', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
