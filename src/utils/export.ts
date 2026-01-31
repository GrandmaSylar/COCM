// Export utilities for CSV, PDF, and XLSX

// CSV Export
export function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create header row
  const headers = columns.map(col => `"${col.label}"`).join(',');

  // Create data rows
  const rows = data.map(item =>
    columns.map(col => {
      let value = item[col.key];

      // Handle nested properties
      if (col.key.includes('.')) {
        const keys = col.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], item);
      }

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join('; ');
      }

      // Handle objects
      if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value);
      }

      // Escape quotes and wrap in quotes
      const strValue = String(value ?? '');
      return `"${strValue.replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csv = [headers, ...rows].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

// Simple PDF Export (text-based, no external libraries)
export function exportToPDF(data: any[], filename: string, title: string, columns: { key: string; label: string }[]) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create a simple HTML table and open in new window for printing
  const headers = columns.map(col => `<th style="border: 1px solid #ddd; padding: 8px; background: #f4f4f4;">${col.label}</th>`).join('');

  const rows = data.map(item =>
    `<tr>${columns.map(col => {
      let value = item[col.key];

      // Handle nested properties
      if (col.key.includes('.')) {
        const keys = col.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], item);
      }

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join(', ');
      }

      // Handle objects
      if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value);
      }

      return `<td style="border: 1px solid #ddd; padding: 8px;">${String(value ?? '')}</td>`;
    }).join('')}</tr>`
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #333; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { text-align: left; }
        .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="meta">Generated on ${new Date().toLocaleString()} | Total records: ${data.length}</p>
      <button class="no-print" onclick="window.print()">Print / Save as PDF</button>
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

// XLSX Export (using simple XML-based format)
export function exportToXLSX(data: any[], filename: string, columns: { key: string; label: string }[]) {
  if (data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Create XML spreadsheet
  const headers = columns.map(col => `<Cell><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>`).join('');

  const rows = data.map(item =>
    `<Row>${columns.map(col => {
      let value = item[col.key];

      // Handle nested properties
      if (col.key.includes('.')) {
        const keys = col.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], item);
      }

      // Handle arrays
      if (Array.isArray(value)) {
        value = value.join(', ');
      }

      // Handle objects
      if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value);
      }

      const strValue = String(value ?? '');
      const type = !isNaN(Number(strValue)) && strValue !== '' ? 'Number' : 'String';

      return `<Cell><Data ss:Type="${type}">${escapeXml(strValue)}</Data></Cell>`;
    }).join('')}</Row>`
  ).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Row>${headers}</Row>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;

  downloadFile(xml, `${filename}.xls`, 'application/vnd.ms-excel');
}

// Helper function to download file
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper to escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date for export
export function formatDateForExport(dateString: string | undefined): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format currency for export
export function formatCurrencyForExport(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '';
  return `GH₵ ${amount.toFixed(2)}`;
}
