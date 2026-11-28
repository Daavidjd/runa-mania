import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRandomRune } from '../data/runes';
import { addRuneToCollection, getUserCollection } from '../services/firestore';
import RuneCard from './RuneCard';

// Importar las 12 imágenes de rocas
import Roca1 from '../assets/rocks/Roca1.png';
import Roca2 from '../assets/rocks/Roca2.png';
import Roca3 from '../assets/rocks/Roca3.png';
import RocaAzul1 from '../assets/rocks/RocaAzul1.png';
import RocaAzul2 from '../assets/rocks/RocaAzul2.png';
import RocaAzul3 from '../assets/rocks/RocaAzul3.png';
import RocaLila1 from '../assets/rocks/RocaLila1.png';
import RocaLila2 from '../assets/rocks/RocaLila2.png';
import RocaLila3 from '../assets/rocks/RocaLila3.png';
import RocaBlanca1 from '../assets/rocks/RocaBlanca1.png';
import RocaBlanca2 from '../assets/rocks/RocaBlanca2.png';
import RocaBlanca3 from '../assets/rocks/RocaBlanca3.png';

import './RockMiner.css';

// ✅ Mapeo actualizado: 'daily' usa las marrones
const ROCK_IMAGES = {
  daily: [Roca1, Roca2, Roca3], 
  normal: [RocaBlanca1, RocaBlanca2, RocaBlanca3],
  rare: [RocaAzul1, RocaAzul2, RocaAzul3],
  epic: [RocaLila1, RocaLila2, RocaLila3]
};

const getCurrentRuneDisplay = async (userId, rune) => {
  if (!userId) return { ...rune, arrows: { ...(rune.startingArrows || rune.arrows) }, level: 1, repes: 0 };
  const collection = await getUserCollection(userId);
  const ownedRune = collection.find(item => item.id === rune.id);
  if (!ownedRune) return { ...rune, arrows: { ...(rune.startingArrows || rune.arrows) }, level: 1, repes: 0 };
  const level = Math.max(1, Number(ownedRune.level) || 1);
  const arrows = { top: 0, right: 0, bottom: 0, left: 0 };
  const baseArrows = rune.startingArrows || ownedRune.startingArrows || ownedRune.arrows || rune.arrows || {};
  ['top', 'right', 'bottom', 'left'].forEach(direction => { arrows[direction] = Number(baseArrows[direction]) || 0; });
  const evolutionPath = rune.evolutionPath || ownedRune.evolutionPath || [];
  evolutionPath.slice(0, level - 1).forEach(direction => {
    if (Object.prototype.hasOwnProperty.call(arrows, direction)) arrows[direction] += 1;
  });
  return {
    ...ownedRune,
    ...rune,
    image: rune.image || ownedRune.image,
    arrows,
    level,
    repes: Math.max(0, Number(ownedRune.repes) || 0)
  };
};

