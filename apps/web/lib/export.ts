import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Neutralize spreadsheet formula injection (CSV/Excel). A cell value beginning
 * with `= + @` or a control char can execute as a formula when the export is
 * opened in Excel/Sheets/LibreOffice — user-controlled fields (customer names,
 * unit labels, reference numbers) flow into exports, so prefix such values with
 * an apostrophe to force literal-text interpretation. A leading `-` is only
 * neutralized when the value is NOT a plain number, so legitimate negatives
 * (e.g. "-500") are preserved.
 */
function neutralizeFormula(v: unknown): unknown {
  if (typeof v !== 'string' || v.length === 0) return v;
  if (/^[=+@\t\r]/.test(v) || (v[0] === '-' && Number.isNaN(Number(v)))) {
    return `'${v}`;
  }
  return v;
}

/** One exported row: an opaque record keyed by column key. */
type ExportRow = Record<string, unknown>;

/**
 * A column descriptor. `render`'s parameter is typed `never` so that callers
 * may supply a narrowly-typed renderer per column — `(v: string) => ...`,
 * `(v: number) => ...`, `(v: unknown) => ...` — without a shared value type.
 * A single value type can't express a heterogeneous columns array (different
 * keys carry different value types); `never` accepts every renderer signature
 * contravariantly. The value is opaque at the call boundary, so internally the
 * renderer is invoked through an `(val: unknown) => string` view.
 */
type ExportColumn = {
  header: string;
  key: string;
  width?: number;
  render?: (val: never) => string;
};

export async function exportToExcel({
  data,
  columns,
  filename = 'export',
  lang = 'ar',
  title = 'تقرير معمارك',
}: {
  data: ExportRow[];
  columns: ExportColumn[];
  filename?: string;
  lang?: 'ar' | 'en';
  title?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Data', {
    views: [{ rightToLeft: lang === 'ar' }],
    properties: { defaultRowHeight: 25 },
  });

  // Mimarek Branding Colors
  const primaryColor = '0A1628'; // Vision Navy
  const whiteColor = 'FFFFFF';
  
  // Add Title
  worksheet.mergeCells('A1', `${String.fromCharCode(65 + columns.length - 1)}1`);
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: primaryColor } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  worksheet.addRow([]); // Empty format row

  // Map Headers
  const headerRow = worksheet.addRow(columns.map((c) => c.header));
  headerRow.height = 30;
  
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryColor },
    };
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: whiteColor } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'BFBFBF' } },
      left: { style: 'thin', color: { argb: 'BFBFBF' } },
      bottom: { style: 'thin', color: { argb: 'BFBFBF' } },
      right: { style: 'thin', color: { argb: 'BFBFBF' } },
    };
    // set column width
    worksheet.getColumn(colNumber).width = columns[colNumber - 1]?.width || 25;
  });

  // Add Data
  data.forEach((item) => {
    const rowValues = columns.map((c) => {
      const val = item[c.key];
      const render = c.render as ((value: unknown) => string) | undefined;
      return neutralizeFormula(render ? render(val) : val ?? '');
    });
    
    const row = worksheet.addRow(rowValues);
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } },
      };
    });
  });

  // Save
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${filename}.xlsx`);
}

export async function exportToPDF({
  elementId,
  filename = 'export',
  title = 'تقرير معمارك',
  lang = 'ar',
}: {
  elementId: string;
  filename?: string;
  title?: string;
  lang?: 'ar' | 'en';
}) {
  // Validate elementId to prevent injection of unexpected selectors
  if (!/^[a-zA-Z0-9_-]+$/.test(elementId)) {
    console.error(`Export rejected: invalid elementId "${elementId}"`);
    return;
  }

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  // Add temporary branding header for the snapshot
  const headerDiv = document.createElement('div');
  headerDiv.dir = lang === 'ar' ? 'rtl' : 'ltr';
  headerDiv.style.display = 'flex';
  headerDiv.style.justifyContent = 'space-between';
  headerDiv.style.alignItems = 'center';
  headerDiv.style.marginBottom = '20px';
  headerDiv.style.padding = '20px';
  headerDiv.style.borderBottom = '3px solid #0A1628';
  headerDiv.style.backgroundColor = '#ffffff';

  headerDiv.innerHTML = `
    <h1 style="color: #0A1628; margin: 0; font-family: sans-serif; font-size: 24px;">${title}</h1>
    <h2 style="color: #107840; margin: 0; font-family: sans-serif; font-size: 28px; font-weight: 900; letter-spacing: 2px;">MIMAREK</h2>
  `;
  
  // Clone the element to avoid mutating the visible DOM
  const clone = element.cloneNode(true) as HTMLElement;
  const wrapper = document.createElement('div');
  wrapper.style.position = 'absolute';
  wrapper.style.left = '-9999px';
  wrapper.style.top = '0';
  wrapper.style.width = '1000px'; // fixed width for consistent rendering
  wrapper.style.padding = '20px';
  wrapper.style.backgroundColor = '#ffffff';
  
  wrapper.appendChild(headerDiv);
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2, // higher resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    
    // Landscape A4 looks better for tables
    const pdf = new jsPDF('l', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();

    // A4 Landscape dimensions: 297 x 210 mm
    // Margin of 10mm
    const margin = 10;
    const renderWidth = pdfWidth - (margin * 2);
    const renderHeight = (canvas.height * renderWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', margin, margin, renderWidth, renderHeight);
    
    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error('PDF generation failed', error);
  } finally {
    document.body.removeChild(wrapper);
  }
}
