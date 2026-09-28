export function rollDie(sides) {
  const random = new Uint32Array(1);
  const limit = Math.floor(4294967296 / sides) * sides;
  do { crypto.getRandomValues(random); } while (random[0] >= limit);
  return (random[0] % sides) + 1;
}

export function improveSkill(value, die = rollDie) {
  if (!Number.isInteger(value) || value < 0 || value > 999) throw new Error('技能値は0〜999の整数で入力してください。');
  const roll = die(100);
  const increase = roll > value || roll > 95 ? die(10) : 0;
  return { before: value, roll, increase, after: value + increase };
}

export function exportResults(characters, settings, results) {
  return characters.map((character) => {
    const lines = character.skills.filter((skill) => !skill.excluded && settings[skill.id]?.selected !== false).map((skill) => {
      const result = results[skill.id];
      const value = settings[skill.id]?.value ?? skill.value;
      return result
        ? `${skill.name}: ${result.before} → ${result.after} (+${result.increase}) / 1D100=${result.roll}${result.increase ? ` / 1D10=${result.increase}` : ''}`
        : `${skill.name}: ${value} / 成功${skill.successes.length}回 / 未チェック`;
    });
    return `【${character.name}】\n${lines.join('\n') || '成長対象の成功技能なし'}`;
  }).join('\n\n');
}
