// src/config/troops.jsx
import React from 'react'; // (Não se esqueça desta linha, que corrigimos)

// 1. REMOVA a importação do ícone placeholder
// import { ShieldCheckIcon } from 'lucide-react'; 

// 2. ATUALIZE a função getTroopIcon
const getTroopIcon = (iconName) => {
    // Isso vai gerar caminhos como "/icons/lanceiro.png", "/icons/cl.png", etc.
    const iconPath = `/icons/${iconName}.png`; 
    return <img src={iconPath} alt={iconName} className="w-5 h-5" />;
};


// --- Definições das Tropas ---

export const TROOPS_CONFIG = {
    barracks: {
        name: "Quartel",
        // 3. ATUALIZE os caminhos dos edifícios (assumindo que estão em /public/icons/)
        icon: () => <img src="/icons/quartel.webp" alt="Quartel" className="w-6 h-6" />,
        units: [
            // 4. ATUALIZE os IDs para baterem com os nomes dos arquivos
            { id: 'spear', name: 'Lanceiro', icon: getTroopIcon('lanceiro') },
            { id: 'sword', name: 'Espadachim', icon: getTroopIcon('espada') },
            { id: 'axe', name: 'Bárbaro', icon: getTroopIcon('barbaro') },
            { id: 'archer', name: 'Arqueiro', icon: getTroopIcon('arqueiro') },
        ]
    },
    stable: {
        name: "Estábulo",
        icon: () => <img src="/icons/estabulo.webp" alt="Estábulo" className="w-6 h-6" />,
        units: [
            { id: 'spy', name: 'Explorador', icon: getTroopIcon('spy') },
            { id: 'light', name: 'Cavalaria Leve', icon: getTroopIcon('cl') }, // Baseado em cl.png
            { id: 'marcher', name: 'Arqueiro a Cavalo', icon: getTroopIcon('clar') }, // Baseado em clar.png
            { id: 'heavy', name: 'Cavalaria Pesada', icon: getTroopIcon('cp') }, // Baseado em cp.png
        ]
    },
    garage: {
        name: "Oficina",
        icon: () => <img src="/icons/oficina.webp" alt="Oficina" className="w-6 h-6" />,
        units: [
            { id: 'ram', name: 'Aríete', icon: getTroopIcon('ram') },
            { id: 'catapult', name: 'Catapulta', icon: getTroopIcon('catapulta') },
        ]
    },

};

// (O resto do arquivo continua igual)
// Mapa para acesso rápido (ex: TROOPS_MAP['spear'])
export const TROOPS_MAP = Object.values(TROOPS_CONFIG).flatMap(group => group.units).reduce((acc, unit) => {
    acc[unit.id] = unit;
    return acc;
}, {});

// Nomes para acesso rápido (ex: TROOP_NAMES['spear'])
export const TROOP_NAMES = Object.values(TROOPS_MAP).reduce((acc, unit) => {
    acc[unit.id] = unit.name;
    return acc;
}, {});