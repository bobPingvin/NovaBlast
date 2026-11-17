import { HotkeyConfig } from './types';

export const DEFAULT_GRID_SIZE = 16;

export const PALETTE_PRESETS = [
  '#000000', '#1D2B53', '#7E2553', '#008751',
  '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436',
  '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
  '#2D1B33', '#1A1C2C', '#5D275D', '#B13E53',
  '#EF7D57', '#FFCD75', '#A7F070', '#38B764',
  '#257179', '#29366F', '#3B5DC9', '#41A6F6',
  '#73EFF7', '#F4F4F4', '#94B0C2', '#566C86'
];

export const INITIAL_COLOR = '#000000';

export const DEFAULT_HOTKEYS: HotkeyConfig = {
  undo: { key: 'z', ctrl: true, label: 'Отменить' },
  redo: { key: 'z', ctrl: true, shift: true, label: 'Повторить' },
  pen: { key: 'b', label: 'Карандаш' },
  eraser: { key: 'e', label: 'Ластик' },
  fill: { key: 'f', label: 'Заливка' },
  picker: { key: 'p', label: 'Пипетка' },
  gradient: { key: 'g', label: 'Градиент' },
  line: { key: 'l', label: 'Линия' },
  ruler: { key: 'm', label: 'Линейка' },
  mirror: { key: 'x', label: 'Зеркало (Симметрия)' },
  toggleGrid: { key: 'h', label: 'Скрыть сетку' },
  brushResize: { key: 's', label: 'Размер кисти' },
  playAnimation: { key: ' ', label: 'Пуск / Пауза анимации' },
};
