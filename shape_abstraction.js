let Path = require('path');
let Ffmpeg = require('ffmpeg-async');
let ImageMagick = require('imagemagick-async');
let LinuxCommands = require('linux-commands-async');

//-------------------------------
// CONSTANTS

let SHAPES = {
  circle: 'c',
  diamond: 'd',
  square: 's'
}

//----------------------------
// HELPER CLASS

let DEFAULT_GUID_LENGTH = 32;

class Guid {
  constructor() {
  }

  /**
   * Create a GUID.
   * @param {number} length  (Optional) Default is 32.
   * @returns {string} Returns an alphanumeric GUID string.
   */
  Create(length) {
    if (!length)
      length = DEFAULT_GUID_LENGTH;

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
  Filename(length, format) {
    return `${Create(length)}.${format}`;
  }
}

//------------------------------

class Spot {
  constructor(builder) {
    this.width = builder.args.width;
    this.height = builder.args.height;
    this.shape = builder.args.shape;
    this.padding = builder.args.padding;
  }

  static get Builder() {
    class Builder {
      constructor() {
        this.args = {
          width: 5,
          height: 5,
          shape: SHAPES.circle,
          padding: 1
        };
      }

      width(n) {
        this.args.width = n;
        return this;
      }

      height(n) {
        this.args.height = n;
        return this;
      }

      shape(str) {
        this.args.shape = str;
        return this;
      }

      padding(n) {
        this.args.padding = n;
        return this;
      }

      build() {
        return new Spot(this);
      }
    }

    return new Builder();
  }

  SizeString() {
    return `${this.width}x${this.height}`;
  }
}

//--------------------------------

let data = {};

function Spotify(imgSource, allArgs, dest) {
  return new Promise((resolve, reject) => {

    // Get parent dir for dest
    let parentDir = LinuxCommands.Path.ParentDir(dest);

    // Create source temp file

    let tmpA1 = Path.join(parentDir, `spots_1_$$.mpc`);
    let briConStr = allArgs.brightness == 0 && allArgs.contrast == 0 ? null : `-brightness-contrast ${allArgs.brightness},${allArgs.contrast}`;

    let tmpA1Args = ['-quiet', imgSource];
    if (briConStr)
      tmpA1Args.push(`-brightness-contrast ${allArgs.brightness},${allArgs.contrast}`);
    tmpA1Args.push('-clamp', '+repage', tmpA1);

    LinuxCommands.Command.LOCAL.Execute('convert', tmpA1Args).then(a1output => {
      if (a1output.stderr) {
        reject(`Error creating tmpA1 file: ${a1output.stderr}`);
        return;
      }

      // Get ww
      LinuxCommands.Command.LOCAL.Execute('convert', [tmpA1, '-ping', '-format', '%w', 'info:']).then(wwOutput => {
        data.ww = Number(wwOutput.stdout);

        // Get hh
        LinuxCommands.Command.LOCAL.Execute('convert', [tmpA1, '-ping', '-format', '%h', 'info:']).then(hhOutput => {
          data.hh = Number(hhOutput.stdout);

          // Get sw
          LinuxCommands.Command.LOCAL.Execute(`convert echo ${allArgs.spot.SizeString()} | cut -dx -f1`).then(swOutput => {
            data.sw = Number(swOutput.stdout);

            // Get sh
            LinuxCommands.Command.LOCAL.Execute(`convert echo ${allArgs.spot.SizeString()} | cut -dx -f2`).then(shOutput => {
              data.sh = Number(shOutput);

              // Get scx
              LinuxCommands.Command.LOCAL.Execute('convert', ['xc:', '-format', `%[fx:(${data.sw}-1)/2]`, 'info:']).then(scxOutput => {
                data.scx = Number(scxOutput);

                // Get scy
                LinuxCommands.Command.LOCAL.Execute('convert', ['xc:', '-format', `%[fx:(${data.sh}-1)/2]`, 'info:']).then(scyOutput => {
                  data.scy = Number(scyOutput);

                  // Get lx, ly
                  data.lx = data.sw - 1;
                  data.ly = data.sh - 1;

                  // Get pw, ph
                  data.pw = data.sw + 2 * allArgs.spot.padding;
                  data.ph = data.sh + 2 * allArgs.spot.padding;

                  // Get padding string 
                  let paddingArgs = null;
                  if (allArgs.spot.padding > 0)
                    paddingArgs = ['-bordercolor', 'black', '-border', allArgs.spot.padding];


                  // Create spot template

                  let tmpA2 = Path.join(`spots_2_$$.mpc`);
                  let args = ['-size', `${data.sw}x${data.sh}`, 'canvas:black', '+antialias', '-fill', 'white', '-draw'];

                  if (allArgs.spot.shape == SHAPES.circle)
                    args.push(`ellipse ${data.scx}, ${data.scy} ${data.scx}, ${data.scy} 0, 360`);
                  else if (allArgs.spot.shape == SHAPES.diamond)
                    args.push(`polygon ${data.scx}, 0 ${data.lx}, ${data.scy} ${data.scx}, ${data.ly} 0, ${data.scy}`);
                  else if (allArgs.spot.shape == SHAPES.square)
                    args.push(`rectangle 0, 0 ${data.lx}, ${data.ly}`);

                  args.push('-alpha', 'off');

                  if (paddingArgs)
                    args = args.concat(paddingArgs);

                  args.push(tmpA2);

                  LinuxCommands.Command.LOCAL.Execute('convert', args).then(spotOutput => {
                    if (spotOutput.stderr) {
                      reject(`Error creating spot file: ${spotOutput.stderr}`);
                      return;
                    }

                    // Get xmin
                    LinuxCommands.Command.LOCAL.Execute('convert', ['xc:', '-format', `%[fx:ceil(${data.ww}/${data.pw})]`, 'info:']).then(xminOutput => {
                      data.xmin = Number(xminOutput.stdout);

                      // Get ymin
                      LinuxCommands.Command.LOCAL.Execute('convert', ['xc:', '-format', `%[fx:ceil(${data.hh}/${data.ph})]`, 'info:']).then(yminOutput => {
                        data.ymin = Number(yminOutput.stdout);

                        // Get www                      
                        LinuxCommands.Command.LOCAL.Execute('convert', ['xc:', '-format', `%[fx:${data.xmin}*${data.pw}]`, 'info:']).then(wwwOutput => {
                          data.www = Number(wwwOutput.stdout);

                          // Get hhh                      
                          LinuxCommands.Command.LOCAL.Execute('convert', ['xc:', '-format', `%[fx:${data.ymin}*${data.ph}]`, 'info:']).then(hhhOutput => {
                            data.hhh = Number(hhhOutput.stdout);

                            // Process image
                                                

                          }).catch(error => reject(`Failed to get hhh value: ${error}`));
                        }).catch(error => reject(`Failed to get www value: ${error}`));
                      }).catch(error => reject(`Failed to get ymin value: ${error}`));
                    }).catch(error => reject(`Failed to get xmin value: ${error}`));
                  }).catch(error => reject(`Failed to create spot file: ${error}`));
                }).catch(error => reject(`Failed to get scy value: ${error}`));
              }).catch(error => reject(`Failed to get scx value: ${error}`));
            }).catch(error => reject(`Failed to get sh value: ${error}`));
          }).catch(error => reject(`Failed to get sw value: ${error}`));
        }).catch(error => reject(`Failed to get hh value: ${error}`));
      }).catch(error => reject(`Failed to get ww value: ${error}`));
    }).catch(`Failed to create tmpA1 file: ${error}`);
  });
}

class ShapeAbstraction {
  constructor(builder) {
    this.allArgs = builder.args;
    this.source = builder.args.source;
    this.fps = builder.args.fps;
    this.spot = builder.args.spot;
    this.brightness = builder.args.brightness;
    this.contrast = builder.args.contrast;
    this.backgroundColor = builder.args.backgroundColor;
    this.edge = builder.args.edge;
    this.edgeColor = builder.args.edgeColor;
  }

