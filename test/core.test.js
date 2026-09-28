import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { aggregateLogs, decodeLog, parseLog, parseRoll } from '../src/parser.js';
import { exportResults, improveSkill } from '../src/growth.js';
import { sampleHtml } from '../src/sample.js';

globalThis.document = new JSDOM().window.document;

test('CoC 6 / 7 success levels, bonus dice, brackets, and failures', () => {
  for (const result of ['成功', 'ハード成功', 'イクストリーム成功', '決定的成功/スペシャル', 'スペシャル']) {
    assert.equal(parseRoll(`CCB<=65 【目星】 (1D100<=65) ＞ 12 ＞ ${result}`).success, true);
  }
  assert.equal(parseRoll('CC(-1)<=65 【目星】 (1D100<=65) ボーナス・ペナルティダイス[-1] ＞ 82 ＞ 失敗').success, false);
  assert.equal(parseRoll('CC<=65 【目星】 (1D100<=65) ＞ 100 ＞ ファンブル').success, false);
  assert.equal(parseRoll('ただの会話です'), null);
  assert.equal(parseRoll('1D10 ＞ 8'), null);
});

test('special checks are excluded from growth', () => {
  for (const name of ['SAN', '正気度ロール', '幸運', 'アイデア', '知識', 'STR', '信用', 'クトゥルフ神話']) {
    assert.equal(parseRoll(`CC<=60 【${name}】 (1D100<=60) ＞ 20 ＞ 成功`).excluded, true);
  }
});

test('characters and repeated successful skills are grouped', () => {
  const parsed = parseLog(sampleHtml, 'sample.html');
  const characters = aggregateLogs([parsed]);
  assert.equal(parsed.messages, 9);
  assert.equal(characters.length, 2);
  assert.equal(characters[0].skills[0].successes.length, 2);
  assert.equal(characters.flatMap(character => character.skills).filter(skill => !skill.excluded).length, 7);
});

test('untrusted HTML remains inert and unnamed rolls are counted', () => {
  const parsed = parseLog('<script>globalThis.compromised = true</script><p><span>[main]</span><span>A</span><span>CC&lt;=65 (1D100&lt;=65) ＞ 12 ＞ 成功</span></p>', 'unsafe.html');
  assert.equal(globalThis.compromised, undefined);
  assert.equal(parsed.unnamed, 1);
  assert.equal(parsed.rolls.length, 0);
});

test('growth boundary: equal fails, higher grows, 96 grows above 100', () => {
  assert.deepEqual(improveSkill(65, () => 65), { before: 65, roll: 65, increase: 0, after: 65 });
  assert.deepEqual(improveSkill(65, sides => sides === 100 ? 66 : 7), { before: 65, roll: 66, increase: 7, after: 72 });
  assert.deepEqual(improveSkill(120, sides => sides === 100 ? 96 : 3), { before: 120, roll: 96, increase: 3, after: 123 });
  assert.throws(() => improveSkill(NaN));
  assert.throws(() => improveSkill(-1));
  assert.throws(() => improveSkill(5.5));
});

test('export respects selection and prints the actual dice result', () => {
  const characters = aggregateLogs([parseLog(sampleHtml, 'sample.html')]);
  const skill = characters[0].skills[0];
  const result = improveSkill(65, sides => sides === 100 ? 80 : 4);
  const exported = exportResults(characters, {}, { [skill.id]: result });
  assert.match(exported, /目星: 65 → 69 \(\+4\) \/ 1D100=80 \/ 1D10=4/);
  assert.doesNotMatch(exported, /幸運/);
  assert.doesNotMatch(exportResults([characters[0]], { [skill.id]: { selected: false } }, {}), /目星/);
});

test('UTF-8 and Shift JIS are decoded', () => {
  assert.equal(decodeLog(new TextEncoder().encode('目星')), '目星');
  assert.equal(decodeLog(new Uint8Array([0x96, 0xda, 0x90, 0xaf])), '目星');
});
