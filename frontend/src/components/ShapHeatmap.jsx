import React from 'react';
import { motion } from 'framer-motion';
import './ShapHeatmap.css';

export default function ShapHeatmap({ data }) {
  if (!data?.tokens?.length) return null;
  const { tokens, scores_normalized, scores, pred_label } = data;

  const predColor =
    pred_label === 'Depression' ? 'var(--risk-high)'     :
    pred_label === 'Anxiety'    ? 'var(--risk-moderate)' :
                                  'var(--risk-low)';

  return (
    <div className="shap-root">
      <div className="shap-header">
        <div className="shap-header-left">
          <span className="shap-icon">⬡</span>
          <div>
            <div className="shap-title">Token Saliency Analysis</div>
            <div className="shap-sub">
              Gradient × Embedding Attribution ·{' '}
              <strong style={{ color: predColor }}>{pred_label}</strong>
              {' '}· {tokens.length} tokens
            </div>
          </div>
        </div>
        <div className="shap-legend">
          <div className="shap-legend-item">
            <div className="shap-legend-swatch" style={{ background: 'var(--c03)' }} />
            <span>Low</span>
          </div>
          <div className="shap-grad" />
          <div className="shap-legend-item">
            <div className="shap-legend-swatch" style={{ background: 'var(--c07)' }} />
            <span>High</span>
          </div>
        </div>
      </div>

      <div className="shap-tokens">
        {tokens.map((token, i) => {
          const norm = scores_normalized?.[i] ?? 0;
          const raw  = scores?.[i] ?? 0;
          const v    = Math.pow(norm, 0.55);

          // Coffee gradient: c03 (#EDD9C0) → c07 (#A06830)
          const r = Math.round(237 + (160 - 237) * v);
          const g = Math.round(217 + (104 - 217) * v);
          const b = Math.round(192 + (48  - 192) * v);
          const alpha = 0.35 + v * 0.6;
          const textColor =
            v > 0.68 ? 'var(--c00)' :
            v > 0.35 ? 'var(--c08)' :
                       'var(--text-3)';

          return (
            <motion.div
              key={i}
              className="shap-token"
              style={{
                background:  `rgba(${r},${g},${b},${alpha})`,
                borderColor: `rgba(${r},${g},${b},${Math.min(alpha * 1.6, 0.8)})`,
                color: textColor,
                boxShadow: v > 0.6
                  ? `0 2px 8px rgba(${r},${g},${b},0.18)`
                  : 'none',
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.012, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              title={`Saliency: ${raw.toFixed(4)}`}
            >
              <span className="token-word">{token || '·'}</span>
              <span className="token-rank">{Math.round(norm * 100)}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="shap-bars">
        {tokens.slice(0, 10).map((token, i) => {
          const norm = scores_normalized?.[i] ?? 0;
          const v    = Math.pow(norm, 0.55);
          /* Bar uses c05→c07 range */
          const r = Math.round(200 + (160 - 200) * v);
          const g = Math.round(164 + (104 - 164) * v);
          const bv = Math.round(120 + (48  - 120) * v);
          return (
            <div key={i} className="shap-bar-item">
              <motion.div
                className="shap-bar-fill"
                initial={{ height: 0 }}
                animate={{ height: `${v * 52}px` }}
                transition={{ delay: 0.3 + i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: `rgba(${r},${g},${bv},${0.3 + v * 0.7})` }}
              />
              <span className="shap-bar-label">{token?.slice(0, 5) || '·'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}