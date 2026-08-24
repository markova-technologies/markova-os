/**
 * Markova OS — CLI-Anything Asset Converter Task
 */

async function convertMediaAsset(inputPath, targetFormat = 'wav') {
  return {
    inputPath,
    targetFormat,
    status: 'CONVERTED',
    outputPath: inputPath.replace(/\.[^/.]+$/, `.${targetFormat}`),
  };
}

module.exports = { convertMediaAsset };
