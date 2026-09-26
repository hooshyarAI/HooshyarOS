const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

describe('Unified Intelligent Workspace UI contract',()=>{
  const html=read('web/index.html'); const css=read('web/styles.css'); const app=read('web/app.js');
  test('keeps one conversation-first entry point and one canonical source flow',()=>{
    expect((html.match(/id="assistant-form"/g)||[]).length).toBe(1);
    expect((html.match(/id="analysis-form"/g)||[]).length).toBe(1);
    expect((html.match(/id="csv-file"/g)||[]).length).toBe(1);
    expect((html.match(/id="statement-insight"/g)||[]).length).toBe(1);
  });
  test('uses progressive disclosure for secondary capabilities',()=>{
    expect(html).toContain('id="advanced-tools"'); expect(html).toContain('<details class="tool-panel">'); expect(html).toContain('class="action-grid"'); expect(css).toContain('.tool-panel summary');
  });
  test('preserves canonical report, decision, execution and assistant consumers',()=>{
    expect(html).toContain('id="decision-form"'); expect(html).toContain('id="execution-form"'); expect(html).toContain('id="report-button"'); expect(html).toContain('id="report-export-button"');
    expect(app).toContain('/api/financial/insights'); expect(app).toContain('/api/report'); expect(app).toContain('/api/assistant');
  });
  test('renders human-readable Persian financial presentation',()=>{
    expect(html).toContain('واقعیت تأییدشده / شاخص مشتق‌شده / تفسیر / اقدام مدیریتی');
    expect(app).toContain('buildFinancialAssistantAnswer');
    expect(app).toContain('buildUserFacingFindingGroups');
    expect(app).toContain('formatFaAmount');
    expect(app).not.toContain('result.textContent = text(payload);');
    expect(app).not.toContain("insightList('خلاصه مدیریتی (تفسیر)', insight.interpretation)");
  });
  test('distinguishes result semantics without exposing private reasoning',()=>{
    expect(html).toContain('واقعیت تأییدشده'); expect(html).toContain('شاخص مشتق‌شده'); expect(html).toContain('اقدام مدیریتی'); expect(app).toContain('evidenceBadge'); expect(app).not.toContain('chain-of-thought');
  });
  test('preserves the legacy workspace anchor for existing links',()=>{ expect(html).toContain('id="workspace"'); expect(html).toContain('id="main-workspace"'); });
  test('parses the shipped app script as valid JavaScript',()=>{ expect(()=>new vm.Script(app,{filename:'web/app.js'})).not.toThrow(); });
  test('keeps the surface framework-free and mobile-adaptive',()=>{
    expect(html).toContain('dir="rtl"'); expect(css).toContain('@media(max-width:760px)'); expect(css).toContain('@media(prefers-reduced-motion:reduce)'); expect(css).not.toContain('bootstrap'); expect(css).not.toContain('tailwind');
  });
  test('keeps DeepSeek out of the product surface',()=>{
    expect(html).not.toContain('DeepSeek'); expect(css).not.toContain('DeepSeek'); expect(app).not.toContain('DeepSeek');
  });
});