import type { jsPDF } from 'jspdf';

// Renders the given element (a full-Hebrew read-only review view) to a canvas
// and slices it across A4 pages. Using html2canvas lets the browser do real
// Hebrew/RTL text shaping instead of relying on jsPDF's limited font support.
// jsPDF + html2canvas are ~180kB combined — loaded on demand so they don't
// weigh down the initial page load for people just filling out the form.
//
// Each page gets its own cropped canvas re-encoded as a modest-quality JPEG.
// Passing one giant same-image dataURL to addImage() per page (the more
// obvious "single tall image, different y-offset" approach) makes jsPDF
// embed a full separate copy of the whole image on every page — a 7-page
// review balloons to 100+ MB that way. Slicing first keeps each page's
// payload proportional to just that page's content.
async function buildPdfFromElement(element: HTMLElement): Promise<jsPDF> {
  const [{ jsPDF: JsPdfCtor }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
  });

  const pdf = new JsPdfCtor('p', 'pt', 'a4');
  const pageWidthPt = pdf.internal.pageSize.getWidth();
  const pageHeightPt = pdf.internal.pageSize.getHeight();

  const pxPerPt = canvas.width / pageWidthPt;
  const pageHeightPx = Math.floor(pageHeightPt * pxPerPt);

  let renderedPx = 0;
  let pageIndex = 0;

  while (renderedPx < canvas.height) {
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      renderedPx,
      canvas.width,
      sliceHeightPx,
      0,
      0,
      canvas.width,
      sliceHeightPx,
    );

    const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.85);
    const sliceHeightPt = sliceHeightPx / pxPerPt;

    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(pageImgData, 'JPEG', 0, 0, pageWidthPt, sliceHeightPt);

    renderedPx += sliceHeightPx;
    pageIndex += 1;
  }

  return pdf;
}

export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const pdf = await buildPdfFromElement(element);
  pdf.save(filename);
}

// Used to upload the PDF to the Google Sheet backend (which saves it to
// Drive) without triggering a browser download dialog.
export async function elementToPdfBase64(element: HTMLElement): Promise<string> {
  const pdf = await buildPdfFromElement(element);
  const dataUri = pdf.output('datauristring');
  return dataUri.slice(dataUri.indexOf(',') + 1);
}
