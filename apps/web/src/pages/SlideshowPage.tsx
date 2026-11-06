import {
  type PhotoFilterSection,
  type PhotoItemDto,
  WEDDING_CONFIG,
} from '@wedding/shared';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatRelativeTime } from '../components/PhotoLightbox.js';
import { fetchPhotos } from '../lib/api.js';

type SlideshowFilter = Extract<
  PhotoFilterSection,
  'all' | 'general' | 'best_outfit'
>;

const FILTER_OPTIONS: readonly { value: SlideshowFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'general', label: 'Álbum General' },
  { value: 'best_outfit', label: 'Best Outfit' },
];

function parseFilterParam(raw: string | null): SlideshowFilter {
  if (raw === 'general' || raw === 'best_outfit' || raw === 'all') {
    return raw;
  }
  return 'all';
}

export function SlideshowPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeFilter = parseFilterParam(searchParams.get('seccion'));

  const [photos, setPhotos] = useState<PhotoItemDto[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const currentPhotoIdRef = useRef<string | null>(null);

  const currentPhoto = photos[currentIndex] ?? null;
  currentPhotoIdRef.current = currentPhoto?.id ?? null;

  const revealControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying && photos.length > 0) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3600);
    }
  }, [isPlaying, photos.length]);

  useEffect(() => {
    revealControlsTemporarily();
    return () => {
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [revealControlsTemporarily]);

  // Carga inicial y cambio de filtro (Todas / Álbum General / Best Outfit)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPhotos(activeFilter, 'recent')
      .then((res) => {
        if (cancelled) return;
        setPhotos(res.photos);
        setCurrentIndex(0);
      })
      .catch(() => {
        if (!cancelled) {
          setPhotos([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeFilter]);

  // Polling vivo cada 20s: suma fotos nuevas automáticamente sin cortar la reproducción
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchPhotos(activeFilter, 'recent')
        .then((res) => {
          setPhotos((prev) => {
            if (res.photos.length === 0) return [];
            const focusedId = currentPhotoIdRef.current;
            if (focusedId) {
              const nextIdx = res.photos.findIndex((p) => p.id === focusedId);
              if (nextIdx >= 0) {
                setCurrentIndex(nextIdx);
              } else if (prev.length > 0) {
                setCurrentIndex((idx) => Math.min(idx, res.photos.length - 1));
              }
            }
            return res.photos;
          });
        })
        .catch(() => {});
    }, WEDDING_CONFIG.polling.intervalMs);

    return () => window.clearInterval(timer);
  }, [activeFilter]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (photos.length > 0 ? (prev + 1) % photos.length : 0));
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) =>
      photos.length > 0 ? (prev - 1 + photos.length) % photos.length : 0,
    );
  }, [photos.length]);

  // Avance automático cada 6 segundos
  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;
    const timer = window.setInterval(() => {
      goNext();
    }, WEDDING_CONFIG.slideshow.intervalMs);
    return () => window.clearInterval(timer);
  }, [goNext, isPlaying, photos.length, currentIndex]);

  // Precarga de la foto siguiente para transición suave sin parpadeo
  useEffect(() => {
    if (photos.length <= 1) return;
    const nextPhoto = photos[(currentIndex + 1) % photos.length];
    if (!nextPhoto) return;
    const preload = new Image();
    preload.src = nextPhoto.fullUrl;
  }, [currentIndex, photos]);

  // Mantener pantalla encendida en celulares y notebooks compatibles
  useEffect(() => {
    if (!isPlaying) return;
    let wakeLock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: {
        request: (type: 'screen') => Promise<{ release: () => Promise<void> }>;
      };
    };
    nav.wakeLock
      ?.request('screen')
      .then((sentinel) => {
        wakeLock = sentinel;
      })
      .catch(() => {});

    return () => {
      void wakeLock?.release().catch(() => {});
    };
  }, [isPlaying]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await (containerRef.current ?? document.documentElement).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // iOS Safari en iPhone no soporta requestFullscreen en contenedores; continúa limpio
    }
  }, []);

  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      revealControlsTemporarily();
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === ' ') {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.key === 'Escape' && !document.fullscreenElement) {
        event.preventDefault();
        handleExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, handleExit, revealControlsTemporarily, toggleFullscreen]);

  const handleSelectFilter = (next: SlideshowFilter) => {
    revealControlsTemporarily();
    setSearchParams({ seccion: next }, { replace: true });
  };

  const canUseFullscreen =
    typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControlsTemporarily}
      onClick={revealControlsTemporarily}
      onTouchStart={(e) => {
        revealControlsTemporarily();
        touchStartXRef.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartXRef.current;
        const endX = e.changedTouches[0]?.clientX ?? null;
        touchStartXRef.current = null;
        if (startX !== null && endX !== null) {
          const delta = endX - startX;
          if (Math.abs(delta) > 48) {
            if (delta < 0) goNext();
            else goPrev();
          }
        }
      }}
      className="fixed inset-0 z-50 flex h-dvh w-dvw flex-col overflow-hidden bg-[#181512] text-white select-none"
    >
      {/* Fondo difuminado suave de la misma foto para rellenar pantallas 16:9 o 9:16 sin recortar la foto real */}
      {currentPhoto ? (
        <>
          <img
            src={currentPhoto.fullUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-115 object-cover opacity-55 blur-2xl brightness-75 saturate-115 transition-all duration-700"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/60"
          />
        </>
      ) : null}

      {/* Barra superior auto-ocultable */}
      <header
        onClick={(e) => e.stopPropagation()}
        className={`relative z-20 flex flex-wrap items-center justify-between gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 transition-opacity duration-300 sm:px-6 sm:pt-4 ${
          controlsVisible || photos.length === 0
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExit}
            aria-label="Salir de la presentación"
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-black/45 px-3.5 font-sans text-[13px] font-medium text-white backdrop-blur-md transition hover:bg-black/65"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </button>

          <span className="hidden font-serif text-[20px] tracking-wide text-white/90 md:inline">
            {WEDDING_CONFIG.couple.partnerOne}{' '}
            <em className="italic">&amp;</em>{' '}
            {WEDDING_CONFIG.couple.partnerTwo}
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Fotos de la presentación"
          className="flex items-center gap-1 rounded-full border border-white/20 bg-black/45 p-1 backdrop-blur-md"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = activeFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectFilter(opt.value)}
                className={`min-h-[36px] cursor-pointer rounded-full px-3 font-sans text-[12px] font-medium transition sm:px-3.5 ${
                  active
                    ? 'bg-[#fbf8f3] text-[#2f2b27]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {photos.length > 0 ? (
            <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 font-sans text-[12px] text-white/85 backdrop-blur-md">
              {currentIndex + 1} / {photos.length}
            </span>
          ) : null}

          {canUseFullscreen ? (
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label={
                isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'
              }
              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 bg-black/45 px-3 font-sans text-[13px] font-medium text-white backdrop-blur-md transition hover:bg-black/65"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
              <span className="hidden lg:inline">
                {isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
              </span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Foto central 100% entera sin recortar (vertical u horizontal con object-contain) */}
      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-2 py-1 sm:px-6 sm:py-2">
        {loading ? (
          <p className="font-serif text-[24px] text-white/80 italic">
            Preparando presentación...
          </p>
        ) : !currentPhoto ? (
          <div className="mx-auto max-w-md rounded-[22px] border border-white/15 bg-black/45 p-7 text-center backdrop-blur-md">
            <Sparkles className="mx-auto h-7 w-7 text-[#d9cfc2]" />
            <h1 className="mt-3 font-serif text-[28px] font-medium text-white">
              Esperando las primeras fotos
            </h1>
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-white/75">
              Apenas se suban fotos en esta sección, van a aparecer acá en pantalla
              completa automáticamente.
            </p>
          </div>
        ) : (
          <img
            key={currentPhoto.id}
            src={currentPhoto.fullUrl}
            alt={
              currentPhoto.caption ?? `Foto compartida por ${currentPhoto.authorAlias}`
            }
            className="max-h-full max-w-full rounded-[6px] object-contain shadow-[0_22px_60px_rgba(0,0,0,0.65)] transition-opacity duration-500"
          />
        )}
      </main>

      {/* Pie inferior con autoría y controles de pausa / avance */}
      {currentPhoto ? (
        <footer
          onClick={(e) => e.stopPropagation()}
          className="relative z-20 flex flex-col gap-2.5 px-4 pt-1 pb-[max(14px,env(safe-area-inset-bottom))] sm:px-7 sm:pb-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-xl rounded-[16px] border border-white/15 bg-black/45 px-4 py-2.5 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-[14px] font-semibold text-white">
                  {currentPhoto.authorAlias}
                </span>
                <span className="text-white/40">·</span>
                <span className="font-sans text-[11px] tracking-[0.14em] text-white/75 uppercase">
                  {currentPhoto.section === 'best_outfit'
                    ? 'Best Outfit'
                    : 'Álbum General'}
                </span>
                <span className="font-sans text-[11px] text-white/60">
                  {formatRelativeTime(currentPhoto.createdAt)}
                </span>
                {currentPhoto.section === 'best_outfit' &&
                currentPhoto.voteCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#b5525c]/90 px-2 py-0.5 font-sans text-[11px] font-medium text-white">
                    <Heart className="h-3 w-3 fill-current" />
                    {currentPhoto.voteCount}
                  </span>
                ) : null}
              </div>

              {currentPhoto.caption ? (
                <p className="mt-1 font-serif text-[19px] leading-snug text-white/95 italic">
                  “{currentPhoto.caption}”
                </p>
              ) : null}
            </div>

            {photos.length > 1 ? (
              <div
                className={`flex items-center gap-2 transition-opacity duration-300 ${
                  controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Foto anterior"
                  className="inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPlaying((prev) => !prev)}
                  aria-label={
                    isPlaying ? 'Pausar presentación' : 'Reanudar presentación'
                  }
                  className="inline-flex min-h-[46px] cursor-pointer items-center gap-2 rounded-full border border-white/25 bg-[#fbf8f3] px-4 font-sans text-[13px] font-semibold text-[#2f2b27] shadow-lg transition active:scale-95"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 fill-current" />
                      <span>Reproducir</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Siguiente foto"
                  className="inline-flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 active:scale-95"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
