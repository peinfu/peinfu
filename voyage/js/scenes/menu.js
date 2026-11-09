// 游戏菜单
import { sound } from '../assets.js';
import { HELP_TEXT } from './help.js';

export function openMenu(game) {
  const s = game.state;
  const d = game.dialog({
    title: '菜单',
    w: 540,
    bodyH: 4 * 96,
    buttons: [{ label: '关闭', style: 'light' }],
    draw: (ui, x, y, w) => {
      const items = [
        ['保存游戏', () => {
          game.save();
          game.closeDialog(d);
          game.toast('游戏已保存', 'green');
        }],
        [`声音：${s.settings.sound !== false ? '开' : '关'}`, () => {
          s.settings.sound = s.settings.sound === false;
          sound.setEnabled(s.settings.sound);
        }],
        ['航海指南', () => {
          game.closeDialog(d);
          game.dialog({ title: '航海指南', text: HELP_TEXT, w: 760 });
        }],
        ['保存并返回标题', () => {
          game.save();
          game.closeDialog(d);
          game.go('title');
        }],
      ];
      items.forEach(([lb, fn], i) => ui.button(x + 20, y + i * 96, w - 40, 80, lb, fn, { size: 30, style: i === 3 ? 'light' : undefined }));
    },
  });
}
