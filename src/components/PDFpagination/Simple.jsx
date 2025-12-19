'use client'
import { defaultHtml } from '@/data/defaultHtml';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useEffect, useRef } from 'react';

export default function GrapeJSBuilder() {
    const editorRef = useRef(null);

    useEffect(() => {
        if (!editorRef.current) {
            const editor = grapesjs.init({
                container: '#gjs',
                height: '100vh',
                width: 'auto',
                Editable: true,
                storageManager: false,
                components: defaultHtml,
                canvas: {
                    styles: [
                        'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css'
                    ],
                    attributes: { style: 'width: 210mm; margin: 0 auto; background-color: white;' }
                }
            });

            // Add Download PDF button
            editor.Panels.addButton('options', {
                id: 'download-pdf',
                className: 'fa fa-download',
                command: 'download-pdf',
                attributes: { title: 'Download PDF' },
            });

            editor.Commands.add('download-pdf', {
                run: async () => {
                    const canvasBody = editor.Canvas.getBody();
                    // Target the specific wrapper div if possible, otherwise use the body
                    const el = canvasBody.querySelector('div[style*="width: 210mm"]') || canvasBody;

                    const canvas = await html2canvas(el, {
                        scale: 3, // Higher scale for better quality
                        useCORS: true,
                        logging: false,
                        width: el.offsetWidth,
                        height: el.offsetHeight,
                    });

                    const imgData = canvas.toDataURL('image/png');
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();

                    const imgProps = pdf.getImageProperties(imgData);
                    const imgWidth = imgProps.width;
                    const imgHeight = imgProps.height;

                    const scaledImgHeight = (imgHeight * pdfWidth) / imgWidth;
                    let heightLeft = scaledImgHeight;
                    let position = 0;

                    // Add first page
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
                    heightLeft -= pdfHeight;

                    // Add subsequent pages if needed
                    while (heightLeft > 0) {
                        pdf.addPage();
                        position = heightLeft - scaledImgHeight;
                        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledImgHeight);
                        heightLeft -= pdfHeight;
                    }

                    const blobUrl = pdf.output('bloburl') + '#toolbar=0';

                    editor.Modal.setTitle('PDF Preview');
                    editor.Modal.setContent(`
                        <div style="height: 600px; display: flex; flex-direction: column;">
                            <iframe src="${blobUrl}" width="100%" height="100%" style="border: none;"></iframe>
                        </div>
                    `);
                    editor.Modal.open();
                }
            });

            editorRef.current = editor;
        }

        return () => {
            if (editorRef.current) {
                editorRef.current.destroy();
                editorRef.current = null;
            }
        };
    }, []);

    return <div id="gjs"> </div>;
}