  static get Builder() {
    class Builder {
      constructor() {
        this.args = {
          edge: 0,
          edgeColor: 'gray',
          backgroundColor: 'black',
          brightness: 0,
          contrast: 0
        };
      }

      source(str) {
        this.args.source = str;
        return this;
      }

      fps(n) {
        this.args.fps = n;
        return this;
      }

      spot(o) {
        this.args.spot = o;
        return this;
      }

      brightness(n) {
        this.args.brightness = n;
        return this;
      }

      contrast(n) {
        this.args.contrast = n;
        return this;
      }

      backgroundColor(str) {
        this.args.backgroundColor = str;
        return this;
      }

      egde(n) {
        this.args.edge = n;
        return this;
      }

      edgeColor(str) {
        this.args.edgeColor = str;
        return this;
      }

      build() {
        return new ShapeAbstraction(this);
      }
    }

    return new Builder();
  }

  Render(seqName, format, outputDir) {
    return new Promise((resolve, reject) => {

      // Get video info
      Ffmpeg.Video.EstimatedFrames(this.source, this.fps).then(frameCount => {

        // Get dest format string

        let digitCount = frameCount.toString().length;
        let formatStr = `${seqName}_ % `;

        if (digitCount < 10)
          formatStr += `0${digitCount}`;
        else
          formatStr += digitCount.toString();
        formatStr += `d.${format}`;

        let destFormatStr = Path.join(outputDir, formatStr);


        // Turn video into image sequence
        Ffmpeg.Video.ExtractImages(this.source, destFormatStr, frameStartNumber, fps).then(success => {

          // Get paths to images in sequence

          let pattern = `${seqName}_ *.${format}`;

          LinuxCommands.Find.FilesByName(outputDir, pattern, 1, LinuxCommands.Command.LOCAL).then(paths => {

            // Sort paths

            let filepaths = paths.paths;
            filepaths.sort();

            // 
          }).catch();
        }).catch();
      }).catch();
    });
  }
}

//-----------------------------------
// EXPORTS

exports.SHAPES = SHAPES;
exports.Spot = Spot;
exports.ShapeAbstraction = ShapeAbstraction;