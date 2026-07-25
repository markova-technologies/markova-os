import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to add the MARKOVA logo and header to PDFs
const addBranding = (doc, title) => {
    try {
        const pageWidth = doc.internal.pageSize.width;

        // Header Background
        doc.setFillColor(16, 185, 129); // Emerald Green
        doc.rect(0, 0, pageWidth, 40, 'F');

        // MARKOVA Logo / Text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('MARKOVA', 20, 25);

        // Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(title, pageWidth - 20, 25, { align: 'right' });

        // Date
        doc.setFontSize(10);
        doc.text(new Date().toLocaleDateString(), pageWidth - 20, 35, { align: 'right' });
    } catch (e) {
        console.error("Error adding branding to PDF:", e);
    }
};

export const exportToPDF = (data, title, columns) => {
    try {
        console.log("Preparing PDF export for:", title);

        // Handle various import scenarios for jsPDF
        const PDFConstructor = jsPDF.jsPDF || jsPDF;
        const doc = new PDFConstructor();

        addBranding(doc, title);

        // Filter data to match columns
        const tableRows = (data || []).map(item => {
            return columns.map(col => {
                // Handle nested properties or formatting if needed
                if (col.field === 'date') {
                    const dateVal = item.date || item.timestamp;
                    return dateVal ? new Date(dateVal).toLocaleDateString() : 'N/A';
                }
                const val = item[col.field];
                return val !== undefined && val !== null ? String(val) : '';
            });
        });

        // Use autoTable function directly
        autoTable(doc, {
            startY: 50,
            head: [columns.map(col => col.header)],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3 },
            didDrawPage: (data) => {
                // Optional: add footer or repeated branding
            }
        });

        doc.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
        console.log("PDF export successful");
    } catch (error) {
        console.error("Export to PDF failed:", error);
        alert("Failed to generate PDF. Please check the console for details.");
    }
};

export const downloadBlob = (content, filename, mimeType) => {
    try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Download blob failed:", error);
    }
};

export const downloadAudio = (audioUrl, filename) => {
    try {
        const link = document.createElement('a');
        link.href = audioUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error("Download audio failed:", error);
    }
};
