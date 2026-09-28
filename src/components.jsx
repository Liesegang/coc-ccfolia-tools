import { useRef, useState } from 'react';

export function Icon({ name, ...props }) {
  const paths = {
    upload: <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" /></>,
    file: <><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M8 12h8M8 16h6" /></>,
    copy: <><rect x="8" y="7" width="12" height="14" rx="2" /><path d="M15 7V3H4v13h4" /></>,
    dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" strokeWidth="3" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function Upload({ onFiles, onSample, busy }) {
  const input = useRef(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  return <section className={`upload ${dragging ? 'dragging' : ''}`} aria-label="ログを読み込む"
    onDragEnter={event => { event.preventDefault(); depth.current += 1; setDragging(true); }}
    onDragOver={event => event.preventDefault()}
    onDragLeave={event => { event.preventDefault(); depth.current -= 1; if (depth.current <= 0) setDragging(false); }}
    onDrop={event => { event.preventDefault(); depth.current = 0; setDragging(false); onFiles(event.dataTransfer.files); }}>
    <Icon name="upload" width="34" height="34" />
    <div className="upload-copy"><h2>{busy ? 'ログを読み込み中…' : 'ログファイルをドロップ'}</h2><p>ココフォリアの HTML ログ・複数ファイル対応</p></div>
    <div className="upload-actions"><button className="primary" onClick={() => input.current.click()} disabled={busy}><Icon name="file" />ファイルを選択</button><button onClick={onSample} disabled={busy}>サンプルで試す</button></div>
    <input ref={input} className="visually-hidden" type="file" accept=".html,.htm" multiple aria-label="ログファイルを選択" disabled={busy} onChange={event => { onFiles(event.target.files); event.target.value = ''; }} />
  </section>;
}

export function SkillRow({ skill, setting, result, onSetting, onCheck }) {
  const value = setting?.value ?? skill.value;
  const selected = setting?.selected !== false;
  const invalid = value === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 999;
  return <tr className={!selected ? 'unselected' : ''}>
    <td><input type="checkbox" checked={selected} disabled={!!result} aria-label={`${skill.name}を成長対象にする`} onChange={event => onSetting(skill.id, { selected: event.target.checked })} /></td>
    <th scope="row"><details className="evidence"><summary>{skill.name}</summary><div className="evidence-content">{skill.successes.map((roll, index) => <p key={index}><small>{roll.source} · {roll.channel}</small>{roll.text}</p>)}</div></details></th>
    <td className="count"><span className="mobile-label">成功 </span>{skill.successes.length}<span> 回</span></td>
    <td className="value-cell"><span className="mobile-label">現在の技能値</span><input className="skill-value" type="number" inputMode="numeric" min="0" max="999" step="1" value={result?.before ?? value} disabled={!!result} aria-invalid={invalid} aria-label={`${skill.name}の現在の技能値`} onChange={event => onSetting(skill.id, { value: event.target.value })} />{skill.values.length > 1 && !result ? <small className="value-warning">複数の技能値あり・要確認</small> : null}</td>
    <td className="result-cell">{result ? <div className={result.increase ? 'result grew' : 'result'}><strong>{result.increase ? `${result.before} → ${result.after}（+${result.increase}）` : '成長なし'}</strong><small>1D100: {result.roll}{result.increase ? ` / 1D10: ${result.increase}` : ''}</small></div> : <button className="small" onClick={() => onCheck([skill])} disabled={!selected || invalid}>チェック</button>}</td>
  </tr>;
}

export function SkillTable({ character, settings, results, onSetting, onCheck }) {
  const eligible = character.skills.filter(skill => !skill.excluded);
  const excluded = character.skills.filter(skill => skill.excluded);
  return <>
    <div className="table-scroll"><table><thead><tr><th scope="col">対象</th><th scope="col">技能</th><th scope="col">成功回数</th><th scope="col">現在の技能値</th><th scope="col">上達チェック</th></tr></thead><tbody>{eligible.map(skill => <SkillRow key={skill.id} skill={skill} setting={settings[skill.id]} result={results[skill.id]} onSetting={onSetting} onCheck={onCheck} />)}</tbody></table></div>
    {!eligible.length ? <p className="empty-inline">このキャラクターには、通常の成長対象となる成功技能がありません。</p> : null}
    {excluded.length ? <details className="excluded"><summary>成長対象外 {excluded.length} 件<span>正気度・能力値などの判定</span></summary><div>{excluded.map(skill => <p key={skill.id}><strong>{skill.name}</strong><span>成功 {skill.successes.length} 回</span><span>技能値 {skill.value}</span></p>)}<small>幸運・SAN・能力値・クトゥルフ神話・信用は自動除外します。信用は7版の扱いです。</small></div></details> : null}
  </>;
}
