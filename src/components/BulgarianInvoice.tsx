'use client';

import React from 'react';
import { BulgarianInvoiceData } from '../types';

export const SELLER_DEFAULTS = {
  name: 'УЕБ СЪРВИСИС БЪЛГАРИЯ ЕООД',
  eik: '207880021',
  vatNumber: 'BG207880021',
  city: 'с. Гривица, България',
  address: 'ул. Марица № 8',
  mol: 'Василен Красиславов Минков',
};

const BANK = {
  name: 'Обединена Българска Банка (ОББ)',
  bic: 'UBBSBGSF',
  iban: 'BG91UBBS80021063728750',
};

const PREPARER = 'Николай Николаев Такиев';
const BLUE = '#1a56a0';
const LIGHT_BLUE_BG = '#e8f0fb';
const BORDER = '#b0c4de';

interface Props {
  data: BulgarianInvoiceData;
}

const tdStyle: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  padding: '5px 8px',
  fontSize: 11,
  lineHeight: '1.5',
  verticalAlign: 'top',
  wordBreak: 'break-word',
};

const labelTd: React.CSSProperties = {
  ...tdStyle,
  background: LIGHT_BLUE_BG,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  width: 160,
  color: '#333',
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <tr>
    <td style={labelTd}>{label}</td>
    <td style={{ ...tdStyle, background: '#fff' }}>{value || ''}</td>
  </tr>
);

