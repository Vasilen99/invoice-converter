import { NextRequest, NextResponse } from 'next/server';
import { BulgarianInvoiceData } from '../../../types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BANK = {
  name: 'Обединена Българска Банка (ОББ)',
  bic: 'UBBSBGSF',
  iban: 'BG91UBBS80021063728750',
};

const PREPARER = 'Николай Николаев Такиев';
const BLUE = '#1a56a0';
const LIGHT_BLUE_BG = '#e8f0fb';
const BORDER = '#b0c4de';

function v(val: string | undefined): string {
  return val ?? '';
}

function buildHtml(data: BulgarianInvoiceData): string {
  const rows = data.lineItems.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : LIGHT_BLUE_BG}">
      <td style="text-align:center">${i + 1}</td>
      <td>${v(item.description)}</td>
      <td style="text-align:center">${v(item.unit)}</td>
      <td style="text-align:center">${v(item.quantity)}</td>
      <td style="text-align:right">${v(item.unitPrice)}</td>
      <td style="text-align:center">${v(item.vatPercent)}%</td>
      <td style="text-align:right">${v(item.value)}</td>
    </tr>`).join('');

  const fillerCount = Math.max(0, 5 - data.lineItems.length);
  const fillerRows = Array.from({ length: fillerCount }).map(() => `
    <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "DejaVu Sans", "Arial Unicode MS", Arial, sans-serif;
    font-size: 11pt; color: #222; background: #fff;
    padding: 28px 32px; width: 794px;
  }
  table { width: 100%; border-collapse: collapse; }
  td, th {
    border: 1px solid ${BORDER}; padding: 5px 8px;
    font-size: 10pt; line-height: 1.5; vertical-align: top; word-break: break-word;
  }
  .label-td { background: ${LIGHT_BLUE_BG}; font-weight: 600; white-space: nowrap; width: 160px; color: #333; }
  .blue-header th { background: ${BLUE}; color: #fff; font-size: 11pt; font-weight: 700; text-align: left; line-height: 1.4; border-color: ${BORDER}; }
  .top-band { background: ${BLUE}; color: #fff; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; border-radius: 3px; line-height: 1.4; }
  .top-band .company { font-weight: 700; font-size: 14pt; }
  .top-band .title { text-align: right; }
  .top-band .title h1 { font-size: 18pt; font-weight: 700; letter-spacing: 1px; line-height: 1.2; }
  .top-band .title p { font-size: 11pt; font-weight: 600; margin-top: 2px; }
  .two-col { display: flex; gap: 14px; margin-bottom: 12px; }
  .two-col > div { flex: 1; }
  .meta-table td { border: 1px solid ${BORDER}; }
  .items-table { table-layout: fixed; margin-bottom: 12px; }
  .items-table col.no { width: 26px; }
  .items-table col.unit { width: 44px; }
  .items-table col.qty { width: 44px; }
  .items-table col.price { width: 68px; }
  .items-table col.vat { width: 54px; }
  .items-table col.val { width: 68px; }
  .items-table thead th { background: ${BLUE}; color: #fff; border-color: ${BORDER}; line-height: 1.4; }
  .items-table thead th.right { text-align: right; }
  .items-table thead th.center { text-align: center; }
  .bottom-row { display: flex; gap: 14px; margin-bottom: 16px; }
  .bottom-row .payment { flex: 55; }
  .bottom-row .totals { flex: 45; }
  .totals-total-row td.lbl { background: ${BLUE}; color: #fff; font-weight: 700; }
  .totals-total-row td.val { background: ${LIGHT_BLUE_BG}; text-align: right; font-weight: 700; font-size: 12pt; }
  .totals-words td { font-size: 10pt; background: #fff; }
  .signatures { display: flex; margin-top: 24px; margin-bottom: 16px; font-size: 10pt; }
  .signatures > div { flex: 1; }
  .signatures > div:first-child { padding-right: 16px; }
  .signatures > div:last-child { padding-left: 16px; }
  .sig-name { font-weight: 600; margin-bottom: 18px; }
  .sig-line { margin-top: 14px; }
  .legal { border-top: 1px solid ${BORDER}; padding-top: 7px; font-size: 8pt; color: #666; line-height: 1.4; }
</style>
</head>
<body>

<div class="top-band">
  <span class="company">${v(data.sellerName)}</span>
  <div class="title">
    <h1>ФАКТУРА</h1>
    <p>No: ${v(data.invoiceNumber)} &nbsp; ОРИГИНАЛ</p>
  </div>
</div>

<div class="two-col">
  <div>
    <table>
      <thead class="blue-header"><tr><th colspan="2">Доставчик:</th></tr></thead>
      <tbody>
        <tr><td class="label-td">Име на фирма:</td><td>${v(data.sellerName)}</td></tr>
        <tr><td class="label-td">ЕИК:</td><td>${v(data.sellerEik)}</td></tr>
        <tr><td class="label-td">ДДС No:</td><td>${v(data.sellerVatNumber)}</td></tr>
        <tr><td class="label-td">Град:</td><td>${v(data.sellerCity)}</td></tr>
        <tr><td class="label-td">Адрес:</td><td>${v(data.sellerAddress)}</td></tr>
        <tr><td class="label-td">МОЛ:</td><td>${v(data.sellerMol)}</td></tr>
      </tbody>
    </table>
  </div>
  <div>
    <table>
      <thead class="blue-header"><tr><th colspan="2">Получател:</th></tr></thead>
      <tbody>
        <tr><td class="label-td">Име на фирма:</td><td>${v(data.buyerName)}</td></tr>
        <tr><td class="label-td">ЕИК:</td><td>${v(data.buyerEik)}</td></tr>
        <tr><td class="label-td">ДДС No:</td><td>${v(data.buyerVatNumber)}</td></tr>
        <tr><td class="label-td">Град:</td><td>${v(data.buyerCity)}</td></tr>
        <tr><td class="label-td">Адрес:</td><td>${v(data.buyerAddress)}</td></tr>
        <tr><td class="label-td">МОЛ:</td><td>${v(data.buyerMol)}</td></tr>
      </tbody>
    </table>
  </div>
</div>

<table class="meta-table" style="margin-bottom:12px">
  <tbody>
    <tr>
      <td class="label-td" style="width:33%">Дата на издаване:</td>
      <td style="width:17%;background:#fff">${v(data.invoiceDate)} г.</td>
      <td class="label-td" style="width:33%">Дата на дан. събитие:</td>
      <td style="width:17%;background:#fff">${v(data.taxEventDate)} г.</td>
    </tr>
    <tr>
      <td class="label-td">Място на сделката:</td>
      <td colspan="3" style="background:#fff">${v(data.location)}</td>
    </tr>
  </tbody>
</table>

<table class="items-table">
  <colgroup>
    <col class="no"><col class="desc"><col class="unit">
    <col class="qty"><col class="price"><col class="vat"><col class="val">
  </colgroup>
  <thead>
    <tr>
      <th class="center">No</th>
      <th>Ime на стоката/услугата</th>
      <th class="center">Мярка</th>
      <th class="center">К-во</th>
      <th class="right">Ед. цена</th>
      <th class="center">ДДС (%)</th>
      <th class="right">Стойност</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    ${fillerRows}
  </tbody>
</table>

<div class="bottom-row">
  <div class="payment">
    <table>
      <thead class="blue-header"><tr><th colspan="2">Начин на плащане: Банков път</th></tr></thead>
      <tbody>
        <tr><td class="label-td">Банка:</td><td>${BANK.name}</td></tr>
        <tr><td class="label-td">BIC:</td><td>${BANK.bic}</td></tr>
        <tr><td class="label-td">IBAN:</td><td>${BANK.iban} (${v(data.currency)})</td></tr>
      </tbody>
    </table>
  </div>
  <div class="totals">
    <table>
      <tbody>
        <tr>
          <td class="label-td">Данъчна основа (20.00%):</td>
          <td style="background:#fff;text-align:right;font-weight:600">${v(data.subtotal)}</td>
        </tr>
        <tr>
          <td class="label-td">Начислен ДДС (20.00%):</td>
          <td style="background:#fff;text-align:right;font-weight:600">${v(data.vatAmount)}</td>
        </tr>
        <tr class="totals-total-row">
          <td class="lbl label-td">Сума за плащане:</td>
          <td class="val">${v(data.total)}</td>
        </tr>
        <tr class="totals-words">
          <td colspan="2"><strong>Словом: </strong>${v(data.totalInWords)}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

<div class="signatures">
  <div>
    <div class="sig-name">Получател:</div>
    <div>Подпис: ................................................</div>
  </div>
  <div>
    <div class="sig-name">Съставил: ${PREPARER}</div>
    <div class="sig-line">Подпис: ................................................</div>
  </div>
</div>

<div class="legal">
  Съгласно чл.6, ал 1 от Закона за счетоводството, чл.114 от ЗДДС и чл.78 от ППЗДДС печатът и подписът не са задължителни реквизити на фактурата.
</div>

</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const data: BulgarianInvoiceData = await req.json();
    const html = buildHtml(data);

    let browser;
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      const puppeteer = (await import('puppeteer-core')).default;
      const chromium = (await import('@sparticuz/chromium-min')).default;
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(
          'https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar'
        ),
        headless: true,
      });
    } else {
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    await browser.close();

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="faktura-${v(data.invoiceNumber)}.pdf"; filename*=UTF-8''${encodeURIComponent('фактура-' + v(data.invoiceNumber) + '.pdf')}`,
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
