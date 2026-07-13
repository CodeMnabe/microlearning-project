
/**
 * Exportação tabular da dashboard Analytics para PDF.
 *
 * Gera um relatório em PDF com jsPDF e jspdf-autotable,
 * usando os dados já carregados no frontend.
 *
 * Esta versão não captura visualmente a dashboard.
 * Se o objetivo for exportação visual igual à interface,
 * este ficheiro deve ser migrado para html2canvas + jsPDF.
 */




/**
 * Gera o relatório PDF da dashboard Analytics.
 *
 * A função não volta a pedir dados à API.
 * Recebe os dados já preparados pela page/hooks e organiza-os
 * em páginas e tabelas dentro do PDF.
 */


// Carregamos as bibliotecas de PDF apenas quando o utilizador exporta.
// Isto evita aumentar o bundle inicial da página Analytics.
export async function exportAnalyticsPdf({
  exportElement,
  period,
  exportClassName,
}) {
  if (!exportElement) return;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginX = 8;
  const marginTop = 8;
  const marginBottom = 14;
  const sectionGap = 6;

  const usableWidth = pageWidth - marginX * 2;
  const usableHeight = pageHeight - marginTop - marginBottom;

  let currentY = marginTop;

  function addFooter() {
    const pageNumber = pdf.internal.getCurrentPageInfo().pageNumber;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 130, 145);

    pdf.text(
      `Analytics export - ${period} - Pagina ${pageNumber}`,
      marginX,
      pageHeight - 7
    );
  }

  function addNewPage() {
    addFooter();
    pdf.addPage();
    currentY = marginTop;
  }

  function getVisibleSections() {
    const sections = Array.from(
      exportElement.querySelectorAll("[data-pdf-section]")
    );

    const visibleSections = sections.filter((section) => {
      const rect = section.getBoundingClientRect();

      return rect.width > 0 && rect.height > 0;
    });

    return visibleSections.length > 0 ? visibleSections : [exportElement];
  }

  async function captureElement(element) {
    return html2canvas(element, {
      scale: Math.min(2, window.devicePixelRatio || 1),
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#eef2f7",
      logging: false,
      windowWidth: Math.max(
        document.documentElement.clientWidth,
        exportElement.scrollWidth,
        1100
      ),
      windowHeight: Math.max(
        document.documentElement.clientHeight,
        exportElement.scrollHeight
      ),
      onclone: (clonedDocument) => {
        const clonedRoot = clonedDocument.querySelector(
          '[data-analytics-pdf-root="true"]'
        );

        if (clonedRoot && exportClassName) {
          clonedRoot.classList.add(exportClassName);
        }
      },
    });
  }

  function addCanvasToPdf(canvas) {
    const imageWidth = usableWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    if (imageHeight <= usableHeight) {
      if (currentY + imageHeight > pageHeight - marginBottom) {
        addNewPage();
      }

      const imageData = canvas.toDataURL("image/png", 1.0);

      pdf.addImage(
        imageData,
        "PNG",
        marginX,
        currentY,
        imageWidth,
        imageHeight
      );

      currentY += imageHeight + sectionGap;
      return;
    }

    const pixelsPerMm = canvas.width / imageWidth;
    const sliceHeightPx = Math.floor(usableHeight * pixelsPerMm);

    let offsetY = 0;

    while (offsetY < canvas.height) {
      const remainingHeight = canvas.height - offsetY;
      const currentSliceHeight = Math.min(sliceHeightPx, remainingHeight);

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceHeight;

      const context = sliceCanvas.getContext("2d");

      context.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        currentSliceHeight,
        0,
        0,
        canvas.width,
        currentSliceHeight
      );

      if (currentY !== marginTop) {
        addNewPage();
      }

      const sliceImageHeight =
        (sliceCanvas.height * imageWidth) / sliceCanvas.width;

      const sliceImageData = sliceCanvas.toDataURL("image/png", 1.0);

      pdf.addImage(
        sliceImageData,
        "PNG",
        marginX,
        currentY,
        imageWidth,
        sliceImageHeight
      );

      currentY += sliceImageHeight + sectionGap;
      offsetY += currentSliceHeight;

      if (offsetY < canvas.height) {
        addNewPage();
      }
    }
  }

  const sections = getVisibleSections();

  for (const section of sections) {
    const canvas = await captureElement(section);
    addCanvasToPdf(canvas);
  }

  addFooter();

  pdf.save(`analytics-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
}