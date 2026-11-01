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

    if (total === 0) {
      setProgress(100);
      setPhase('¡Listo para la batalla!');
      finishLoading(startTime);
      return;
    }

    let loadedCount = 0;

    const updateProgress = () => {
      loadedCount += 1;
      const currentProgress = Math.min(Math.round((loadedCount / total) * 100), 100);
      setProgress(currentProgress);

      if (currentProgress < 25) setPhase('Despertando a los guardianes...');
      else if (currentProgress < 50) setPhase('Forjando el mazo de batalla...');
      else if (currentProgress < 80) setPhase('Alineando las estrellas cósmicas...');
      else if (currentProgress < 100) setPhase('Preparando el tablero...');
      else {
        setPhase('¡Listo para la batalla!');
        finishLoading(startTime);
      }
    };

    const preloadAsset = (src) => {
      return new Promise((resolve) => {
        if (typeof src === 'string' && (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.webp') || src.endsWith('.svg'))) {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            updateProgress(); // ✅ Llamar aquí, no al final
            resolve();
          };
          img.onerror = () => {
            console.warn(`[Preload] Fallo al cargar: ${src}`);
            updateProgress(); // ✅ Llamar aquí también
            resolve();
          };
          setTimeout(() => {
            updateProgress(); // ✅ Timeout de seguridad
            resolve();
          }, 3000);
        } else {
          updateProgress(); // ✅ Para assets no-imagen
          resolve();
        }
      });
    };

    // Ejecutar precarga en paralelo
    validAssets.forEach(preloadAsset);

    const finishLoading = (start) => {
      const elapsedTime = Date.now() - start;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);
      
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 300);
      }, remainingTime);
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