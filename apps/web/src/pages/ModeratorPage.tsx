import type { EventMode } from '@wedding/shared';
import {
  Camera,
  CheckCircle2,
  Eye,
  Heart,
  Lock,
  LogOut,
  Play,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EditorialDivider,
  MobileShell,
  PillButton,
  SurfaceCard,
  WeddingHeader,
} from '../components/ui/index.js';
import { useSession } from '../context/SessionContext.js';
import { ApiClientError } from '../lib/api.js';

interface ModeOption {
  mode: EventMode;
  title: string;
  description: string;
}

const EVENT_MODE_OPTIONS: readonly ModeOption[] = [
  {
    mode: 'live',
    title: 'En vivo (Fiesta activa)',
    description:
      'Los invitados pueden subir fotos al Muro General, postular looks y votar con ❤️.',
  },
  {
    mode: 'read_only',
    title: 'Solo lectura (Post-festejo)',
    description:
      'Cierra subidas y votos nuevos. Todos pueden seguir viendo y descargando las fotos.',
  },
  {
    mode: 'closed',
    title: 'Álbum cerrado',
    description:
      'Pausa las interacciones públicas cuando finaliza el período del evento.',
  },
];

export function ModeratorPage() {
  const navigate = useNavigate();
  const { session, loading, unlockModerator, exitModerator, updateMode } =
    useSession();

  const [pin, setPin] = useState('');
  const [submittingPin, setSubmittingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [savingMode, setSavingMode] = useState<EventMode | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleUnlock = async () => {
    if (pin.trim().length < 4 || submittingPin) return;
    setSubmittingPin(true);
    setPinError(null);
    setStatusMessage(null);

    try {
      await unlockModerator(pin.trim());
      setPin('');
      setStatusMessage('Controles de moderación habilitados en este celular.');
    } catch (err) {
      setPinError(
        err instanceof ApiClientError
          ? err.message
          : 'No pudimos validar el PIN. Revisá tu conexión.',
      );
    } finally {
      setSubmittingPin(false);
    }
  };

  const handleSelectMode = async (nextMode: EventMode) => {
    if (savingMode || session.eventMode === nextMode) return;
    setSavingMode(nextMode);
    setPinError(null);
    setStatusMessage(null);

    try {
      await updateMode(nextMode);
      const label =
        EVENT_MODE_OPTIONS.find((opt) => opt.mode === nextMode)?.title ??
        nextMode;
      setStatusMessage(`Modo actualizado: ${label}.`);
    } catch (err) {
      setPinError(
        err instanceof ApiClientError
          ? err.message
          : 'No pudimos cambiar el modo del evento.',
      );
    } finally {
      setSavingMode(null);
    }
  };

  const handleLogout = async () => {
    await exitModerator();
    setStatusMessage(null);
    setPinError(null);
  };

  return (
    <MobileShell>
      <WeddingHeader
        variant="subroute"
        eyebrow="Organización"
        title="Moderación"
      />

      {loading ? (
        <SurfaceCard className="p-6 text-center font-sans text-[14px] text-muted">
          Verificando estado de sesión...
        </SurfaceCard>
      ) : !session.isModerator ? (
        <SurfaceCard className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-accent">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-[24px] leading-tight font-medium text-ink">
                Desbloqueo con PIN
              </h2>
              <p className="font-sans text-[13px] text-muted">
                Habilita el borrado de cualquier foto y el cambio de Modo del
                Evento.
              </p>
            </div>
          </div>

          <EditorialDivider className="my-5" />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleUnlock();
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-[11px] tracking-[0.18em] text-muted uppercase">
                PIN de moderador
              </span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                disabled={submittingPin}
                placeholder="Ingresá el PIN secreto"
                required
                minLength={4}
                className="w-full rounded-[14px] border border-line bg-white px-4 py-[15px] font-sans text-[16px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
            </label>

            {pinError ? (
              <p className="rounded-[14px] border border-danger/30 bg-canvas px-3.5 py-2.5 font-sans text-[13px] text-danger">
                {pinError}
              </p>
            ) : null}

            <PillButton
              type="submit"
              fullWidth
              disabled={pin.trim().length < 4 || submittingPin}
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              {submittingPin ? 'Verificando...' : 'Activar modo moderador'}
            </PillButton>
          </form>
        </SurfaceCard>
      ) : (
        <div className="flex flex-col gap-4">
          <SurfaceCard className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-success/30 bg-canvas text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-sans text-[11px] tracking-[0.18em] text-success uppercase">
                  Sesión activa
                </p>
                <h2 className="font-serif text-[25px] leading-tight font-medium text-ink">
                  Controles de moderador listos
                </h2>
              </div>
            </div>

            <p className="mt-3 font-sans text-[13px] leading-relaxed text-muted">
              Al abrir cualquier foto en el <strong>Muro General</strong> o en{' '}
              <strong>Best Outfit</strong>, vas a ver habilitado el botón de
              papelera para eliminarla de inmediato si hace falta.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <PillButton
                variant="secondary"
                icon={<Camera className="h-4 w-4" />}
                onClick={() => navigate('/galeria')}
              >
                Ir al Muro
              </PillButton>
              <PillButton
                variant="secondary"
                icon={<Heart className="h-4 w-4" />}
                onClick={() => navigate('/best-outfit')}
              >
                Best Outfit
              </PillButton>
            </div>

            <div className="mt-2.5">
              <PillButton
                fullWidth
                icon={<Play className="h-4 w-4 fill-current" />}
                onClick={() => navigate('/presentacion?seccion=all')}
              >
                Abrir Presentación (TV / Pantalla completa)
              </PillButton>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-accent" />
              <span className="font-sans text-[11px] tracking-[0.2em] text-muted uppercase">
                Modo del evento
              </span>
            </div>

            <h3 className="mt-1.5 font-serif text-[24px] leading-tight font-medium text-ink">
              Estado general de la celebración
            </h3>

            <div className="mt-3.5 flex flex-col gap-2.5">
              {EVENT_MODE_OPTIONS.map((option) => {
                const isSelected = session.eventMode === option.mode;
                const isSavingThis = savingMode === option.mode;

                return (
                  <button
                    key={option.mode}
                    type="button"
                    disabled={savingMode !== null}
                    onClick={() => void handleSelectMode(option.mode)}
                    aria-pressed={isSelected}
                    className={`flex min-h-[56px] w-full cursor-pointer flex-col items-start rounded-[16px] border p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60 ${
                      isSelected
                        ? 'border-ink bg-canvas'
                        : 'border-line bg-white hover:border-accent'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-sans text-[14px] font-semibold text-ink">
                        {option.title}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-sans text-[11px] font-medium ${
                          isSelected
                            ? 'bg-ink text-white'
                            : 'border border-line text-muted'
                        }`}
                      >
                        {isSavingThis ? (
                          'Guardando...'
                        ) : isSelected ? (
                          <>
                            <Eye className="h-3 w-3" /> Activo
                          </>
                        ) : (
                          'Elegir'
                        )}
                      </span>
                    </div>
                    <span className="mt-1 font-sans text-[12px] leading-snug text-muted">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {statusMessage ? (
              <p className="mt-3.5 rounded-[14px] border border-success/30 bg-canvas px-3.5 py-2.5 font-sans text-[13px] text-success">
                {statusMessage}
              </p>
            ) : null}

            {pinError ? (
              <p className="mt-3.5 rounded-[14px] border border-danger/30 bg-canvas px-3.5 py-2.5 font-sans text-[13px] text-danger">
                {pinError}
              </p>
            ) : null}
          </SurfaceCard>

          <PillButton
            variant="secondary"
            fullWidth
            icon={<LogOut className="h-4 w-4" />}
            onClick={() => void handleLogout()}
          >
            Salir del modo moderador
          </PillButton>
        </div>
      )}
    </MobileShell>
  );
}
