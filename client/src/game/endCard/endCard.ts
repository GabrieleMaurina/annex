import { contrastTextColor, playerColor } from '../../lib/palette';
import type { GameState } from '../../lib/types';
import { CANVAS_FONT_FAMILY } from '../GameMap/helpers';

export interface EndCard {
  text: string;
  color: string;
}

export interface EndCardOverlay {
  card: EndCard;
  startedAt: number;
  logo: HTMLImageElement | null;
}

export const END_CARD_MS = 3000;
const END_CARD_FADE_MS = 500;
export const END_CARD_SHOWN_MS = END_CARD_MS + END_CARD_FADE_MS;

const NEUTRAL_COLOR = '#ffffff';
const MAX_TEXT_SHARE = 0.9;
const BAND_MS = 300;
const TEXT_DELAY_MS = 200;
const TEXT_MS = 500;
const LOGO_DELAY_MS = 450;
const LOGO_MS = 450;
const LABEL_DELAY_MS = 700;
const LABEL_MS = 300;
const PULSE_START_MS = 900;
export const END_CARD_SETTLED_MS = LABEL_DELAY_MS + LABEL_MS;
const GAME_NAME = 'ANNEX';
const OVERSHOOT = 1.70158;

let logoPromise: Promise<HTMLImageElement | null> | null = null;

function loadSvgImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The logo failed to load.'));
    image.src = src;
  });
}

export function loadEndCardLogo(): Promise<HTMLImageElement | null> {
  logoPromise ??= fetch('/favicon.svg')
    .then((response) => response.text())
    .then((svg) =>
      loadSvgImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          svg.replace('width="100%" height="100%"', 'width="256" height="256"'),
        )}`,
      ),
    )
    .catch(() => null);
  return logoPromise;
}

export function endCardFor(game: GameState): EndCard | null {
  if (game.draw)
    return {
      text:
        game.draw.reason === 'aborted'
          ? 'Aborted'
          : game.draw.reason === 'agreed'
            ? 'Draw'
            : 'Stalemate',
      color: NEUTRAL_COLOR,
    };
  const winners = game.players.filter((p) => game.winnerIds.includes(p.id));
  if (winners.length === 0) return null;
  const color = playerColor(winners[0].color);
  return game.gameMode === 'team deathmatch'
    ? { text: `Team ${winners[0].team + 1} wins!`, color }
    : { text: `${winners[0].name} wins!`, color };
}

function progress(elapsed: number, delay: number, length: number): number {
  return Math.min(1, Math.max(0, (elapsed - delay) / length));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeOutBack(t: number): number {
  return Math.max(
    0,
    1 + (OVERSHOOT + 1) * (t - 1) ** 3 + OVERSHOOT * (t - 1) ** 2,
  );
}

export function drawEndCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  card: EndCard,
  elapsed: number,
  logo: HTMLImageElement | null,
) {
  const fade = 1 - progress(elapsed, END_CARD_MS, END_CARD_FADE_MS);
  if (fade <= 0) return;

  let fontSize = Math.round(height * 0.14);
  ctx.save();
  ctx.font = `bold ${fontSize}px ${CANVAS_FONT_FAMILY}`;
  const textWidth = ctx.measureText(card.text).width;
  if (textWidth > width * MAX_TEXT_SHARE) {
    fontSize = Math.floor((fontSize * width * MAX_TEXT_SHARE) / textWidth);
    ctx.font = `bold ${fontSize}px ${CANVAS_FONT_FAMILY}`;
  }

  const logoSize = logo ? height * 0.17 : 0;
  const gap = height * 0.025;
  const labelSize = height * 0.05;
  const bandHeight = fontSize * 1.8;
  const logoBlock = logo ? logoSize + gap : 0;
  const total = logoBlock + bandHeight + gap + labelSize * 1.2;
  const top = (height - total) / 2;
  const bandTop = top + logoBlock;
  const bandCenter = bandTop + bandHeight / 2;
  const line = Math.max(2, height * 0.006);

  const band = easeOutCubic(progress(elapsed, 0, BAND_MS));
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(0, bandCenter);
  ctx.scale(1, band);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, -bandHeight / 2, width, bandHeight);
  ctx.fillStyle = card.color;
  ctx.fillRect(0, -bandHeight / 2, width, line);
  ctx.fillRect(0, bandHeight / 2 - line, width, line);
  ctx.restore();

  const textProgress = progress(elapsed, TEXT_DELAY_MS, TEXT_MS);
  if (textProgress > 0) {
    const pulse =
      elapsed > PULSE_START_MS ? 1 + 0.015 * Math.sin(elapsed / 180) : 1;
    const scale = easeOutBack(textProgress) * pulse;
    ctx.save();
    ctx.globalAlpha = Math.min(1, textProgress * 3) * fade;
    ctx.translate(width / 2, bandCenter);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = fontSize * 0.14;
    const outline = contrastTextColor(card.color);
    ctx.strokeStyle = outline;
    ctx.strokeText(card.text, 0, 0);
    ctx.shadowColor = outline;
    ctx.shadowBlur = fontSize * 0.25;
    ctx.fillStyle = card.color;
    ctx.fillText(card.text, 0, 0);
    ctx.restore();
  }

  const logoProgress = progress(elapsed, LOGO_DELAY_MS, LOGO_MS);
  if (logo && logoProgress > 0) {
    const scale = easeOutBack(logoProgress);
    ctx.save();
    ctx.globalAlpha = Math.min(1, logoProgress * 3) * fade;
    ctx.translate(width / 2, top + logoSize / 2);
    ctx.scale(scale, scale);
    ctx.shadowColor = card.color;
    ctx.shadowBlur = logoSize * 0.4;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(
      -logoSize / 2,
      -logoSize / 2,
      logoSize,
      logoSize,
      logoSize * 0.24,
    );
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.clip();
    ctx.drawImage(logo, -logoSize / 2, -logoSize / 2, logoSize, logoSize);
    ctx.restore();
  }

  const labelProgress = progress(elapsed, LABEL_DELAY_MS, LABEL_MS);
  if (labelProgress > 0) {
    ctx.save();
    ctx.globalAlpha = labelProgress * fade;
    ctx.font = `bold ${labelSize}px ${CANVAS_FONT_FAMILY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${labelSize * 0.35}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = labelSize * 0.3;
    ctx.fillText(
      GAME_NAME,
      width / 2,
      bandTop + bandHeight + gap + labelSize * 0.6,
    );
    ctx.restore();
  }
  ctx.restore();
}
