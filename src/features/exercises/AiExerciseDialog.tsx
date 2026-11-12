import { useMemo, useState } from 'react';
import { type AiResult, buildPrompt, exerciseFromAi } from '../../model/aiExercise';
import { Dialog } from '../../ui/Dialog';
import { IconCopy, IconShare } from '../../ui/Icons';
import './AiExercise.css';

/**
 * «Crear con IA» (BETA, fase 1). La app no habla con ninguna IA: prepara las instrucciones, el usuario
 * las lleva a la IA que quiera y pega aquí la respuesta. Va en el menú ⋯ de Ejercicios, sin
 * protagonismo, hasta ver si se usa.
 */
export function AiExerciseDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (r: AiResult) => void }) {
  const [description, setDescription] = useState('');
  const [answer, setAnswer] = useState('');
  const [copied, setCopied] = useState<'' | 'ok' | 'error'>('');
  const prompt = buildPrompt(description);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  // se lee la respuesta según se pega: así se ve enseguida si está bien
  const result = useMemo((): { ok: AiResult } | { error: string } | null => {
    if (!answer.trim()) return null;
    try {
      return { ok: exerciseFromAi(answer) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se ha podido leer la respuesta.' };
    }
  }, [answer]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  };
  // en el móvil, «Enviar a…» abre la lista de apps: Copilot, ChatGPT, Gemini…
  const share = () => navigator.share({ text: prompt }).catch(() => {});

  const close = () => {
    setAnswer('');
    setCopied('');
    onClose();
  };
  const ok = result && 'ok' in result ? result.ok : null;

  return (
    <Dialog open={open} onClose={close} title="Crear con IA">
      <div className="ai-dialog">
        <p className="ai-intro">
          <em className="badge-beta">Beta</em> Describe el ejercicio, llévalo a una IA (Copilot, ChatGPT, Gemini…) y pega aquí su respuesta. La app no envía nada a ninguna IA: lo haces tú.
        </p>

        <section className="ai-step">
          <h3>
            <span className="ai-n">1</span> Describe el ejercicio
          </h3>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setCopied('');
            }}
            placeholder="Ej.: 2c1 desde el ala. El 1 pasa al 2, corta a canasta y recibe para tirar. Un defensor sale a por el balón."
            aria-label="Descripción del ejercicio"
          />
          <p className="muted small">Puedes dictarlo con el micrófono del teclado. También puedes dejarlo vacío y escribirlo después en la IA.</p>
          <div className="ai-actions">
            <button className="btn primary" onClick={copy}>
              <IconCopy /> {copied === 'ok' ? 'Copiado ✓' : 'Copiar instrucciones'}
            </button>
            {canShare && (
              <button className="btn" onClick={share}>
                <IconShare /> Enviar a…
              </button>
            )}
          </div>
          {copied === 'ok' && <p className="muted small">Ahora pégalas en la IA y espera su respuesta.</p>}
          {copied === 'error' && (
            <details className="ai-raw" open>
              <summary>No se ha podido copiar: selecciona el texto y cópialo a mano</summary>
              <textarea readOnly rows={6} value={prompt} onFocus={(e) => e.currentTarget.select()} aria-label="Instrucciones para la IA" />
            </details>
          )}
        </section>

        <section className="ai-step">
          <h3>
            <span className="ai-n">2</span> Pega aquí la respuesta de la IA
          </h3>
          <textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Pega la respuesta completa (el bloque que empieza por «{»)" aria-label="Respuesta de la IA" spellCheck={false} />
          {result && 'error' in result && (
            <p className="notice error" role="alert">
              {result.error}
            </p>
          )}
          {ok && (
            <div className="ai-result" role="status">
              <p>
                <strong>{ok.exercise.title}</strong> · {ok.exercise.play.players.length} jugadores · {ok.exercise.play.frames.length} {ok.exercise.play.frames.length === 1 ? 'fotograma' : 'fotogramas'}
              </p>
              {ok.warnings.length > 0 && (
                <>
                  <p className="muted small">Se crea igual, pero esto no se ha podido dibujar tal cual (lo puedes retocar en el editor):</p>
                  <ul>
                    {ok.warnings.slice(0, 6).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                    {ok.warnings.length > 6 && <li>Y {ok.warnings.length - 6} más.</li>}
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="ai-actions">
            <button className="btn primary big" disabled={!ok} onClick={() => ok && onCreate(ok)}>
              Crear y abrir en el editor
            </button>
          </div>
        </section>
      </div>
    </Dialog>
  );
}