const BulgarianInvoice = React.forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  const pageStyle: React.CSSProperties = {
    width: 794,
    minHeight: 1123,
    background: '#fff',
    fontFamily: '"Arial", "Helvetica", sans-serif',
    fontSize: 12,
    lineHeight: '1.5',
    color: '#222',
    padding: '32px 36px 36px 36px',
    boxSizing: 'border-box',
    position: 'relative',
  };

  return (
    <div ref={ref} style={pageStyle}>

      {/* ── TOP BLUE BAND ── */}
      <div style={{
        background: BLUE,
        color: '#fff',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 3,
        lineHeight: '1.4',
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>
          {data.sellerName}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1, lineHeight: '1.2' }}>ФАКТУРА</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>No: {data.invoiceNumber} &nbsp; ОРИГИНАЛ</div>
        </div>
      </div>

      {/* ── SUPPLIER + RECIPIENT ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <tr>
            {/* Supplier */}
            <td style={{ width: '50%', verticalAlign: 'top', paddingRight: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BORDER}` }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{
                      background: BLUE, color: '#fff', padding: '6px 8px',
                      fontSize: 12, fontWeight: 700, textAlign: 'left', lineHeight: '1.4',
                    }}>
                      Доставчик:
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <InfoRow label="Име на фирма:" value={data.sellerName} />
                  <InfoRow label="ЕИК:" value={data.sellerEik} />
                  <InfoRow label="ДДС No:" value={data.sellerVatNumber} />
                  <InfoRow label="Град:" value={data.sellerCity} />
                  <InfoRow label="Адрес:" value={data.sellerAddress} />
                  <InfoRow label="МОЛ:" value={data.sellerMol} />
                </tbody>
              </table>
            </td>

            {/* Recipient */}
            <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BORDER}` }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{
                      background: BLUE, color: '#fff', padding: '6px 8px',
                      fontSize: 12, fontWeight: 700, textAlign: 'left', lineHeight: '1.4',
                    }}>
                      Получател:
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <InfoRow label="Име на фирма:" value={data.buyerName} />
                  <InfoRow label="ЕИК:" value={data.buyerEik} />
                  <InfoRow label="ДДС No:" value={data.buyerVatNumber} />
                  <InfoRow label="Град:" value={data.buyerCity} />
                  <InfoRow label="Адрес:" value={data.buyerAddress} />
                  <InfoRow label="МОЛ:" value={data.buyerMol} />
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── INVOICE META DATES ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ ...tdStyle, background: LIGHT_BLUE_BG, fontWeight: 600, width: '33%' }}>
              Дата на издаване:
            </td>
            <td style={{ ...tdStyle, background: '#fff', width: '17%' }}>{data.invoiceDate || ''} г.</td>
            <td style={{ ...tdStyle, background: LIGHT_BLUE_BG, fontWeight: 600, width: '33%' }}>
              Дата на дан. събитие:
            </td>
            <td style={{ ...tdStyle, background: '#fff', width: '17%' }}>{data.taxEventDate || ''} г.</td>
          </tr>
          <tr>
            <td style={{ ...tdStyle, background: LIGHT_BLUE_BG, fontWeight: 600 }}>Място на сделката:</td>
            <td colSpan={3} style={{ ...tdStyle, background: '#fff' }}>{data.location || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* ── LINE ITEMS TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 28 }} />
          <col />
          <col style={{ width: 44 }} />
          <col style={{ width: 44 }} />
          <col style={{ width: 68 }} />
          <col style={{ width: 52 }} />
          <col style={{ width: 68 }} />
        </colgroup>
        <thead>
          <tr style={{ background: BLUE, color: '#fff' }}>
            <th style={{ ...tdStyle, border: `1px solid ${BORDER}`, background: BLUE, color: '#fff', textAlign: 'center' }}>No</th>
            <th style={{ ...tdStyle, border: `1px solid ${BORDER}`, background: BLUE, color: '#fff', textAlign: 'left' }}>Ime на стоката/услугата</th>
            <th style={{ ...tdStyle, border: `1px solid ${BORDER}`, background: BLUE, color: '#fff', textAlign: 'center' }}>Мярка</th>
            <th style={{ ...tdStyle, border: `1px solid ${BORDER}`, background: BLUE, color: '#fff', textAlign: 'center' }}>К-во</th>
            <th style={{ ...tdStyle, border: `1px solid ${BORDER}`, background: BLUE, color: '#fff', textAlign: 'right' }}>Ед. цена</th>
            <th style={{ ...tdStyle, border: `1px solid ${BORDER}`, background: BLUE, color: '#fff', textAlign: 'center' }}>ДДС (%)</th>
            <th style={{ ...tdStyle, border: `1px solid ${BORDER}`, background: BLUE, color: '#fff', textAlign: 'right' }}>Стойност</th>
          </tr>
        </thead>
        <tbody>
          {data.lineItems.map((item, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : LIGHT_BLUE_BG }}>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{i + 1}</td>
              <td style={{ ...tdStyle }}>{item.description}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.unit}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{item.unitPrice}</td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>{item.vatPercent}%</td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{item.value}</td>
            </tr>
          ))}
          {/* Filler rows */}
          {Array.from({ length: Math.max(0, 5 - data.lineItems.length) }).map((_, i) => (
            <tr key={`e${i}`}>
              <td style={{ ...tdStyle, height: 24 }}>&nbsp;</td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
              <td style={tdStyle}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── PAYMENT + TOTALS ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <tbody>
          <tr>
            {/* Payment info — left */}
            <td style={{ width: '55%', verticalAlign: 'top', paddingRight: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BORDER}` }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{
                      background: BLUE, color: '#fff', padding: '6px 8px',
                      fontSize: 12, fontWeight: 700, textAlign: 'left', lineHeight: '1.4',
                    }}>
                      Начин на плащане: Банков път
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <InfoRow label="Банка:" value={BANK.name} />
                  <InfoRow label="BIC:" value={BANK.bic} />
                  <InfoRow label="IBAN:" value={`${BANK.iban} (${data.currency})`} />
                </tbody>
              </table>
            </td>

            {/* Totals — right */}
            <td style={{ width: '45%', verticalAlign: 'top', paddingLeft: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${BORDER}` }}>
                <tbody>
                  <tr>
                    <td style={{ ...labelTd, width: 'auto' }}>Данъчна основа (20.00%):</td>
                    <td style={{ ...tdStyle, background: '#fff', textAlign: 'right', fontWeight: 600 }}>
                      {data.subtotal} {data.currency}
                    </td>
                  </tr>
                  <tr>
                    <td style={labelTd}>Начислен ДДС (20.00%):</td>
                    <td style={{ ...tdStyle, background: '#fff', textAlign: 'right', fontWeight: 600 }}>
                      {data.vatAmount}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...labelTd, background: BLUE, color: '#fff', fontWeight: 700, fontSize: 12 }}>
                      Сума за плащане:
                    </td>
                    <td style={{ ...tdStyle, background: LIGHT_BLUE_BG, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                      {data.total} {data.currency}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ ...tdStyle, background: '#fff', fontSize: 11 }}>
                      <span style={{ fontWeight: 600 }}>Словом: </span>{data.totalInWords}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── SIGNATURES ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24, marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', verticalAlign: 'bottom', paddingRight: 16, fontSize: 11 }}>
              <div style={{ fontWeight: 600, marginBottom: 18 }}>Получател:</div>
              <div>Подпис: ................................................</div>
            </td>
            <td style={{ width: '50%', verticalAlign: 'bottom', paddingLeft: 16, fontSize: 11 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Съставил: {PREPARER}</div>
              <div style={{ marginTop: 14 }}>Подпис: ................................................</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── LEGAL FOOTER ── */}
      <div style={{
        borderTop: `1px solid ${BORDER}`,
        paddingTop: 8,
        fontSize: 9,
        color: '#666',
        lineHeight: 1.4,
      }}>
        Съгласно чл.6, ал 1 от Закона за счетоводството, чл.114 от ЗДДС и чл.78 от ППЗДДС печатът и подписът не са задължителни реквизити на фактурата.
      </div>
    </div>
  );
});

BulgarianInvoice.displayName = 'BulgarianInvoice';
export default BulgarianInvoice;
