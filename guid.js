const DEFAULT_LENGTH = 32;

//--------------------------------

/**
 * Create a GUID.
 * @param {number} length  (Optional) Default is 32.
 * @returns {string} Returns an alphanumeric GUID string.
 */
function Create(length) {
  if (!length)
    length = DEFAULT_LENGTH;

  let guid = '';

  for (let i = 0; i < length; ++i)
    guid += (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);

  return guid;
}

/**
 * Create a filename with GUID as name.
 * @param {number} length (Optional) Default is 32.
 * @param {string} format (Required) Output format (i.e. png, jpeg, tiff, exr, etc) 
 * @returns {string} Returns a string that looks like this: "GUID.FORMAT"
 */
function Filename(length, format) {
  return `${Create(length)}.${format}`;
}

//-----------------------------------
// EXPORTS

exports.DEFAULT_LENGTH = DEFAULT_LENGTH;
exports.Create = Create;
exports.Filename = Filename;