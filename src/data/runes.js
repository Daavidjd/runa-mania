// Importamos las imágenes desde la carpeta de assets
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
// NUEVAS RUNAS
import escorpedo from '../assets/runes/escorpedo.png';
import infernalSpider from '../assets/runes/infernalSpider.png';
import lagartoFuego from '../assets/runes/lagartoFuego.png';
import mantatiburon from '../assets/runes/mantatiburon.png';
import orcaVoladora from '../assets/runes/orcaVoladora.png';
import pezInfernal from '../assets/runes/pezInfernal.png';
import rataroke from '../assets/runes/rataroke.png';
import scorpi from '../assets/runes/scorpi.png';
import superrayo from '../assets/runes/superrayo.png';

export const RUNES_DB = [
  // RUNAS ORIGINALES
  { id: 'rune_001', name: 'Tibudrac', image: tibudrac, arrows: { top: 2, right: 1, bottom: 0, left: 1 } },
  { id: 'rune_002', name: 'Rocko', image: rocko, arrows: { top: 1, right: 1, bottom: 1, left: 1 } },
  { id: 'rune_003', name: 'Aligato', image: aligato, arrows: { top: 0, right: 2, bottom: 2, left: 0 } },
  { id: 'rune_004', name: 'Catcrank', image: catcrank, arrows: { top: 2, right: 0, bottom: 0, left: 2 } },
  { id: 'rune_005', name: 'Cucakarcha', image: cucakarcha, arrows: { top: 3, right: 0, bottom: 1, left: 0 } },
  { id: 'rune_006', name: 'Elfo', image: elfo, arrows: { top: 1, right: 1, bottom: 1, left: 1 } },
  { id: 'rune_007', name: 'Golcan', image: golcan, arrows: { top: 1, right: 1, bottom: 0, left: 0 } },
  { id: 'rune_008', name: 'Perry', image: perry, arrows: { top: 0, right: 0, bottom: 1, left: 1 } },
  { id: 'rune_009', name: 'Tigreoso', image: tigreoso, arrows: { top: 2, right: 1, bottom: 0, left: 1 } },
  { id: 'rune_010', name: 'Trompi', image: trompi, arrows: { top: 0, right: 1, bottom: 1, left: 0 } },
  
  // NUEVAS RUNAS (ajusta las flechas según el balance que quieras)
  { id: 'rune_011', name: 'Escorpedo', image: escorpedo, arrows: { top: 1, right: 2, bottom: 1, left: 0 } },
  { id: 'rune_012', name: 'InfernalSpider', image: infernalSpider, arrows: { top: 0, right: 1, bottom: 2, left: 1 } },
  { id: 'rune_013', name: 'LagartoFuego', image: lagartoFuego, arrows: { top: 2, right: 0, bottom: 1, left: 1 } },
  { id: 'rune_014', name: 'Mantatiburon', image: mantatiburon, arrows: { top: 1, right: 1, bottom: 0, left: 2 } },
  { id: 'rune_015', name: 'OrcaVoladora', image: orcaVoladora, arrows: { top: 3, right: 1, bottom: 0, left: 0 } },
  { id: 'rune_016', name: 'PezInfernal', image: pezInfernal, arrows: { top: 0, right: 2, bottom: 2, left: 0 } },
  { id: 'rune_017', name: 'Rataroke', image: rataroke, arrows: { top: 1, right: 0, bottom: 1, left: 2 } },
  { id: 'rune_018', name: 'Scorpi', image: scorpi, arrows: { top: 2, right: 1, bottom: 0, left: 1 } },
  { id: 'rune_019', name: 'Superrayo', image: superrayo, arrows: { top: 1, right: 2, bottom: 1, left: 0 } }
];

// 3 niveles de rareza
export const ROCK_TYPES = {
  normal: {
    id: 'normal',
    name: 'Roca Normal',
    rarity: 'Normal',
    price: 50,
    description: 'Una roca básica. Contiene runas al azar.',
    color: '#90a4ae',
    icon: '🪨',
    weightMultiplier: 1
  },
  rare: {
    id: 'rare',
    name: 'Roca Rara',
    rarity: 'Rara',
    price: 150,
    description: 'Mayor probabilidad de obtener runas poderosas.',
    color: '#2196f3',
    icon: '💎',
    weightMultiplier: 2
  },
  epic: {
    id: 'epic',
    name: 'Roca Épica',
    rarity: 'Épica',
    price: 300,
    description: 'Las runas más raras aparecen con alta frecuencia.',
    color: '#9c27b0',
    icon: '',
    weightMultiplier: 4
  }
};

export const getRandomRune = (rockType = 'normal') => {
  const rock = ROCK_TYPES[rockType] || ROCK_TYPES.normal;
  
  const weighted = RUNES_DB.flatMap(rune => {
    const totalArrows = rune.arrows.top + rune.arrows.right + rune.arrows.bottom + rune.arrows.left;
    const baseWeight = Math.max(1, 5 - totalArrows);
    const rarityBonus = totalArrows * rock.weightMultiplier;
    const weight = baseWeight + rarityBonus;
    return Array(weight).fill(rune);
  });
  
  return weighted[Math.floor(Math.random() * weighted.length)];
};