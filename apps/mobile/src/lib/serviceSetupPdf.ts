// Order-of-service PDF for a service setup. The web app draws this with jsPDF
// (apps/cocm/src/utils/export.ts, generateServiceSetupPDF); here the same content is laid out as
// HTML and turned into a PDF with expo-print, then shared or previewed with the system sheets.
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export interface SetupFormData {
  serviceDate: string;
  time: string;
  serviceType: string;
  mcName: string;
  sermonTopic: string;
  scriptureEnglish: string;
  scriptureTwi: string;
  preacherName: string;
}

export interface ProgrammeRow {
  activity: string;
  startTime: string;
  endTime: string;
  duration: string;
  assignedMemberId?: string;
  assignedMemberName: string;
}

export interface Officiator {
  slot: number;
  memberId?: string;
  memberName: string;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const blank = (value: string) => `<span class="blank">${esc(value) || '&nbsp;'}</span>`;

export function buildServiceSetupHtml(form: SetupFormData, programme: ProgrammeRow[], officiators: Officiator[]): string {
  const date = form.serviceDate ? new Date(form.serviceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const slot = (n: number) => officiators.find(o => o.slot === n)?.memberName || '';
  const rows = programme
    .map(row => {
      const time = [row.startTime, row.endTime].filter(Boolean).join(' - ');
      const act = esc(row.activity);
      let detail = '';
      if (/sermon/i.test(row.activity) && !/after/i.test(row.activity)) {
        detail = `<div class="sub">Topic: ${blank(form.sermonTopic)}</div>
          <div class="sub">Text: English: ${blank(form.scriptureEnglish)} &nbsp; Twi: ${blank(form.scriptureTwi)}</div>`;
      }
      if (/lord'?s supper/i.test(row.activity)) {
        detail = `<div class="sub">Assistants:
          ${[1, 2, 3].map(n => `<span class="assistant">${n}. ${blank(slot(n))}</span><span class="assistant">${n + 3}. ${blank(slot(n + 3))}</span>`).join('')}</div>`;
      }
      const person = row.assignedMemberName || (/sermon/i.test(row.activity) && !/after/i.test(row.activity) ? form.preacherName : '');
      return `<tr>
        <td class="c">${esc(time)}</td>
        <td class="c">${esc(row.duration)}</td>
        <td><strong>${act}</strong>${detail}</td>
        <td class="c">${esc(person)}</td>
      </tr>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" />
<style>
  @page { margin: 14mm; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111; font-size: 11px; border: 2px solid #cb2d2c; outline: 1px solid #cb2d2c; outline-offset: -6px; padding: 18px 22px; }
  h1 { font-family: 'Times New Roman', serif; font-style: italic; text-align: center; font-size: 22px; margin: 4px 0 0; }
  h2 { font-family: 'Times New Roman', serif; font-style: italic; text-align: center; font-weight: normal; font-size: 15px; margin: 2px 0 12px; }
  .banner { background: #0b52a1; color: #fff; text-align: center; font-weight: bold; font-size: 14px; padding: 5px 0; margin-bottom: 12px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 10px; font-weight: bold; }
  .blank { display: inline-block; min-width: 90px; border-bottom: 1px solid #000; font-weight: normal; color: #b91c1c; padding: 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f3f3; border: 1px solid #333; padding: 5px; font-size: 10px; }
  td { border: 1px solid #333; padding: 5px; vertical-align: top; }
  td.c { text-align: center; white-space: nowrap; }
  .sub { margin-top: 3px; font-weight: normal; }
  .assistant { display: inline-block; width: 45%; margin: 1px 4px 1px 0; }
  .foot { text-align: center; margin-top: 14px; font-style: italic; }
</style></head><body>
  <h1>CHURCH OF CHRIST</h1>
  <h2>— MATAHEKO —</h2>
  <div class="banner">${esc((form.serviceType || 'Sunday service').toUpperCase())}</div>
  <div class="meta"><div>MC: ${blank(form.mcName)}</div><div>DATE: ${blank(date)}${form.time ? ` &nbsp; TIME: ${esc(form.time)}` : ''}</div></div>
  <table>
    <thead><tr><th style="width:90px">TIME</th><th style="width:70px">DURATION</th><th>ACTIVITY</th><th style="width:150px">OFFICIATORS</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">Acts 2:38 — Repent and be baptized</div>
</body></html>`;
}

/** Opens the system print preview, where the order of service can be viewed and printed. */
export async function previewServiceSetupPdf(form: SetupFormData, programme: ProgrammeRow[], officiators: Officiator[]) {
  await Print.printAsync({ html: buildServiceSetupHtml(form, programme, officiators) });
}

/** Creates the PDF and opens the share sheet so it can be saved or sent. */
export async function shareServiceSetupPdf(form: SetupFormData, programme: ProgrammeRow[], officiators: Officiator[]) {
  const { uri } = await Print.printToFileAsync({ html: buildServiceSetupHtml(form, programme, officiators) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Order of service', UTI: 'com.adobe.pdf' });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}