const RuneDuplicateProgress = ({ rune }) => {
  if (!rune || !(Number(rune.repes) > 0)) return null;
  const cost = 3 * Math.max(1, Number(rune.level) || 1);
  const repes = Math.max(0, Number(rune.repes) || 0);
  const progress = Math.min(100, (repes / cost) * 100);
  return (
    <div className="miner-duplicate-progress" role="progressbar" aria-label="Progreso para mejorar la runa" aria-valuemin={0} aria-valuemax={cost} aria-valuenow={Math.min(repes, cost)}>
      <div className="miner-duplicate-progress-heading">
        <span>PROGRESO DE MEJORA</span>
        <strong>{repes} / {cost}</strong>
      </div>
      <div className="miner-duplicate-progress-track">
        <div className="miner-duplicate-progress-fill" style={{ width: progress + '%' }} />
      </div>
    </div>
  );
};
const RockMiner = ({ onClose, rockType = 'normal', pickaxeType = null }) => {
  const isPickaxeRun = Boolean(pickaxeType);
  const [pickaxeRocks, setPickaxeRocks] = useState(() => Array.from({length:3}, (_,id) => ({ id, hits:0, rune:null, saving:false, saved:false, saveError:false, awardId:`pick-${Date.now()}-${id}-${Math.random().toString(36).slice(2)}` })));
  const [activePickRock, setActivePickRock] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hits, setHits] = useState(0);
  const [revealedRune, setRevealedRune] = useState(null);
  const [mining, setMining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const isProcessingRef = useRef(false);
  const hitCountRef = useRef(0);
  const awardIdRef = useRef(null);
  const savedRef = useRef(false);

  useEffect(() => {
    Object.values(ROCK_IMAGES).flat().forEach(src => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  useEffect(() => {
    const handleBack = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handleBack);

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('popstate', handleBack);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handlePickaxeHit = async (rockId) => {
    const current=pickaxeRocks.find(rock=>rock.id===rockId);
    if(!current||current.rune||isProcessingRef.current) return;
    isProcessingRef.current=true; setActivePickRock(rockId); setMining(true);
    const nextHits=current.hits+1;
    setPickaxeRocks(prev=>prev.map(rock=>rock.id===rockId?{...rock,hits:nextHits}:rock));
    await new Promise(resolve=>setTimeout(resolve,480)); setMining(false);
    if(nextHits===3){
      const rune=getRandomRune(rockType);
      setPickaxeRocks(prev=>prev.map(rock=>rock.id===rockId?{...rock,rune,saving:Boolean(user)}:rock));
      if(user){ try { await addRuneToCollection(user.uid,rune,current.awardId); const displayRune=await getCurrentRuneDisplay(user.uid,rune); setPickaxeRocks(prev=>prev.map(rock=>rock.id===rockId?{...rock,rune:displayRune,saving:false,saved:true}:rock)); }
        catch(error){ console.error('Error guardando runa del pico:',error); setPickaxeRocks(prev=>prev.map(rock=>rock.id===rockId?{...rock,saving:false,saveError:true}:rock)); }
      }
    }
    isProcessingRef.current=false;
  };

  const handlePickaxeRetry = async (rockId) => {
    const rock=pickaxeRocks.find(item=>item.id===rockId);
    if(!user||!rock?.rune||!rock.saveError||isProcessingRef.current) return;
    isProcessingRef.current=true; setPickaxeRocks(prev=>prev.map(item=>item.id===rockId?{...item,saving:true,saveError:false}:item));
    try { await addRuneToCollection(user.uid,rock.rune,rock.awardId); const displayRune=await getCurrentRuneDisplay(user.uid,rock.rune); setPickaxeRocks(prev=>prev.map(item=>item.id===rockId?{...item,rune:displayRune,saving:false,saved:true}:item)); }
    catch(error){ setPickaxeRocks(prev=>prev.map(item=>item.id===rockId?{...item,saving:false,saveError:true}:item)); }
    finally { isProcessingRef.current=false; }
  };

  const handleHit = async () => {
    // Ignora cualquier toque adicional mientras la fase actual está activa.
    // No se encolan golpes: cada animación debe terminar antes del siguiente.
    if (revealedRune || isProcessingRef.current || hitCountRef.current >= 3) return;

    isProcessingRef.current = true;
    try {
      const newHits = hitCountRef.current + 1;
      hitCountRef.current = newHits;
      setHits(newHits);
      setMining(true);

      // La animación de golpe dura 300 ms; dejamos una pequeña pausa extra
      // para que cada estado de la roca se vea antes de aceptar otro toque.
      await new Promise(resolve => setTimeout(resolve, 480));
      setMining(false);

      if (newHits === 3) {
        const rune = getRandomRune(rockType);
        setRevealedRune(rune);
        awardIdRef.current = awardIdRef.current || `mine-${user?.uid || 'guest'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (user) {
          setSaving(true);
          setSaveError(false);
          try {
            await addRuneToCollection(user.uid, rune, awardIdRef.current);
            setRevealedRune(await getCurrentRuneDisplay(user.uid, rune));
            savedRef.current = true;
          } catch (err) {
            console.error('Error guardando runa:', err);
            setSaveError(true);
          } finally {
            setSaving(false);
          }
        }
      }
    } finally {
      setMining(false);
      isProcessingRef.current = false;
    }
  };

  const handleRetrySave = async () => {
    if (!user || !revealedRune || savedRef.current || saving || !awardIdRef.current) return;
    isProcessingRef.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await addRuneToCollection(user.uid, revealedRune, awardIdRef.current);
      setRevealedRune(await getCurrentRuneDisplay(user.uid, revealedRune));
      savedRef.current = true;
    } catch (err) {
      console.error('Error reintentando guardar runa:', err);
      setSaveError(true);
    } finally {
      setSaving(false);
      isProcessingRef.current = false;
    }
  };

  if(isPickaxeRun){
    const complete=pickaxeRocks.every(rock=>rock.rune&&(!user||rock.saved));
    return <div className="rock-miner-overlay pickaxe-miner-overlay"><div className="pickaxe-miner-content">
      <h1 className="miner-huge-title">{complete ? "RUNAS OBTENIDAS" : "PICA"}</h1>
      <div className="pickaxe-rocks-grid">{pickaxeRocks.map(rock=>{
        const images=ROCK_IMAGES[rockType]||ROCK_IMAGES.normal;
        return <div key={rock.id} className={'pickaxe-rock-card '+(rock.rune?'completed':'')} onClick={()=>!rock.rune&&handlePickaxeHit(rock.id)}>
          {rock.rune?<><div className="reveal-rune-stack"><div className="reveal-rune-box"><RuneCard rune={rock.rune} owned={true} battleMode={true}/></div><RuneDuplicateProgress rune={rock.rune}/></div>
            {rock.saving&&<span className="pickaxe-hit-label">Guardando...</span>}
            {rock.saveError&&<button className="pickaxe-retry" onClick={event=>{event.stopPropagation();handlePickaxeRetry(rock.id);}}>Reintentar guardado</button>}
          </>:<><img className={'rock-standalone-img '+(mining&&activePickRock===rock.id?'shaking':'')} src={images[Math.min(rock.hits,2)]} alt={'Roca '+(rock.id+1)} draggable="false"/></>}
        </div>;
      })}</div>
      <button className="collect-minimal-btn" onClick={onClose} disabled={!complete}>Continuar</button>
    </div></div>;
  }

  // Si el tipo es 'daily', usa las marrones. Si no, usa las correspondientes.
  const rockImages = ROCK_IMAGES[rockType] || ROCK_IMAGES.normal;
  const rockImage = rockImages[Math.min(hits, 2)];

  return (
    <div className="rock-miner-overlay" onClick={handleHit}>
      {!revealedRune ? (
        <div className="miner-minimal-view">
          <h1 className="miner-huge-title">PICA</h1>

          <div className={`rock-center ${mining ? 'shaking' : ''}`}>
            <img key={rockImage} src={rockImage} alt="Roca" className="rock-standalone-img" draggable="false" />
          </div>
          
          {/* ✅ Eliminados los puntos de progreso (miner-hits-indicator) */}
        </div>
      ) : (
        <div className="reveal-minimal-view" onClick={(e) => e.stopPropagation()}>
          <h2 className="reveal-minimal-title">¡RUNA OBTENIDA!</h2>

          {saveError && (
            <div className="save-error-banner">
              No se pudo confirmar el guardado. Tu runa sigue aquí; vuelve a intentarlo.
            </div>
          )}

          <div className="reveal-rune-stack">
            <div className="reveal-rune-box"><RuneCard rune={revealedRune} owned={true} battleMode={true} /></div>
            <RuneDuplicateProgress rune={revealedRune} />
          </div>

          <button
            className={`collect-minimal-btn ${saveError ? 'btn-warning' : ''}`}
            onClick={saveError ? handleRetrySave : onClose}
            disabled={saving || saveError || (!savedRef.current && !!user)}
          >
            {saving ? '⏳ Guardando...' : saveError ? 'Reintentar guardado' : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RockMiner;