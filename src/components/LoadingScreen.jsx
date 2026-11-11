import React, { useState, useEffect } from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ assets = [], onComplete, minDisplayTime = 1500 }) => {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Conectando con el plano rúnico...');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const validAssets = assets.filter(Boolean);
    const total = validAssets.length;
    const startTime = Date.now();
    const timers = new Set();
    const images = [];
    let loadedCount = 0;
    let finished = false;
    let cancelled = false;

    const schedule = (callback, delay) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!cancelled) callback();
      }, delay);
      timers.add(timer);
      return timer;
    };

    const finishLoading = () => {
      if (finished || cancelled) return;
      finished = true;
      const remainingTime = Math.max(0, minDisplayTime - (Date.now() - startTime));
      schedule(() => {
        setIsVisible(false);
        schedule(() => {
          if (onComplete) onComplete();
        }, 300);
      }, remainingTime);
    };

    const updateProgress = () => {
      if (cancelled || finished) return;
      loadedCount = Math.min(loadedCount + 1, total);
      const currentProgress = total === 0 ? 100 : Math.round((loadedCount / total) * 100);
      setProgress(currentProgress);

      if (currentProgress < 25) setPhase('Despertando a los guardianes...');
      else if (currentProgress < 50) setPhase('Forjando el mazo de batalla...');
      else if (currentProgress < 80) setPhase('Alineando las estrellas cósmicas...');
      else if (currentProgress < 100) setPhase('Preparando el tablero...');
      else {
        setPhase('¡Listo para la batalla!');
        finishLoading();
      }
    };

    if (total === 0) {
      setProgress(100);
      setPhase('¡Listo para la batalla!');
      finishLoading();
    } else {
      const preloadAsset = (src) => {
        if (typeof src !== 'string' || !/\\.(png|jpe?g|webp|svg)(\\?.*)?$/i.test(src)) {
          updateProgress();
          return;
        }

        const img = new Image();
        images.push(img);
        let settled = false;
        let fallbackTimer;

        const settle = () => {
          if (settled || cancelled) return;
          settled = true;
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            timers.delete(fallbackTimer);
          }
          img.onload = null;
          img.onerror = null;
          updateProgress();
        };

        img.onload = settle;
        img.onerror = () => {
          console.warn(`[Preload] Fallo al cargar: ${src}`);
          settle();
        };
        fallbackTimer = schedule(settle, 3000);
        img.src = src;
      };

      validAssets.forEach(preloadAsset);
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      timers.clear();
      images.forEach(img => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [assets, onComplete, minDisplayTime]);

  if (!isVisible) return null;

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="game-badge">TEMPORADA 1</div>
        <h1 className="game-title">RUNA MANIA</h1>

        <div className="loading-status">
          <span className="loading-text">{phase}</span>
          <span className="loading-percent">{progress}%</span>
        </div>

        <div className="loading-bar-container">
          <div
            className="loading-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;