const excludedNames = /^(?:SAN|SANチェック|SAN値|正気度|正気度ロール|正気度チェック|幸運|アイデア|知識|STR|CON|POW|DEX|APP|SIZ|INT|EDU|HP|MP|信用|CreditRating|クトゥルフ神話|クトゥルー神話|CthulhuMythos)$/i;
const commandPattern = /^(?:S?CCB?(?:\([+-]?\d+\)|[+-]?\d+)?|S?1D100)\s*<=\s*(\d+)\s*([^\n]*?)\s*\(1D100\s*<=/i;
const successPattern = /(?:レギュラー成功|ハード成功|イクストリーム成功|成功|決定的成功(?:\s*\/\s*スペシャル)?|クリティカル|スペシャル)\s*[!！。]*$/;

const normalize = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();

export function parseRoll(text) {
  const normalized = normalize(text);
  const match = normalized.match(commandPattern);
  if (!match || !/[>＞]/.test(normalized.slice(match[0].length))) return null;
  const label = match[2].replace(/^【(.*)】$/, '$1').replace(/^〈(.*)〉$/, '$1').trim();
  return {
    name: label,
    value: Number(match[1]),
    success: successPattern.test(normalized) && !/(?:失敗|ファンブル|致命的失敗)\s*$/.test(normalized),
    excluded: excludedNames.test(label.replace(/[\s()（）]/g, '')),
    text: text.trim(),
  };
}

export function parseLog(html, source) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const rolls = [];
  let unnamed = 0;
  let messages = 0;
  for (const paragraph of template.content.querySelectorAll('p')) {
    const spans = Array.from(paragraph.children).filter((element) => element.tagName === 'SPAN');
    if (spans.length < 3) continue;
    messages += 1;
    const character = normalize(spans[1].textContent);
    const roll = parseRoll(spans.slice(2).map((span) => span.textContent).join(' '));
    if (!roll) continue;
    if (!character || !roll.name) {
      unnamed += 1;
      continue;
    }
    rolls.push({ ...roll, character, source, channel: normalize(spans[0].textContent) });
  }
  return { rolls, unnamed, messages };
}

export function aggregateLogs(files) {
  const characters = new Map();
  for (const file of files) {
    for (const roll of file.rolls) {
      if (!characters.has(roll.character)) characters.set(roll.character, new Map());
      const skills = characters.get(roll.character);
      if (!skills.has(roll.name)) {
        skills.set(roll.name, { id: JSON.stringify([roll.character, roll.name]), name: roll.name, value: roll.value, values: [], successes: [], excluded: roll.excluded });
      }
      const skill = skills.get(roll.name);
      skill.value = roll.value;
      if (!skill.values.includes(roll.value)) skill.values.push(roll.value);
      if (roll.success) skill.successes.push(roll);
    }
  }
  return Array.from(characters, ([name, skills]) => ({
    name,
    skills: Array.from(skills.values()).filter((skill) => skill.successes.length > 0),
  })).filter((character) => character.skills.length > 0);
}

export function decodeLog(buffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: true });
  try { return utf8.decode(buffer); }
  catch { return new TextDecoder('shift_jis').decode(buffer); }
}
