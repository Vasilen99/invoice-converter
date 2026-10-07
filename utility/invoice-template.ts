const BLUE = "#1a56a0";
const LIGHT_BLUE_BG = "#e8f0fb";
const BORDER = "#b0c4de";

export const DEFAULT_INVOICE_TEMPLATE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "DejaVu Sans", "Arial Unicode MS", Arial, sans-serif;
    font-size: 11pt;
    color: #222;
    background: #fff;
    padding: 28px 32px;
    width: 794px;
  }
  table { width: 100%; border-collapse: collapse; }
  td, th {
    border: 1px solid ${BORDER};
    padding: 5px 8px;
    font-size: 10pt;
    line-height: 1.5;
    vertical-align: top;
    word-break: break-word;
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
  .items-table col.no { width: 30px; }
  .items-table col.desc { width: 210px; }
  .items-table col.unit { width: 45px; }
  .items-table col.qty { width: 45px; }
  .items-table col.price { width: 55px; }
  .items-table col.vat { width: 60px; }
  .items-table col.val { width: 65px; }
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
  <span class="company">{{sellerName}}</span>
  <div class="title">
    <h1>ФАКТУРА</h1>
    <p>No: {{invoiceNumber}} &nbsp; ОРИГИНАЛ</p>
  </div>
</div>

<div class="two-col">
  <div>
    <table>
      <thead class="blue-header"><tr><th colspan="2">Доставчик:</th></tr></thead>
      <tbody>
        <tr><td class="label-td">Име на фирма:</td><td>{{sellerName}}</td></tr>
        <tr><td class="label-td">ЕИК:</td><td>{{sellerEik}}</td></tr>
        <tr><td class="label-td">ДДС No:</td><td>{{sellerVatNumber}}</td></tr>
        <tr><td class="label-td">Град:</td><td>{{sellerCity}}</td></tr>
        <tr><td class="label-td">Адрес:</td><td>{{sellerAddress}}</td></tr>
        <tr><td class="label-td">МОЛ:</td><td>{{sellerMol}}</td></tr>
      </tbody>
    </table>
  </div>
  <div>
    <table>
      <thead class="blue-header"><tr><th colspan="2">Получател:</th></tr></thead>
      <tbody>
        <tr><td class="label-td">Име на фирма:</td><td>{{buyerName}}</td></tr>
        <tr><td class="label-td">ЕИК:</td><td>{{buyerEik}}</td></tr>
        <tr><td class="label-td">ДДС No:</td><td>{{buyerVatNumber}}</td></tr>
        <tr><td class="label-td">Град:</td><td>{{buyerCity}}</td></tr>
        <tr><td class="label-td">Адрес:</td><td>{{buyerAddress}}</td></tr>
        <tr><td class="label-td">МОЛ:</td><td>{{buyerMol}}</td></tr>
      </tbody>
    </table>
  </div>
</div>

<table class="meta-table" style="margin-bottom:12px">
  <tbody>
    <tr>
      <td class="label-td" style="width:33%">Дата на издаване:</td>
      <td style="width:17%;background:#fff">{{invoiceDate}} г.</td>
      <td class="label-td" style="width:33%">Дата на дан. събитие:</td>
      <td style="width:17%;background:#fff">{{taxEventDate}} г.</td>
    </tr>
    <tr>
      <td class="label-td">Място на сделката:</td>
      <td colspan="3" style="background:#fff">{{location}}</td>
    </tr>
  </tbody>
</table>

<table class="items-table">
  <colgroup>
    <col class="no" /><col class="desc" /><col class="unit" />
    <col class="qty" /><col class="price" /><col class="vat" /><col class="val" />
  </colgroup>
  <thead>
    <tr>
      <th class="center">No</th>
      <th>Име на стоката/услугата</th>
      <th class="center">Мярка</th>
      <th class="center">К-во</th>
      <th class="right">Ед. цена</th>
      <th class="center">ДДС (%)</th>
      <th class="right">Стойност</th>
    </tr>
  </thead>
  <tbody data-repeat="lineItem">
    <tr>
      <td style="text-align:center">{{lineItem.index}}</td>
      <td>{{lineItem.description}}</td>
      <td style="text-align:center">{{lineItem.unit}}</td>
      <td style="text-align:center">{{lineItem.quantity}}</td>
      <td style="text-align:right">{{lineItem.unitPrice}}</td>
      <td style="text-align:center">{{lineItem.vatPercent}}%</td>
      <td style="text-align:right">{{lineItem.value}}</td>
    </tr>
  </tbody>
</table>

<div class="bottom-row">
  <div class="payment">
    <table>
      <thead class="blue-header"><tr><th colspan="2">Начин на плащане: Банков път</th></tr></thead>
      <tbody>
        <tr><td class="label-td">Банка:</td><td>{{bank}}</td></tr>
        <tr><td class="label-td">BIC:</td><td>{{bic}}</td></tr>
        <tr><td class="label-td">IBAN:</td><td>{{iban}} ({{currency}})</td></tr>
      </tbody>
    </table>
  </div>
  <div class="totals">
    <table>
      <tbody>
        <tr>
          <td class="label-td">Данъчна основа (20.00%):</td>
          <td style="background:#fff;text-align:right;font-weight:600">{{subtotal}} {{currency}}</td>
        </tr>
        <tr>
          <td class="label-td">Начислен ДДС (20.00%):</td>
          <td style="background:#fff;text-align:right;font-weight:600">{{vatAmount}} {{currency}}</td>
        </tr>
        <tr class="totals-total-row">
          <td class="lbl label-td">Сума за плащане:</td>
          <td class="val">{{total}} {{currency}}</td>
        </tr>
        <tr class="totals-words">
          <td colspan="2"><strong>Словом: </strong>{{totalInWords}}</td>
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
    <div class="sig-name">Съставил: {{composer_name}}</div>
    <div class="sig-line">Подпис: ................................................</div>
  </div>
</div>

<div class="legal">
  Съгласно чл.6, ал 1 от Закона за счетоводството, чл.114 от ЗДДС и чл.78 от ППЗДДС печатът и подписът не са задължителни реквизити на фактурата.
</div>

</body>
</html>`;

const SCRIPT_TAG_REGEX = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;
const EVENT_HANDLER_ATTR_REGEX = /\son[a-z]+="[^"]*"/gi;
const NORMALIZED_TEMPLATE_MARKER = 'data-template-normalized="true"';
const NORMALIZED_STYLE_BLOCK_REGEX =
  /<style[^>]*data-template-normalized="true"[^>]*>[\s\S]*?<\/style>/i;

const NORMALIZATION_STYLE = `<style ${NORMALIZED_TEMPLATE_MARKER}>
  @page {
    size: A4;
    margin: 0;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  body {
    width: 794px;
    max-width: none !important;
    min-width: 794px;
    font-family: "DejaVu Sans", "Arial Unicode MS", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.4;
    color: #222;
    box-sizing: border-box;
    overflow-x: hidden;
    overflow-y: hidden;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    max-width: 100%;
  }

  td, th {
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
    line-height: 1.4;
    max-width: 100%;
  }

  p, span, div, li, strong, b, em, small {
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: normal;
  }

  .tpl-var {
    display: inline-block;
    min-width: 0;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    line-height: inherit;
    vertical-align: top;
  }

  td .tpl-var,
  th .tpl-var,
  p .tpl-var,
  div .tpl-var,
  span .tpl-var {
    max-width: 100%;
    display: inline;
  }

  img, svg, canvas {
    max-width: 100%;
    height: auto;
    display: block;
  }
</style>`;

export function sanitizeTemplateHtml(templateHtml: string): string {
  return templateHtml
    .replace(SCRIPT_TAG_REGEX, "")
    .replace(EVENT_HANDLER_ATTR_REGEX, "")
    .trim();
}

function injectNormalizationStyle(templateHtml: string): string {
  if (NORMALIZED_STYLE_BLOCK_REGEX.test(templateHtml)) {
    return templateHtml.replace(
      NORMALIZED_STYLE_BLOCK_REGEX,
      NORMALIZATION_STYLE,
    );
  }

  if (templateHtml.includes("</head>")) {
    return templateHtml.replace("</head>", `${NORMALIZATION_STYLE}</head>`);
  }

  if (templateHtml.includes("<html>")) {
    return templateHtml.replace(
      "<html>",
      `<html><head>${NORMALIZATION_STYLE}</head>`,
    );
  }

  return `${NORMALIZATION_STYLE}${templateHtml}`;
}

export function normalizeTemplateHtml(templateHtml: string): string {
  const sanitized = sanitizeTemplateHtml(templateHtml);
  if (!sanitized) return "";

  return injectNormalizationStyle(sanitized).trim();
}

export function getDefaultInvoiceTemplateHtml(): string {
  return DEFAULT_INVOICE_TEMPLATE_HTML;
}
