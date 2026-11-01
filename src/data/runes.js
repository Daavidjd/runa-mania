// Importamos las imágenes de las runas originales y nuevas
import tibudrac from '../assets/runes/tibudrac.png';
import rocko from '../assets/runes/rocko.png';
import aligato from '../assets/runes/aligato.png';
import catcrank from '../assets/runes/catcrank.png';
import cucakarcha from '../assets/runes/cucakarcha.png';
import elfo from '../assets/runes/elfo.png';
import golcan from '../assets/runes/golcan.png';
import perry from '../assets/runes/perry.png';
import tigreoso from '../assets/runes/tigreoso.png';
import trompi from '../assets/runes/trompi.png';
import escorpedo from '../assets/runes/escorpedo.png';
import infernalSpider from '../assets/runes/infernalSpider.png';
import lagartoFuego from '../assets/runes/lagartoFuego.png';
import mantatiburon from '../assets/runes/mantatiburon.png';
import orcaVoladora from '../assets/runes/orcaVoladora.png';
import pezInfernal from '../assets/runes/pezInfernal.png';
import rataroke from '../assets/runes/rataroke.png';
import scorpi from '../assets/runes/scorpi.png';
import superrayo from '../assets/runes/superrayo.png';
// NUEVAS RUNAS
import extrarmi from '../assets/runes/extrarmi.png';
import gallilien from '../assets/runes/gallilien.png';
import gatuela from '../assets/runes/gatuela.png';
import hiereleon from '../assets/runes/hiereleon.png';
import piriposa from '../assets/runes/piriposa.png';
import scorpano from '../assets/runes/scorpano.png';
import sikifis from '../assets/runes/sikifis.png';
import skarpi from '../assets/runes/skarpi.png';
import treerex from '../assets/runes/treerex.png';

export const RUNES_DB = [
  // ==========================================
  // COMUNES (2 a 4 flechas en total)
  // ==========================================
  { id: 'rune_001', name: 'Tibudrac', image: tibudrac, tier: 'comun', arrows: { top: 1, right: 1, bottom: 2, left: 0 } }, // Total: 4
  { id: 'rune_002', name: 'Rocko', image: rocko, tier: 'comun', arrows: { top: 1, right: 1, bottom: 1, left: 1 } }, // Total: 4
  { id: 'rune_003', name: 'Aligato', image: aligato, tier: 'comun', arrows: { top: 0, right: 2, bottom: 1, left: 0 } }, // Total: 4
  { id: 'rune_004', name: 'Catcrank', image: catcrank, tier: 'comun', arrows: { top: 0, right: 0, bottom: 0, left: 2 } }, // Total: 4
  { id: 'rune_005', name: 'Cucakarcha', image: cucakarcha, tier: 'comun', arrows: { top: 2, right: 0, bottom: 1, left: 0 } }, // Total: 3
  { id: 'rune_006', name: 'Elfo', image: elfo, tier: 'comun', arrows: { top: 1, right: 1, bottom: 1, left: 0 } }, // Total: 3
  { id: 'rune_007', name: 'Golcan', image: golcan, tier: 'comun', arrows: { top: 1, right: 1, bottom: 0, left: 0 } }, // Total: 2
  { id: 'rune_008', name: 'Perry', image: perry, tier: 'comun', arrows: { top: 0, right: 0, bottom: 1, left: 1 } }, // Total: 2
  { id: 'rune_009', name: 'Trompi', image: trompi, tier: 'comun', arrows: { top: 0, right: 1, bottom: 1, left: 0 } }, // Total: 2
  { id: 'rune_020', name: 'Extrarmi', image: extrarmi, tier: 'comun', arrows: { top: 1, right: 0, bottom: 0, left: 1 } }, // Total: 2

  // ==========================================
  // RARAS (5 a 7 flechas en total)
  // ==========================================
  { id: 'rune_010', name: 'Tigreoso', image: tigreoso, tier: 'rara', arrows: { top: 2, right: 2, bottom: 1, left: 1 } }, // Total: 6
  { id: 'rune_011', name: 'Escorpedo', image: escorpedo, tier: 'rara', arrows: { top: 1, right: 2, bottom: 2, left: 1 } }, // Total: 6
  { id: 'rune_012', name: 'InfernalSpider', image: infernalSpider, tier: 'rara', arrows: { top: 0, right: 1, bottom: 2, left: 1 } }, // Total: 6
  { id: 'rune_013', name: 'LagartoFuego', image: lagartoFuego, tier: 'rara', arrows: { top: 2, right: 2, bottom: 1, left: 0 } }, // Total: 5
  { id: 'rune_014', name: 'Mantatiburon', image: mantatiburon, tier: 'rara', arrows: { top: 1, right: 2, bottom: 1, left: 2 } }, // Total: 6
  { id: 'rune_017', name: 'Rataroke', image: rataroke, tier: 'rara', arrows: { top: 1, right: 3, bottom: 0, left: 2 } }, // Total: 6
  { id: 'rune_018', name: 'Scorpi', image: scorpi, tier: 'rara', arrows: { top: 2, right: 2, bottom: 1, left: 1 } }, // Total: 6
  { id: 'rune_021', name: 'Gallilien', image: gallilien, tier: 'rara', arrows: { top: 2, right: 1, bottom: 2, left: 1 } }, // Total: 6
  { id: 'rune_022', name: 'Gatuela', image: gatuela, tier: 'rara', arrows: { top: 3, right: 2, bottom: 0, left: 1 } }, // Total: 6
  { id: 'rune_023', name: 'Piriposa', image: piriposa, tier: 'rara', arrows: { top: 1, right: 1, bottom: 2, left: 2 } }, // Total: 6

  // ==========================================
  // ÉPICAS (8 a 12 flechas en total)
  // ==========================================
  { id: 'rune_015', name: 'OrcaVoladora', image: orcaVoladora, tier: 'epica', arrows: { top: 3, right: 3, bottom: 2, left: 2 } }, // Total: 10
  { id: 'rune_016', name: 'PezInfernal', image: pezInfernal, tier: 'epica', arrows: { top: 3, right: 3, bottom: 0, left: 3 } }, // Total: 9
  { id: 'rune_019', name: 'Superrayo', image: superrayo, tier: 'epica', arrows: { top: 2, right: 3, bottom: 2, left: 3 } }, // Total: 10
  { id: 'rune_024', name: 'Hiereleon', image: hiereleon, tier: 'epica', arrows: { top: 3, right: 2, bottom: 3, left: 2 } }, // Total: 10
  { id: 'rune_025', name: 'Scorpano', image: scorpano, tier: 'epica', arrows: { top: 4, right: 3, bottom: 1, left: 2 } }, // Total: 10
  { id: 'rune_026', name: 'Sikifis', image: sikifis, tier: 'epica', arrows: { top: 2, right: 4, bottom: 2, left: 2 } }, // Total: 10
  { id: 'rune_027', name: 'Skarpi', image: skarpi, tier: 'epica', arrows: { top: 3, right: 3, bottom: 3, left: 1 } }, // Total: 10
  { id: 'rune_028', name: 'Tree-rex', image: treerex, tier: 'epica', arrows: { top: 4, right: 2, bottom: 4, left: 2 } }  // Total: 12 (La más poderosa)
];

