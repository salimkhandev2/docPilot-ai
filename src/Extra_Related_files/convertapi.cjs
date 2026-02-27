const convertapi = require('convertapi')('Re5oQuPQbye4GdlAY4Nj9kdpRFAArTdE');
const path = require('path');

async function main() {
    const pdfPath = path.resolve(__dirname, 'toconvert.pdf');
  const outDir = __dirname;

  console.log('Converting PDF to DOCX...');
  
  
  try {
    const result = await convertapi.convert('docx', {
      File: pdfPath
    }, 'pdf');
    
    console.log('✅ Conversion successful!');
    console.log('Saving files to:', outDir);
    
    await result.saveFiles(outDir);
    
    console.log('✅ Files saved successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


