// Authored storefront looks: the real business, its sign as it reads on the street,
// its colours, drawn by the game where no photo exists yet (towns/nbpt/facades/README).
// `at` is the shop's door in world px for a business the map does not name.
// Sources where a search gave one; the rest is from memory of the street and is
// marked so — swap for a photo the day one exists.
import type { Look } from '../../three/looks';

export const LOOKS: Look[] = [
  // 17 State St: the last structural-glass storefront downtown, black Carrara glass with
  // ivory enamel panels lettered FOWLE'S and the town's last neon sign. Brine moved in
  // (2022); the sign and facade stayed. (newburyportnews.com, gloucestertimes.com)
  { name: "Fowle's", sign: "FOWLE'S", sub: 'NEWS STORE', style: 'moderne', wall: '#141416', panel: '#efe6cf', ink: '#111111', neon: '#ff3b2f', glass: '#1c2430', widthM: 9 },
  // 13 Middle St, the Grog: brick, dark green trim, gold script (memory)
  { name: 'The Grog', sign: 'The Grog', style: 'script', wall: '#2f5a3a', panel: '#2f5a3a', ink: '#e8c96a', glass: '#1d2530', awning: '#2f5a3a', widthM: 10 },
  // 40 Merrimac St, brick with gambrel roofs (newburyportnews.com); cream sign, black cow (memory)
  { name: 'The Black Cow', sign: 'THE BLACK COW', style: 'serif', wall: '#8a3b30', panel: '#f1ead8', ink: '#1a1a1a', glass: '#1d2530', widthM: 12 },
  // State St: red-and-white convenience store lettering (memory)
  { name: 'Richdale Convenience Store', sign: 'RICHDALE', style: 'sans', wall: '#b23a2a', panel: '#ffffff', ink: '#c4231b', glass: '#1d2530', awning: '#c4231b', stripes: '#ffffff', widthM: 8 },
  // Pleasant St ice cream: pink and white (memory)
  { name: 'Harbor Creamery', sign: 'Harbor Creamery', style: 'script', wall: '#f4d6de', panel: '#ffffff', ink: '#b8386a', glass: '#1d2530', awning: '#e07a9c', stripes: '#ffffff', widthM: 7 },
  { name: "Oregano's", sign: "OREGANO'S", sub: 'PIZZERIA', style: 'sans', wall: '#2c2c2c', panel: '#1f1f1f', ink: '#e8b53c', glass: '#1d2530', awning: '#b2231d', widthM: 8 },
  { name: 'The Angry Donut', sign: 'THE ANGRY DONUT', style: 'sans', wall: '#f2e7c9', panel: '#1b1b1b', ink: '#f6c24a', glass: '#1d2530', widthM: 7 },
  { name: 'Port Vida Mexican Cantina', sign: 'PORT VIDA', sub: 'MEXICAN CANTINA', style: 'sans', wall: '#e2b455', panel: '#1e3f5a', ink: '#f6e6b0', glass: '#1d2530', awning: '#1e3f5a', widthM: 9 },
  { name: 'Agave Mexican Bistro', sign: 'AGAVE', sub: 'MEXICAN BISTRO', style: 'sans', wall: '#5a7a4a', panel: '#2a2a2a', ink: '#f0e6c8', glass: '#1d2530', widthM: 8 },
  { name: 'Anchor Stone Deck Pizza', sign: 'ANCHOR', sub: 'STONE DECK PIZZA', style: 'sans', wall: '#2a3a4a', panel: '#2a3a4a', ink: '#f4f1e8', glass: '#1d2530', widthM: 8 },
  { name: 'Stone Crust Artisan Pizza', sign: 'STONE CRUST', sub: 'ARTISAN PIZZA', style: 'serif', wall: '#4a4a4a', panel: '#1b1b1b', ink: '#e8c96a', glass: '#1d2530', widthM: 7 },
  { name: 'Magma Cafe Coffee Roasters', sign: 'MAGMA', sub: 'COFFEE ROASTERS', style: 'sans', wall: '#1f1f1f', panel: '#1f1f1f', ink: '#f05a28', glass: '#1d2530', widthM: 6 },
  { name: 'The Book Rack', sign: 'THE BOOK RACK', style: 'serif', wall: '#7a3b2e', panel: '#f1ead8', ink: '#3a2a1c', glass: '#1d2530', awning: '#3f5a3a', widthM: 7 },
  { name: 'Loretta', sign: 'Loretta', style: 'script', wall: '#e9e2d3', panel: '#e9e2d3', ink: '#2a2a2a', glass: '#1d2530', widthM: 8 },
  { name: 'Lexie\'s', sign: "LEXIE'S", sub: 'BURGERS', style: 'sans', wall: '#f1ead8', panel: '#c8262a', ink: '#ffffff', glass: '#1d2530', widthM: 7 },
  { name: 'The Port Tavern', sign: 'THE PORT TAVERN', style: 'serif', wall: '#3a3a3a', panel: '#1b1b1b', ink: '#e8c96a', glass: '#1d2530', widthM: 8 },
  { name: 'The Screening Room', sign: 'THE SCREENING ROOM', style: 'moderne', wall: '#2a2a2a', panel: '#f1ead8', ink: '#1b1b1b', neon: '#ff3b2f', glass: '#1d2530', widthM: 8 },
  { name: 'Simply Sweet', sign: 'Simply Sweet', style: 'script', wall: '#f7e1e8', panel: '#ffffff', ink: '#c04a7a', glass: '#1d2530', awning: '#c04a7a', stripes: '#ffffff', widthM: 6 },
  { name: "Abraham's Bagels", sign: "ABRAHAM'S", sub: 'BAGELS', style: 'sans', wall: '#f1ead8', panel: '#2a3a5a', ink: '#f6e6b0', glass: '#1d2530', widthM: 7 },
  { name: "Restorante Larosa's Italian Newburyport", sign: "LAROSA'S", sub: 'RISTORANTE', style: 'serif', wall: '#8a3b30', panel: '#2a6e3a', ink: '#ffffff', glass: '#1d2530', awning: '#2a6e3a', stripes: '#ffffff', widthM: 8 },
  { name: 'Jabberwocky Bookshop', sign: 'JABBERWOCKY', sub: 'BOOKSHOP', style: 'serif', wall: '#f1ead8', panel: '#2a3a5a', ink: '#f6e6b0', glass: '#1d2530', widthM: 10 },
  { name: 'Chococoa Baking Co.', sign: 'CHOCOCOA', sub: 'BAKING CO.', style: 'sans', wall: '#f1ead8', panel: '#4a2e1e', ink: '#f6e6b0', glass: '#1d2530', widthM: 7 },
  { name: 'Oldies Marketplace', sign: 'OLDIES', sub: 'MARKETPLACE', style: 'serif', wall: '#8a6a4a', panel: '#f1ead8', ink: '#5a2a1a', glass: '#1d2530', widthM: 12 },
  { name: 'Institution for Savings', sign: 'INSTITUTION FOR SAVINGS', style: 'serif', wall: '#9a9a96', panel: '#9a9a96', ink: '#1b1b1b', glass: '#1d2530', floors: 'all', widthM: 14 },
  { name: 'TD Bank', sign: 'TD Bank', style: 'sans', wall: '#f1ead8', panel: '#34b233', ink: '#ffffff', glass: '#1d2530', widthM: 8 },
  { name: "Dunkin'", sign: "DUNKIN'", style: 'sans', wall: '#f1ead8', panel: '#ffffff', ink: '#f36f21', ink2: '#e11383', glass: '#1d2530', widthM: 7 },
  { name: "Michael’s Harborside", sign: "MICHAEL'S", sub: 'HARBORSIDE', style: 'serif', wall: '#8c8f93', panel: '#1e3f5a', ink: '#ffffff', glass: '#1d2530', widthM: 14 },
  { name: 'Plum Island Kayak', sign: 'PLUM ISLAND KAYAK', style: 'sans', wall: '#e9e2d3', panel: '#1e6f8a', ink: '#ffffff', glass: '#1d2530', widthM: 8 },
  { name: 'Mission Oak', sign: 'MISSION OAK', sub: 'GRILL', style: 'serif', wall: '#4a3a2a', panel: '#1b1b1b', ink: '#e8c96a', glass: '#1d2530', widthM: 8 },
  { name: 'Denise\'s Flower Shop', sign: "Denise's", sub: 'FLOWERS', style: 'script', wall: '#e9e2d3', panel: '#2a6e3a', ink: '#ffffff', glass: '#1d2530', awning: '#2a6e3a', widthM: 6 },
  { name: 'Middle Foods Street', sign: 'MIDDLE STREET FOODS', style: 'sans', wall: '#f1ead8', panel: '#2a2a2a', ink: '#f4f1e8', glass: '#1d2530', widthM: 6 },
  { name: 'Poynt', sign: 'POYNT', style: 'sans', wall: '#2a2a2a', panel: '#2a2a2a', ink: '#f4f1e8', glass: '#1d2530', widthM: 8 },
  { name: 'Jackrabbit', sign: 'JACKRABBIT', style: 'sans', wall: '#3a3a3a', panel: '#1b1b1b', ink: '#f4f1e8', glass: '#1d2530', widthM: 7 },
  { name: 'The Newburyport Lighting Co', sign: 'NEWBURYPORT LIGHTING CO.', style: 'serif', wall: '#e9e2d3', panel: '#1b1b1b', ink: '#e8c96a', glass: '#1d2530', widthM: 8 },
];