// 3 niveles de rocas con sus multiplicadores de probabilidad
export const ROCK_TYPES = {
  normal: {
    id: 'normal',
    name: 'Roca Normal',
    rarity: 'Normal',
    price: 50,
    description: 'Una roca básica. Contiene runas al azar.',
    color: '#90a4ae',
    icon: '🪨',
    // Multiplicadores de peso por rareza
    weights: { comun: 1.0, rara: 0.4, epica: 0.1 }
  },
  rare: {
    id: 'rare',
    name: 'Roca Rara',
    rarity: 'Rara',
    price: 150,
    description: 'Mayor probabilidad de obtener runas poderosas.',
    color: '#2196f3',
    icon: '💎',
    weights: { comun: 1.0, rara: 2.5, epica: 0.8 }
  },
  epic: {
    id: 'epic',
    name: 'Roca Épica',
    rarity: 'Épica',
    price: 300,
    description: 'Las runas más raras aparecen con alta frecuencia.',
    color: '#9c27b0',
    icon: '',
    weights: { comun: 1.0, rara: 3.0, epica: 4.0 }
  }
};

// ✅ SISTEMA DE DROP RATE EQUILIBRADO
export const getRandomRune = (rockType = 'normal') => {
  const rock = ROCK_TYPES[rockType] || ROCK_TYPES.normal;
  
  // 1. Filtramos las runas por su tier
  const comunRunes = RUNES_DB.filter(r => r.tier === 'comun');
  const raraRunes = RUNES_DB.filter(r => r.tier === 'rara');
  const epicaRunes = RUNES_DB.filter(r => r.tier === 'epica');

  // 2. Calculamos el peso total basado en los multiplicadores de la roca
  const pesoComun = comunRunes.length * rock.weights.comun;
  const pesoRara = raraRunes.length * rock.weights.rara;
  const pesoEpica = epicaRunes.length * rock.weights.epica;
  const pesoTotal = pesoComun + pesoRara + pesoEpica;

  // 3. Elegimos un número aleatorio para decidir la rareza
  const roll = Math.random() * pesoTotal;
  let selectedTier = 'comun';
  
  if (roll < pesoComun) {
    selectedTier = 'comun';
  } else if (roll < pesoComun + pesoRara) {
    selectedTier = 'rara';
  } else {
    selectedTier = 'epica';
  }

  // 4. Seleccionamos una runa aleatoria dentro del tier elegido
  const pool = selectedTier === 'comun' ? comunRunes 
               : selectedTier === 'rara' ? raraRunes 
               : epicaRunes;
               
  return pool[Math.floor(Math.random() * pool.length)];
};