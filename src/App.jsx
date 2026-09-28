import { useMemo, useRef, useState } from 'react';
import { aggregateLogs, decodeLog, parseLog } from './parser.js';
import { exportResults, improveSkill } from './growth.js';
import { sampleHtml } from './sample.js';
import { Icon, SkillTable, Upload } from './components.jsx';

export default function App() {
  const [files, setFiles] = useState([]);
  const [settings, setSettings] = useState({});
  const [results, setResults] = useState({});
  const [active, setActive] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const importing = useRef(false);
  const rolledIds = useRef(new Set());
  const characters = useMemo(() => aggregateLogs(files), [files]);
  const character = characters.find(item => item.name === active) ?? characters[0];
  const eligible = characters.flatMap(item => item.skills).filter(skill => !skill.excluded);
  const pending = (character?.skills ?? []).filter(skill => !skill.excluded && settings[skill.id]?.selected !== false && !results[skill.id]);
  const unnamed = files.reduce((total, file) => total + file.unnamed, 0);

  function resetData() {
    setFiles([]); setSettings({}); setResults({}); setActive(''); setError(''); setNotice(''); rolledIds.current.clear();
  }

  function confirmReset() {
    return !files.length || window.confirm('読み込んだログと上達チェックの結果をクリアします。必要な結果はコピー・保存してください。続けますか？');
  }

  async function readFiles(incoming) {
    if (importing.current) return;
    importing.current = true; setBusy(true); setError(''); setNotice('');
    const added = [];
    const failures = [];
    const seen = new Set(files.map(file => file.hash));
    let duplicates = 0;
    try {
      for (const file of Array.from(incoming)) {
        if (!/\.html?$/i.test(file.name)) { failures.push(`${file.name}: HTML ログを選択してください。`); continue; }
        if (file.size > 20 * 1024 * 1024) { failures.push(`${file.name}: 1ファイル20MBまで対応しています。`); continue; }
        try {
          const buffer = await file.arrayBuffer();
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('');
          if (seen.has(hash)) { duplicates += 1; continue; }
          const parsed = parseLog(decodeLog(buffer), file.name);
          if (!parsed.messages) { failures.push(`${file.name}: ココフォリア形式の発言が見つかりませんでした。`); continue; }
          seen.add(hash); added.push({ ...parsed, name: file.name, hash });
        } catch { failures.push(`${file.name}: 読み込めませんでした。HTML ログを確認してください。`); }
      }
      setFiles(previous => [...previous, ...added]);
      setNotice(`${added.length} ファイルを読み込みました。${duplicates ? ` 同一内容の ${duplicates} ファイルは重複を避けてスキップしました。` : ''}`);
      setError(failures.join('\n'));
    } finally { importing.current = false; setBusy(false); }
  }

  function loadSample() {
    if (!confirmReset()) return;
    resetData();
    setFiles([{ ...parseLog(sampleHtml, 'サンプル.html'), name: 'サンプル.html', hash: 'sample' }]);
    setNotice('サンプルデータを表示しています。実際のセッションのログではありません。');
  }

  function checkSkills(skills) {
    const targets = skills.filter(skill => !rolledIds.current.has(skill.id) && settings[skill.id]?.selected !== false);
    const invalid = targets.some(skill => {
      const value = settings[skill.id]?.value ?? skill.value;
      return value === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 999;
    });
    if (invalid) { setError('現在の技能値を0〜999の整数で入力してください。'); return; }
    const next = {};
    for (const skill of targets) {
      next[skill.id] = improveSkill(Number(settings[skill.id]?.value ?? skill.value));
      rolledIds.current.add(skill.id);
    }
    setResults(previous => ({ ...previous, ...next })); setError('');
    setNotice(`${targets.length} 技能の上達チェックを行いました。${Object.values(next).filter(result => result.increase).length} 技能が成長しました。`);
  }

  async function copyResults() {
    try { await navigator.clipboard.writeText(exportResults(characters, settings, results)); setNotice('全キャラクターの結果をコピーしました。'); }
    catch { setError('コピーできませんでした。「テキスト保存」で結果を保存できます。'); }
  }

  function saveResults() {
    const url = URL.createObjectURL(new Blob([exportResults(characters, settings, results)], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'coc-growth-results.txt'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./">CoC CCFOLIA TOOLS</a><span>セッションの、そのあとに。</span></header>
    <main>
      <section className="intro"><h1>冒険の経験を、次の成長へ。</h1><p>ココフォリアのログから成功した技能を整理して、キャラクターごとに上達チェック。</p></section>
      <Upload onFiles={readFiles} onSample={loadSample} busy={busy} />
      <div className="announcements" aria-live="polite">{notice ? <p className="notice"><Icon name="check" />{notice}</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}</div>
      {files.length ? <div className="file-list"><div>{files.map(file => <span className="file-name" key={file.hash}><Icon name="file" />{file.name}<small>{file.rolls.length} 判定</small></span>)}</div><button className="text-button" disabled={busy} onClick={() => { if (confirmReset()) resetData(); }}>クリア</button></div> : null}
      {characters.length ? <section className="workspace" aria-label="成功した技能">
        <div className="workspace-heading"><div className="section-title"><h2>成功した技能</h2><span>{characters.length} キャラクター / {eligible.length} 技能</span></div><div className="result-actions"><button onClick={copyResults}><Icon name="copy" />結果をコピー</button><button className="primary" disabled={!pending.length || busy} onClick={() => checkSkills(pending)}><Icon name="dice" />まとめて上達チェック</button></div></div>
        <div className="character-tabs" aria-label="キャラクターを選択">{characters.map(item => <button key={item.name} aria-pressed={character.name === item.name} className={character.name === item.name ? 'active' : ''} onClick={() => setActive(item.name)}>{item.name}<span>{item.skills.filter(skill => !skill.excluded).length}</span></button>)}</div>
        <div className="table-caption"><span>技能名を開くと成功ログを確認できます。技能値はチェック前に修正できます。</span><span>このキャラクターの未チェック: <strong>{pending.length}</strong></span></div>
        <SkillTable character={character} settings={settings} results={results} onSetting={(id, update) => setSettings(previous => ({ ...previous, [id]: { ...previous[id], ...update } }))} onCheck={checkSkills} />
        <div className="workspace-footer"><span>一括チェックは選択中のキャラクターが対象です。</span><button className="text-button" onClick={saveResults}>テキスト保存</button></div>
      </section> : <section className="empty-state"><Icon name="dice" width="36" height="36" /><h2>{files.length ? '成功した技能が見つかりませんでした' : 'セッションの記録が、成長のきっかけに。'}</h2><p>{files.length ? '技能名と判定結果を含む CC / CCB のログに対応しています。' : 'ログを読み込むと、ここにキャラクターごとの成功技能が並びます。'}<br />{files.length ? '名前のない判定や通常の会話は集計しません。' : 'まずは「サンプルで試す」で、上達チェックを体験できます。'}</p></section>}
      {unnamed ? <p className="notice">キャラクター名または技能名がない判定 {unnamed} 件は集計していません。</p> : null}
      <aside className="rules"><div><strong>上達チェックのルール</strong><p>1D100 が現在の技能値を超える、または 96 以上なら、1D10 を加算します。</p><small>同じ技能は1回だけチェック。補正・難易度・卓のルールを確認し、現在の技能値を調整してください。</small></div><div className="privacy"><Icon name="lock" /><span>ログはブラウザ内だけで処理します。<small>再読み込みすると入力と結果は消えます。</small></span></div></aside>
    </main>
    <footer className="site-footer"><span>CoC CCFOLIA TOOLS · 非公式ファンツール</span><a href="https://github.com/Liesegang/coc-ccfolia-tools" target="_blank" rel="noreferrer">GitHub</a></footer>
  </div>;
}
