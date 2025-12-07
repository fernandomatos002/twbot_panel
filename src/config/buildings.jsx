// src/config/buildings.js
// IMPORTANTE: Complete esta lista com IDs, Nomes, Níveis Máximos e Pré-requisitos corretos!
import { Castle, Users, Building2, Hammer, BookOpen, Flame, ShoppingCart, Trees, Shield } from 'lucide-react';

// Exemplo de como associar ícones Lucide (você precisará completar)
// Pode ser necessário criar SVGs customizados como no seu exemplo para alguns ícones
const CustomClayIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke="currentColor" strokeWidth="2" d="M12 6v12M6 12h12"/></svg>;
const CustomIronIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"/></svg>;
const CustomFarmIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7v10h2v3h2v-3h12v3h2v-3h2V7l-10-5z"/></svg>;
const CustomStorageIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" strokeWidth="2"/><rect x="3" y="18" width="18" height="2" rx="1"/></svg>;
const CustomHideIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4 6v8c0 6 8 8 8 8s8-2 8-8V6l-8-4z" opacity="0.6"/><path d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>;
const CustomWallIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="14" rx="1"/><rect x="4" y="6" width="3" height="3"/><rect x="10" y="6" width="3" height="3"/><rect x="16" y="6" width="3" height="3"/><rect x="4" y="12" width="3" height="3"/><rect x="10" y="12" width="3" height="3"/><rect x="16" y="12" width="3" height="3"/><rect x="2" y="18" width="20" height="2"/></svg>;


export const BUILDINGS = [
  { id: 'main', name: 'Edifício Principal', icon: Castle, maxLevel: 30, prerequisites: [] },
  { id: 'barracks', name: 'Quartel', icon: Users, maxLevel: 25, prerequisites: [{ building: 'main', level: 3 }] },
  { id: 'stable', name: 'Estábulo', icon: Building2, maxLevel: 20, prerequisites: [{ building: 'main', level: 10 }, { building: 'barracks', level: 5 }, { building: 'smith', level: 5 }] },
  { id: 'workshop', name: 'Oficina', icon: Hammer, maxLevel: 15, prerequisites: [{ building: 'main', level: 10 }, { building: 'smith', level: 10 }] },
  { id: 'academy', name: 'Academia', icon: BookOpen, maxLevel: 1, prerequisites: [{ building: 'main', level: 20 }, { building: 'smith', level: 20 }, { building: 'market', level: 10 }] },
  { id: 'smith', name: 'Ferreiro', icon: Flame, maxLevel: 20, prerequisites: [{ building: 'main', level: 5 }, { building: 'barracks', level: 1 }] },
  { id: 'market', name: 'Mercado', icon: ShoppingCart, maxLevel: 25, prerequisites: [{ building: 'main', level: 3 }, { building: 'storage', level: 2 }] },
  { id: 'timber', name: 'Bosque', icon: Trees, maxLevel: 30, prerequisites: [] },
  { id: 'clay', name: 'Poço de Argila', icon: CustomClayIcon, maxLevel: 30, prerequisites: [] },
  { id: 'iron', name: 'Mina de Ferro', icon: CustomIronIcon, maxLevel: 30, prerequisites: [] },
  { id: 'farm', name: 'Fazenda', icon: CustomFarmIcon, maxLevel: 30, prerequisites: [] },
  { id: 'storage', name: 'Armazém', icon: CustomStorageIcon, maxLevel: 30, prerequisites: [] },
  { id: 'hide', name: 'Esconderijo', icon: CustomHideIcon, maxLevel: 10, prerequisites: [] },
  { id: 'wall', name: 'Muralha', icon: CustomWallIcon, maxLevel: 20, prerequisites: [{ building: 'barracks', level: 1 }] },
  // Adicione TODOS os outros edifícios aqui...
];

// Mapeamento ID -> Objeto Edifício Completo
export const BUILDINGS_MAP = BUILDINGS.reduce((acc, b) => { // <-- Adicionado 'export'
  acc[b.id] = b;
  return acc;
}, {});

// Mapeamento ID -> Nome (mantido para conveniência)
export const BUILDING_NAMES = BUILDINGS.reduce((acc, b) => {
  acc[b.id] = b.name;
  return acc;
}, {});