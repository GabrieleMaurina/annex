export function zombieSounds(
  zombieId: number | null,
  attackerId: number,
  defenderId: number | undefined,
  conquered: boolean,
): string[] {
  const sounds: string[] = [];
  if (attackerId === zombieId) sounds.push('zombieAttack');
  if (conquered && defenderId !== undefined && defenderId === zombieId)
    sounds.push('zombieDeath');
  return sounds;
}
